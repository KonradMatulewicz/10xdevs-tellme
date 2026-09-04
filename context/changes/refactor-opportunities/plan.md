# Refactor opportunities (C1 + CI typecheck) — Implementation Plan

## Overview

Extract the duplicated `tasks` insert (currently copy-pasted between `backend/src/routes/transcribe.ts` and `backend/src/routes/tasks.ts`) into a single shared function, and turn on `backend`'s existing `typecheck` script as a blocking CI step. This is the top-ranked candidate (C1) plus the cheap prerequisite from `context/changes/refactor-opportunities/research.md`'s ranking — chosen by the user over the other three candidates (C2 duplicated `TaskStatus`, C3 no-transactionality logging, C4 typed Supabase client), which stay out of scope for this plan.

## Current State Analysis

- `backend/src/routes/transcribe.ts:49-52` and `backend/src/routes/tasks.ts:54-57` contain an identical block: `supabase.from('tasks').insert(texts.map((text) => ({ text }))).select()`.
- `backend/src/` has no data-access module (`ai/`, `middleware/`, `routes/` are the only subdirectories) — nothing to extend, this plan creates the first one.
- `backend/test/support/fake-supabase.ts:23-24` defines `insert: () => builder` / `update: () => builder` — arguments passed to these are not recorded or inspected anywhere today (comment at lines 13-15 states this explicitly).
- `backend/package.json:13` already defines `"typecheck": "tsc --noEmit && tsc --noEmit -p test/tsconfig.json"`, but `.github/workflows/ci.yml`'s `backend-tests` job (lines 32-67) never calls it — only `npm test`. Root `tsconfig.json:12` excludes `backend` from the root `lint-typecheck` job, so no CI job typechecks `backend/src` today.
- Verified this session: `cd backend && npm run typecheck` passes with zero errors; `npm test` passes (29 passed, 2 skipped — the 2 skipped are `idor.test.ts`'s real-network cases, gated on local test-user secrets not present in this session, which is expected and unrelated to this plan).

### Key Discoveries:

- Baseline is clean — adding the CI typecheck step carries no risk of surfacing pre-existing errors that would need fixing first (verified directly, not inferred).
- `fake-supabase.ts` is shared by `tasks.test.ts`, `auth-gate.test.ts`, and `db-check.test.ts` — any change to it must stay backward compatible with all three.

## Desired End State

- One function, `insertTasks(supabase, texts)` in `backend/src/db/tasks.ts`, is the only place that builds the `tasks` insert. Both `routes/transcribe.ts` and `routes/tasks.ts` call it instead of duplicating the Supabase chain.
- A new unit test asserts the exact row shape `insertTasks` sends to Supabase — closing the gap research.md flagged ("the fake doesn't inspect insert arguments, so a broken extraction wouldn't be caught").
- `backend`'s CI job runs `npm run typecheck` and fails the build on any type error in `backend/src` or `backend/test`.
- Verify: `cd backend && npm run typecheck && npm test` is green locally; the two edited routes behave identically over HTTP (existing `tasks.test.ts`/`auth-gate.test.ts` cases still pass unmodified); CI's `backend-tests` job shows a typecheck step.

## What We're NOT Doing

- Not touching `TaskStatus` duplication (C2), transactionality/logging on insert failure (C3), or the `Database` generic on the Supabase client (C4) — all deferred per the user's chosen scope in `research.md`.
- Not adding the root `lint-typecheck` CI job's coverage of `backend/` — only `backend-tests` gets the new step; the root job's exclusion of `backend` in `tsconfig.json:12` stays as-is (it's correct: root config shouldn't typecheck a Worker with different `tsconfig` target).
- Not changing `POST /tasks`' body-parsing logic (the `texts`/`text` normalization in `tasks.ts:45-51`) or `transcribe.ts`'s extraction step — only the insert call itself moves.
- Not enhancing `fake-supabase.ts`'s `update()` path — only `insert()` needs arg-recording for this plan's test.

## Implementation Approach

Two independent, separately-revertible phases. Order: CI gate first (it's a pure addition with a verified-clean baseline, so it can't block anything and immediately locks in the current good state before the refactor touches the code it would be checking), then the extraction itself.

## Phase 1: Backend typecheck as a blocking CI step

### Overview

Add `backend`'s existing `typecheck` script to the CI `backend-tests` job, before the test step so type errors fail fast.

### Changes Required:

#### 1. CI workflow

**File**: `.github/workflows/ci.yml`

**Intent**: Add a `Typecheck` step to the `backend-tests` job that runs `backend/package.json`'s existing `typecheck` script, positioned after `Install dependencies` and before `Run tests` (fail fast on type errors rather than waiting for the test run).

**Contract**: New step with `working-directory: backend`, `run: npm run typecheck`. No new secrets or env needed (typecheck doesn't touch `.dev.vars`). Job continues to fail (red) on non-zero exit — no `continue-on-error`.

### Success Criteria:

#### Automated Verification:

- [ ] `cd backend && npm run typecheck` exits 0 locally
- [ ] CI workflow YAML is valid (`.github/workflows/ci.yml` parses — verified by the next PR's Actions run)

#### Manual Verification:

- [ ] Open the Actions run for the PR containing this change and confirm a `Typecheck` step appears in `backend-tests` and passes

---

## Phase 2: Extract shared `insertTasks` helper

### Overview

Create `backend/src/db/tasks.ts` with a single `insertTasks` function; call it from both `routes/transcribe.ts` and `routes/tasks.ts`; extend the test double to record insert arguments; add a unit test asserting the row shape.

### Changes Required:

#### 1. New shared insert function

**File**: `backend/src/db/tasks.ts` (new)

**Intent**: House the one insert operation both routes need, so there's a single place to change the row shape in the future (this is also the natural home for a later `Database`-generic-typed client, per research.md's C4 — not done in this plan, just not blocked by it).

**Contract**: `export async function insertTasks(supabase: SupabaseClient, texts: string[]): Promise<{ data: Task[] | null; error: PostgrestError | null }>` — same return shape the two call sites already destructure (`{ data, error }`), so callers change only their import and call site, not their error-handling branches. Body is exactly the existing chain: `supabase.from('tasks').insert(texts.map((text) => ({ text }))).select()`.

#### 2. Wire both routes to the shared function

**File**: `backend/src/routes/transcribe.ts` (replace lines 48-52), `backend/src/routes/tasks.ts` (replace lines 53-57)

**Intent**: Both routes call `insertTasks(supabase, texts)` instead of building the insert inline. No behavior change — same `texts` variable each route already computes, same `{ data, error }` destructuring and error branch already present in both handlers.

**Contract**: Import `insertTasks` from `../db/tasks`. Delete the inline `.from('tasks').insert(...).select()` chain, replace with the function call. Existing `if (error) return c.json(...)` branches in both files stay exactly as they are.

#### 3. Test double records insert arguments

**File**: `backend/test/support/fake-supabase.ts`

**Intent**: Let a test assert what `insertTasks` actually sent to Supabase, closing the "fake doesn't inspect arguments" gap from research.md — but only for `insert`, since that's what this plan's test needs; `update`/`eq`/`ilike` stay as they are (out of scope, per "What We're NOT Doing").

**Contract**: `insert` becomes `insert: (rows: unknown) => { calls.insert.push(rows); return builder; }`, where `calls` is a new field returned alongside the client (e.g. `{ client, calls }` from `createFakeSupabaseClient`, or `calls` attached to the returned object — match whatever shape keeps `tasks.test.ts`'s existing `createFakeSupabaseClient(...)` call sites working unchanged, since they don't use the second return value today and shouldn't need to). Verify `tasks.test.ts`, `auth-gate.test.ts`, `db-check.test.ts` still pass unmodified after this change — none of them assert on `insert`'s return value beyond chaining, per the current-state research.

#### 4. New unit test

**File**: `backend/test/db-tasks.test.ts` (new)

**Intent**: Directly test `insertTasks` against the (now arg-recording) fake — assert the exact row shape sent to `.insert()` for a given `texts` input (e.g. `['buy milk', 'call mom']` → `[{ text: 'buy milk' }, { text: 'call mom' }]`), and that `{ data, error }` from the fake passes through unchanged.

**Contract**: New `describe('insertTasks', ...)` block, 2-3 `it()` cases: correct row shape for multiple texts, correct shape for a single text, and error pass-through when the fake is configured to return an error (check how other tests in this file configure the fake for an error case, e.g. `tasks.test.ts`'s existing error-path test, and follow the same pattern).

### Success Criteria:

#### Automated Verification:

- [ ] `cd backend && npm run typecheck` passes
- [ ] `cd backend && npm test` passes, including the new `db-tasks.test.ts` and all pre-existing suites (`tasks.test.ts`, `auth-gate.test.ts`, `db-check.test.ts`, `idor.test.ts`, `health.test.ts`) unchanged in behavior

#### Manual Verification:

- [ ] `POST /transcribe` and `POST /tasks` still create tasks correctly against a real Supabase instance (local `.dev.vars` + `wrangler dev`, one manual call to each endpoint)

---

## Testing Strategy

### Unit Tests:

- New: `insertTasks` row-shape and error-passthrough cases (Phase 2, item 4).
- Existing (unchanged, must stay green): `tasks.test.ts` (15 cases), `auth-gate.test.ts` (5), `db-check.test.ts` (2), `idor.test.ts` (2, network-gated), `health.test.ts` (1).

### Integration Tests:

- None added — this plan is a mechanical extraction with an identical HTTP contract; existing route-level tests in `tasks.test.ts`/`auth-gate.test.ts` already exercise `POST /tasks` end-to-end through the fake and remain the integration coverage for that route. `transcribe.ts` still has no route-level test (that gap is `test-plan.md` Phase 2, explicitly out of scope here — see research.md's non-candidate list).

### Manual Testing Steps:

1. Run `wrangler dev` locally, call `POST /tasks` with a text body, confirm a row is created.
2. Call `POST /transcribe` with a short audio file, confirm the returned tasks match what Whisper/Claude produced and are visible via `GET /tasks`.

## Performance Considerations

None — this is a pure code-motion refactor, no new network calls, no change to query shape.

## Migration Notes

Not applicable — no schema or data changes.

## References

- Related research: `context/changes/refactor-opportunities/research.md` (ranking, evidence, ast-grep verification)
- Prior research: `context/changes/voice-task-pipeline/research.md` (original technical-debt findings)
- `context/map/repo-map.md` (Wide Scan this Deep Focus traces back to)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend typecheck as a blocking CI step

#### Automated

- [ ] 1.1 `cd backend && npm run typecheck` exits 0 locally
- [ ] 1.2 CI workflow YAML is valid (verified by the next PR's Actions run)

#### Manual

- [ ] 1.3 Confirm the `Typecheck` step appears in `backend-tests` and passes in the Actions run

### Phase 2: Extract shared `insertTasks` helper

#### Automated

- [ ] 2.1 `cd backend && npm run typecheck` passes
- [ ] 2.2 `cd backend && npm test` passes, including new `db-tasks.test.ts` and all pre-existing suites unchanged

#### Manual

- [ ] 2.3 `POST /transcribe` and `POST /tasks` still create tasks correctly against a real Supabase instance
