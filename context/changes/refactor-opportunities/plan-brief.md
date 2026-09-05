# Refactor opportunities (C1 + CI typecheck) — Plan Brief

> Full plan: `context/changes/refactor-opportunities/plan.md`
> Research: `context/changes/refactor-opportunities/research.md`

## What & Why

Extract the duplicated `tasks` insert (identical code copy-pasted between `backend/src/routes/transcribe.ts` and `backend/src/routes/tasks.ts`) into one shared function, and turn on `backend`'s existing (but never-run-in-CI) typecheck script as a blocking gate. This is the top-ranked, lowest-risk item from `refactor-opportunities/research.md`'s ranking of four candidates found in the voice-to-task pipeline's technical debt.

## Starting Point

Both routes independently build `supabase.from('tasks').insert(texts.map(text => ({text}))).select()` — copied once in June 2026, never touched since. Nothing catches a future drift between the two copies: the test double (`fake-supabase.ts`) doesn't inspect insert arguments, and no CI job currently typechecks `backend/src` at all (root config excludes it, and the backend CI job only runs `vitest`, never its own `typecheck` script). Verified this session: that typecheck script passes cleanly today, so there's no pre-existing breakage to fix first.

## Desired End State

One function, `insertTasks()`, is the only place either route builds that insert — both call it. A new test asserts the exact row shape it sends. CI fails the build if `backend/src` or `backend/test` ever has a type error.

## Key Decisions Made

| Decision                | Choice                                                 | Why (1 sentence)                                                                                                                                    | Source                |
| ----------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Which candidate to fix  | C1 (shared insert) + CI typecheck prerequisite         | Highest value, lowest risk, unblocks safer future work on the other three candidates                                                                | Research + user       |
| Helper location         | New `backend/src/db/tasks.ts`                          | Clear boundary, natural home for later data-access work (e.g. C4's typed client) without being in scope now                                         | Plan (user confirmed) |
| New test for the helper | Yes — record insert args in the fake, assert row shape | Closes the exact safety-net gap research.md flagged; fake previously couldn't catch a broken extraction                                             | Plan (user confirmed) |
| CI typecheck gate       | Blocking immediately (no non-blocking trial period)    | Baseline verified clean this session — zero risk of blocking existing work                                                                          | Plan (user confirmed) |
| C2/C3/C4                | Deferred, not in this plan                             | User chose the narrow, lowest-risk scope; each needs its own prerequisite work (shared-type mechanism, observability config, live Supabase project) | Research + user       |

## Scope

**In scope:**

- New `backend/src/db/tasks.ts` with `insertTasks()`
- Both routes call it instead of duplicating the insert
- `fake-supabase.ts` records `insert()` arguments
- New unit test for `insertTasks`
- `backend-tests` CI job gets a blocking `npm run typecheck` step

**Out of scope:**

- `TaskStatus` duplication (C2), insert-failure logging (C3), typed `Database` generic (C4) — all deferred
- Any change to `POST /tasks`'s body parsing or `transcribe.ts`'s extraction logic
- Root `lint-typecheck` CI job — stays scoped to the frontend, `backend` exclusion in root `tsconfig.json` is correct and unchanged

## Architecture / Approach

Pure code-motion refactor plus one CI addition. No new runtime dependencies, no schema change, no HTTP contract change — both routes keep their exact current error-handling branches, only the insert call itself moves into a shared function.

## Phases at a Glance

| Phase                          | What it delivers                                     | Key risk                                                                                      |
| ------------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1. CI typecheck gate           | `backend-tests` fails on type errors                 | None — baseline verified clean this session                                                   |
| 2. Shared `insertTasks` helper | One function, both routes use it, new test covers it | Test-double change (`fake-supabase.ts`) must stay backward compatible with 3 other test files |

**Prerequisites:** None — baseline (typecheck + tests) is green today, verified directly.
**Estimated effort:** ~1 session, two small, independently-revertible commits.

## Open Risks & Assumptions

- `fake-supabase.ts`'s new arg-recording shape must not change any existing call site's behavior in `tasks.test.ts`/`auth-gate.test.ts`/`db-check.test.ts` — Phase 2's automated verification (full `npm test` run) is the actual check for this, not just reasoning about it in advance.
- Manual verification against a real Supabase instance (`wrangler dev`) is the only way to confirm end-to-end behavior, since no test currently exercises `transcribe.ts`'s route through to a real database (a known, separately-tracked gap — `test-plan.md` Phase 2).

## Success Criteria (Summary)

- `cd backend && npm run typecheck && npm test` green locally, including the new test.
- CI's `backend-tests` job shows a passing `Typecheck` step.
- Both `POST /transcribe` and `POST /tasks` still create tasks correctly when manually verified.
