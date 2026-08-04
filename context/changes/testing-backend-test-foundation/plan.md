# Backend Test Foundation Implementation Plan

## Overview

Stand up a test runner for the `backend/` Cloudflare Worker (which has none today) and build a routing/CRUD/authorization safety net for it. This is Phase 1 of `context/foundation/test-plan.md`'s rollout, closing risks #2 (undetected Worker regressions) and #3 (cross-user task access / IDOR).

## Current State Analysis

- `backend/` has zero test tooling: no runner, no `test`/`typecheck` script, no CI coverage (`.github/workflows/ci.yml` only touches the root Expo app's `src/`). Full inventory in `context/changes/testing-backend-test-foundation/research.md`.
- The Worker never uses the Supabase `service_role` key. `supabaseForToken` (`backend/src/supabase.ts:27-32`) forwards the caller's JWT so **RLS is what actually enforces per-user isolation** — the Worker's own auth middleware (`backend/src/middleware/auth.ts:13-22`) only checks for a well-formed `Bearer` header and does not verify the JWT itself.
- `context/foundation/infrastructure.md` documents a load-bearing `global: { fetch }` override needed for `@supabase/supabase-js` to work on `workerd` (risk register item #1) — any test harness must run inside the real Workers runtime to have a chance of catching a regression there, not just Node.
- No Supabase-side config (migrations/RLS policy files) exists anywhere in the repo — the real project's schema and RLS policy exist only in the live Supabase project, not as checked-in SQL.

## Desired End State

`backend/` has a working `npm test` (Vitest running inside `workerd` via `@cloudflare/vitest-pool-workers`) and `npm run typecheck`, both runnable locally. The test suite covers: every `/tasks` route path (list filters/search, create single/batch, patch edit/status/not-found), the `/health` and `/db-check` routes, the 401 auth-gate on every protected route, and — against a dedicated Supabase test project — a real cross-user authorization test proving User A cannot read or mutate User B's task.

Verify by running, from `backend/`: `npm test` and `npm run typecheck` — both exit 0.

### Key Discoveries:

- `backend/src/middleware/auth.ts:16-18` returns 401 **before** calling `supabaseForToken` — mocking the Supabase module has no effect on the auth-gate tests, so both concerns (routing/CRUD via mock, auth-gate via either mock or real) can share one test setup.
- `backend/src/routes/tasks.ts:84-87` maps a Postgres `PGRST116` (no row matched) to a 404 — this is the same code path RLS produces when a query legitimately can't see another user's row, so the cross-user test asserts against this existing 404 mapping rather than a new error shape.
- Cloudflare's current Vitest integration (Vitest 4.x) uses a `cloudflareTest()` Vite plugin (replacing the older `defineWorkersConfig`) and exposes `exports.default.fetch()` from `cloudflare:workers` to drive the Worker's exported handler in-process — this is the mechanism for both the mocked and real-Supabase tests.

## What We're NOT Doing

- AI pipeline error-handling tests (failed/malformed/empty transcription or extraction responses) — that's test-plan Phase 2, its own change.
- Frontend auth-flow regression lock (`src/lib/auth.tsx`'s `AuthProvider` methods) — that's test-plan Phase 3, its own change.
- Wiring these tests into CI so they block merges — test-plan's Quality Gates table places this gate as **local, required after Phase 1**; CI blocking is explicitly Phase 5's job.
- Extraction-quality golden-set tests — test-plan Phase 4.
- Testing whether the actual Whisper/Claude calls in `/transcribe` succeed or fail — only its 401 auth-gate is covered here; the AI-calling logic itself is Phase 2 scope.
- Any change to the real/production Supabase project's schema, data, or RLS policy.
- Adding ESLint config for `backend/` — only a `typecheck` script, per the confirmed scope.

## Implementation Approach

Three phases, each independently testable:

1. Bootstrap the Vitest + `@cloudflare/vitest-pool-workers` harness with one smoke test, proving the Worker runs inside the real runtime under test.
2. Build the full routing/CRUD/validation/auth-gate suite against a mocked Supabase client — cheap, hermetic, closes risk #2.
3. Provision a dedicated Supabase test project with two fixture users and write the one test that a mock cannot honestly provide: a real cross-user access attempt proving RLS (not a mock's assumption) rejects it — closes risk #3.

This follows test-plan's cost×signal principle: the expensive, real-network layer is reserved for the one thing a mock would be dishonest about (authorization enforcement); everything else stays fast and mocked.

## Critical Implementation Details

**Test-project environment isolation.** The real cross-user test (Phase 3) must bind `SUPABASE_URL`/`SUPABASE_ANON_KEY` to the dedicated test project, completely separate from `backend/.dev.vars` (which stays pointed at the real project for `wrangler dev`). Verify the current `@cloudflare/vitest-pool-workers` mechanism for this (a distinct wrangler config/environment, or an equivalent test-only var source) against the live docs at implementation time rather than assuming today's API — this integration's config surface has changed between major versions (e.g., `defineWorkersConfig` → `cloudflareTest()` in the Vitest 4 migration) and may change again.

## Phase 1: Test runner bootstrap

### Overview

Add Vitest + `@cloudflare/vitest-pool-workers` to `backend/`, wire `test`/`typecheck` scripts, and prove the harness works with one smoke test against `/health`.

### Changes Required:

#### 1. `backend/package.json`

**Intent**: Add the test/typecheck scripts and the two new devDependencies.

**Contract**: `devDependencies` gain `vitest` and `@cloudflare/vitest-pool-workers` (versions matched to the current Vitest 4.x-compatible release). `scripts` gain `"test": "vitest run"` and `"typecheck": "tsc --noEmit"`.

#### 2. `backend/vitest.config.ts` (new)

**Intent**: Configure Vitest to run inside the Workers runtime against this Worker's `wrangler.toml`.

**Contract**: Uses the `cloudflareTest()` plugin from `@cloudflare/vitest-pool-workers`, pointed at `backend/wrangler.toml` via `configPath`.

#### 3. `backend/test/tsconfig.json` (new)

**Intent**: Give test files the ambient Workers/Vitest types without polluting `backend/tsconfig.json`'s `src/**/*.ts` include.

**Contract**: Extends `../tsconfig.json`, adds `"types": ["@cloudflare/vitest-pool-workers/types"]`, includes `./**/*.ts`.

#### 4. `backend/test/env.d.ts` (new)

**Intent**: Type the `cloudflare:workers` `env` export against this Worker's actual `Env`.

**Contract**: `declare module "cloudflare:workers" { interface ProvidedEnv extends Env {} }`, importing `Env` from `../src/types`.

#### 5. `backend/test/health.test.ts` (new)

**Intent**: Prove the harness runs a real request through the exported Hono app inside `workerd`.

**Contract**: Calls `exports.default.fetch()` (from `cloudflare:workers`) against `GET /health`, asserts `200` and `{ ok: true }`.

### Success Criteria:

#### Automated Verification:

- `cd backend && npm install` completes with no errors
- `npm run test` passes (the one smoke test)
- `npm run typecheck` passes with zero errors

#### Manual Verification:

- `wrangler dev` in `backend/` still starts and serves `/health` as before — confirms the new devDependencies/config didn't disturb the existing dev workflow

---

## Phase 2: Routing/CRUD/validation suite (mocked Supabase)

### Overview

Cover the full `/tasks` route surface, `/db-check`, and the 401 auth-gate on every protected route, all against a mocked `@supabase/supabase-js` client — no network, no real project needed.

### Changes Required:

#### 1. `backend/test/support/fake-supabase.ts` (new)

**Intent**: A minimal fake Supabase client double supporting the exact chain shapes the routes use, so route logic can be exercised without a real client.

**Contract**: Supports `.from(table).select().order().eq().ilike()` resolving `{ data, error }`; `.from(table).insert(rows).select()` resolving `{ data, error }`; `.from(table).update(patch).eq('id', id).select().single()` resolving `{ data, error }`. Each test configures the double's canned response per call. `backend/test/setup.ts` (or per-test `vi.mock`) mocks `../src/supabase`'s `createSupabaseClient` and `supabaseForToken` to return this double instead of a real client.

#### 2. `backend/test/tasks.test.ts` (new)

**Intent**: Exercise every path through `backend/src/routes/tasks.ts`.

**Contract**: Cases —

- GET `/tasks`: no filter, each `status` value (`todo`/`done`/`deleted`), invalid `status` → 400, `q` search param applied via `ilike`.
- POST `/tasks`: single `text`, batch `texts[]`, empty/invalid body → 400, all-blank-after-trim texts → 400.
- PATCH `/tasks/:id`: text edit, status transition, invalid status → 400, empty patch (`{}`) → 400, simulated `PGRST116` (no row matched) → 404.

#### 3. `backend/test/auth-gate.test.ts` (new)

**Intent**: Prove `requireAuth` rejects every protected route without a valid bearer token, independent of Supabase.

**Contract**: For each of GET/POST/PATCH `/tasks` and POST `/transcribe`: missing `Authorization` header → 401; header present but not `Bearer `-prefixed → 401. `/health` and `/db-check` remain reachable with no header (control case).

#### 4. `backend/test/db-check.test.ts` (new)

**Intent**: Cover `/db-check`'s error/data shape mapping.

**Contract**: With the fake client returning `{ data: [], error: null }` → `{ ok: true, rows: 0, error: null }`; with `{ data: null, error: {message} }` → `{ ok: false, rows: 0, error: message }`.

### Success Criteria:

#### Automated Verification:

- `npm run test` (backend) passes, including all new suites
- `npm run typecheck` passes

#### Manual Verification:

- Spot-check one mocked case (e.g. an invalid `status` filter) against `wrangler dev` with a real `curl` request, confirming the mocked assertion matches live route behavior

---

## Phase 3: Cross-user authorization (IDOR) test against a real Supabase test project

### Overview

Prove the one thing a mock cannot honestly demonstrate: that User A's session cannot read or mutate User B's task. Requires a dedicated Supabase test project — a real, separate infrastructure resource — and is the only phase touching real network/Supabase state.

### Changes Required:

#### 1. Provision the test Supabase project (manual, human-run — not code)

**Intent**: A second free Supabase project, isolated from the real user-facing one, so test runs can never touch production data.

**Contract**: Human creates the project via the Supabase dashboard, applies the schema below, and creates two fixture accounts. The agent cannot perform this step — it requires dashboard/account access this session doesn't have.

#### 2. `backend/test/fixtures/schema.sql` (new)

**Intent**: A best-effort, checked-in DDL for the `tasks` table + RLS policy, so the test project (and any future one) can be seeded identically to the real project's shape, inferred from the PRD's Access Control section and the columns the routes actually read/write (`id`, `user_id`, `text`, `status`, `created_at`, `updated_at`).

**Contract**: `tasks` table with `user_id uuid not null default auth.uid() references auth.users`, `status text not null default 'todo' check (status in ('todo','done','deleted'))`, RLS enabled, single policy restricting all commands to `auth.uid() = user_id`. Flagged in this file's header comment as best-effort — the human must confirm it against the real project's actual schema (Supabase Studio → Table Editor → Definition) before applying, and correct any mismatch.

#### 3. `.dev.vars.test.example` (new, checked in)

**Intent**: Document the shape of the test-only secrets without committing real values, following the existing `.dev.vars` convention.

**Contract**: Keys `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`, `TEST_USER_A_EMAIL`, `TEST_USER_A_PASSWORD`, `TEST_USER_B_EMAIL`, `TEST_USER_B_PASSWORD`, each with a placeholder value.

#### 4. `.gitignore`

**Intent**: Keep the real, filled-in `backend/.dev.vars.test` out of version control.

**Contract**: Broaden the existing `.dev.vars` / `**/.dev.vars` entries (lines 36-38) to also match `.dev.vars.test` (e.g. `**/.dev.vars*`), or add an explicit `**/.dev.vars.test` line.

#### 5. `backend/test/authz.test.ts` (new)

**Intent**: The cross-user authorization test itself.

**Contract**: Setup signs in as fixture User A and User B via `@supabase/supabase-js`'s `signInWithPassword` against the test project's anon key, obtaining each session's access token. User A creates a task via a real `POST /tasks` call through `exports.default.fetch()`. The test then calls `GET /tasks/:id`-equivalent list-and-filter and `PATCH /tasks/:id` using **User B's** bearer token against User A's task id, asserting the response is a rejection (404, per the existing `PGRST116` mapping) rather than User A's data. A control case asserts User A can still read/edit their own task successfully with the same harness.

### Success Criteria:

#### Automated Verification:

- `npm run test` (backend) passes, including `authz.test.ts`, when `.dev.vars.test` is populated with real test-project values
- `npm run typecheck` passes

#### Manual Verification:

- Human has provisioned the dedicated Supabase test project, applied (and if necessary corrected) `schema.sql`, created the two fixture accounts, and filled in `.dev.vars.test`
- As a negative control, temporarily point the authz test's client at a service-role key instead of the anon+token client and confirm it now (wrongly) succeeds — proving the test would actually catch a future regression where the Worker starts using `service_role`, per test-plan's explicit warning not to assume "RLS alone is sufficient"

---

## Testing Strategy

### Unit Tests:

- Route validation logic (status enum checks, empty-body/empty-patch rejection, text trimming) — Phase 2.

### Integration Tests:

- Full request→response round trips through the exported Hono app inside `workerd`, both with a mocked Supabase client (Phase 2) and a real one (Phase 3).

### Manual Testing Steps:

1. After Phase 1: confirm `wrangler dev` still serves `/health` normally.
2. After Phase 2: `curl` one mocked case against `wrangler dev` to confirm parity between the mock's assumed shape and a live response.
3. After Phase 3: provision the test project and fixture users per the schema/env-example files; run the negative service-role control described above.

## Performance Considerations

None — this phase only adds test tooling; no production code path changes.

## Migration Notes

Not applicable — no data migration; `schema.sql` targets a new, separate Supabase project only.

## References

- Research: `context/changes/testing-backend-test-foundation/research.md`
- Governing test strategy: `context/foundation/test-plan.md` (§2 Risk Map risks #2/#3, §3 Phase 1, §5 Quality Gates)
- Supabase-on-workerd fetch override: `context/foundation/infrastructure.md` risk register item #1
- Existing auth middleware: `backend/src/middleware/auth.ts:13-22`
- Existing route handlers: `backend/src/routes/tasks.ts`, `backend/src/routes/transcribe.ts`
- Existing frontend test precedent: `src/lib/__tests__/recovery.test.ts` (colocated `__tests__`/`test/` convention, though backend uses a top-level `test/` dir per Cloudflare's own convention)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Test runner bootstrap

#### Automated

- [x] 1.1 `cd backend && npm install` completes with no errors — fc90f1b
- [x] 1.2 `npm run test` passes (the one smoke test) — fc90f1b
- [x] 1.3 `npm run typecheck` passes with zero errors — fc90f1b

#### Manual

- [x] 1.4 `wrangler dev` in `backend/` still starts and serves `/health` as before — fc90f1b

### Phase 2: Routing/CRUD/validation suite (mocked Supabase)

#### Automated

- [x] 2.1 `npm run test` (backend) passes, including all new suites — 571ffe8
- [x] 2.2 `npm run typecheck` passes — 571ffe8

#### Manual

- [ ] 2.3 Spot-check one mocked case against `wrangler dev` with a real `curl` request

### Phase 3: Cross-user authorization (IDOR) test against a real Supabase test project

#### Automated

- [ ] 3.1 `npm run test` (backend) passes, including `authz.test.ts`, with `.dev.vars.test` populated
- [ ] 3.2 `npm run typecheck` passes

#### Manual

- [ ] 3.3 Test Supabase project provisioned, `schema.sql` applied (and corrected if needed), fixture accounts created, `.dev.vars.test` filled in
- [ ] 3.4 Negative service-role control performed, confirming the test would catch a real RLS-bypass regression
