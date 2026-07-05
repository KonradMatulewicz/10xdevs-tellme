# Backend Test Foundation — Plan Brief

> Full plan: `context/changes/testing-backend-test-foundation/plan.md`
> Research: `context/changes/testing-backend-test-foundation/research.md`

## What & Why

Stand up a test runner for the `backend/` Cloudflare Worker — which has none today — and build a routing/CRUD/authorization safety net for it. This is Phase 1 of the frozen `context/foundation/test-plan.md` rollout, closing risk #2 (Worker regressions ship undetected) and risk #3 (a user could read/mutate another user's task — IDOR).

## Starting Point

`backend/` (a Hono REST API for task CRUD + voice transcription) has zero test tooling: no runner, no `test`/`typecheck` script, and it's entirely outside CI. The frontend already went through this exact bootstrap (`complete-auth-oauth-reset`, Jest + jest-expo); this does the equivalent for the Worker.

## Desired End State

`backend/` has a working `npm test` (Vitest running inside the real `workerd` runtime via `@cloudflare/vitest-pool-workers`) and `npm run typecheck`. The suite covers every `/tasks` route path, `/health`/`/db-check`, the 401 auth-gate on all protected routes, and — against a dedicated Supabase test project — a real test proving one user cannot access another user's task.

## Key Decisions Made

| Decision                  | Choice                                                          | Why (1 sentence)                                                                                                                                                                  | Source                  |
| ------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Test runner               | Vitest + `@cloudflare/vitest-pool-workers`                      | Runs tests inside real `workerd`, catching runtime-specific breakage (e.g. the documented Supabase fetch-override requirement) that Jest under Node can't see.                    | Plan                    |
| Supabase testing strategy | Hybrid — mock for CRUD/routing, real Supabase for authorization | Mocking is cheap and fine for route logic, but a mock can't honestly prove RLS enforcement; test-plan explicitly flags "assuming RLS is sufficient" as the anti-pattern to avoid. | Plan                    |
| Authz test infrastructure | Dedicated second Supabase project                               | Keeps test runs from ever touching real user data or being subject to production rate limits.                                                                                     | Plan                    |
| Fixture users             | Two fixed long-lived accounts, no service-role/Admin API        | Tests authenticate exactly like the app does — no new credential class the runtime code never uses.                                                                               | Plan                    |
| CRUD coverage depth       | Full route surface (all statuses, filters, error paths)         | Partial coverage would leave exactly the routing/CRUD regressions this phase exists to close.                                                                                     | Plan                    |
| Backend typecheck         | Add a `typecheck` script now                                    | Near-zero marginal cost while bootstrapping tooling anyway; the new test files need it to be trustworthy.                                                                         | Plan                    |
| CI wiring                 | Out of scope for this phase                                     | Test-plan's Quality Gates table already places this gate as local-only, required after Phase 1 — CI blocking is explicitly Phase 5.                                               | Research / test-plan.md |

## Scope

**In scope:**

- Vitest + `@cloudflare/vitest-pool-workers` bootstrap for `backend/`
- Full `/tasks` route coverage (list filters/search, create single/batch, patch edit/status/not-found), `/health`, `/db-check`
- 401 auth-gate coverage on every protected route, including `/transcribe`
- A dedicated Supabase test project + two fixture users + a real cross-user (IDOR) authorization test

**Out of scope:**

- AI pipeline error-handling tests (Phase 2 of test-plan)
- Frontend auth-flow regression lock (Phase 3 of test-plan)
- CI wiring / merge-blocking (Phase 5 of test-plan)
- Extraction quality golden-set tests (Phase 4)
- Testing actual Whisper/Claude call success or failure in `/transcribe`
- Any change to the real/production Supabase project

## Architecture / Approach

Two Supabase testing strategies, split by what each can honestly prove: a fake, chainable Supabase-client double backs the CRUD/routing/validation suite (fast, hermetic, no network); a real, dedicated Supabase test project with two signed-in fixture users backs the one authorization test that a mock can't fake. Both run through the same harness — `exports.default.fetch()` calling the Worker's exported Hono app inside the actual `workerd` runtime via `@cloudflare/vitest-pool-workers`.

## Phases at a Glance

| Phase                                   | What it delivers                                                                          | Key risk                                                                                                                               |
| --------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Test runner bootstrap                | Vitest + vitest-pool-workers wired up, one smoke test passing                             | Vitest 4.x config API for Workers has changed before (`defineWorkersConfig` → `cloudflareTest()`) and may again                        |
| 2. Routing/CRUD/validation suite        | Full `/tasks` + `/health`/`/db-check` + 401 auth-gate coverage, mocked Supabase           | Mock/reality drift if the fake client's chain shape diverges from the real one                                                         |
| 3. Cross-user authorization (IDOR) test | Real test against a dedicated Supabase test project proving RLS rejects cross-user access | Requires a human to provision the test project, apply schema, and create fixture accounts — not something this agent can do unattended |

**Prerequisites:** For Phase 3, a Supabase account with permission to create a new (free) project.
**Estimated effort:** ~3 sessions across 3 phases; Phase 3 has an external human-setup dependency that can't be parallelized away.

## Open Risks & Assumptions

- `schema.sql` (Phase 3) is a best-effort reconstruction of the real project's `tasks` table/RLS policy from the PRD and route code — not introspected from the live project (no DB access from this session). The human must confirm it matches before applying it to the test project.
- The exact `@cloudflare/vitest-pool-workers` mechanism for isolating the test project's env vars from `backend/.dev.vars` needs verification against current docs at implementation time (flagged in the plan's Critical Implementation Details).

## Success Criteria (Summary)

- `npm test` and `npm run typecheck` both pass locally in `backend/`
- Every `/tasks` route path, `/health`, `/db-check`, and the 401 auth-gate are covered
- A real (not mocked) test proves User A cannot read or mutate User B's task
