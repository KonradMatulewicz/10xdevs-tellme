---
date: 2026-07-05T00:00:00+02:00
researcher: Konrad Matulewicz
git_commit: 01be3313ce4c46218d03ce0fe77f1392e50ca80b
branch: master
repository: KonradMatulewicz/10xdevs-tellme
topic: 'What testing framework and coverage exist for the backend right now'
tags: [research, codebase, testing, backend, cloudflare-worker, jest, auth, supabase]
status: complete
last_updated: 2026-07-05
last_updated_by: Konrad Matulewicz
---

# Research: What testing framework and coverage exist for the backend right now

**Date**: 2026-07-05T00:00 (+02:00)
**Researcher**: Konrad Matulewicz
**Git Commit**: 01be3313ce4c46218d03ce0fe77f1392e50ca80b
**Branch**: master
**Repository**: KonradMatulewicz/10xdevs-tellme

## Research Question

What testing framework and coverage exist for the backend right now? (Scope confirmed with user: "backend" covers both (a) the Cloudflare Worker API under `backend/` and the client-side Supabase data/auth layer under `src/lib/`, and (b) any Supabase-side config such as migrations/RLS/edge functions.)

## Summary

There are **two distinct "backends"** in this repo, and their testing posture is very different:

1. **`src/lib/` — the Expo app's client-side Supabase data/auth layer.** Has a working Jest (`jest-expo`) setup with 4 test files / ~19 test cases, all pure-function unit tests. Coverage is good for `recovery.ts` and `auth-redirect.ts`, partial for `auth.tsx` (only the pure `mapAuthError` helper — the entire `AuthProvider` async surface, i.e. `signIn`/`signUp`/`signOut`/`signInWithGoogle`/`resetPassword`/`updatePassword`, is untested), and **zero** for `supabase.ts` (client config) and `api.ts` (all network-calling functions, including `authHeader`, `fetchTasks`, `updateTask`, `transcribe`).

2. **`backend/` — a separate Cloudflare Worker (Hono) REST API** that the Expo app calls for tasks CRUD and voice transcription. This is the actual "backend" that `context/foundation/test-plan.md` Phase 1 ("Backend test foundation" — the phase this change folder was opened for) targets. **It has zero test framework, zero test files, zero lint/typecheck scripts, and is entirely outside CI** — root CI only touches the Expo app's `src/`.

There is **no Supabase-side config** checked into the repo at all (no migrations, no RLS policy files, no `supabase/functions/` edge functions) — Supabase is used purely as a hosted BaaS via the JS SDK from both `src/lib/supabase.ts` (client) and `backend/src/supabase.ts` (server-side, per-request client with the caller's bearer token forwarded).

This change (`testing-backend-test-foundation`) is Phase 1 of `context/foundation/test-plan.md`'s rollout and is scoped to the Worker in `backend/` (routing/CRUD/authz — risks #2/#3 in the risk map), which currently has nothing to build on.

## Detailed Findings

### 1. `src/lib/` — Expo app data/auth layer (client-side "backend")

Test runner: **Jest 29 + `jest-expo` 54**, configured inline in root `package.json:57-65` (no separate `jest.config.js`):

```
preset: "jest-expo"
setupFiles: ["./jest.setup.js"]
testMatch: ["**/__tests__/**/*.test.ts?(x)"]
```

`jest.setup.js:4-6` mocks `@react-native-async-storage/async-storage` globally (the package's official jest mock) — this exists only so importing `supabase.ts` (which wires AsyncStorage as `auth.storage`) doesn't throw under Jest. **`@supabase/supabase-js` itself is never mocked** anywhere in the repo; no test exercises a mocked Supabase client.

Four test files, all colocated in `src/lib/__tests__/`:

| Test file                           | Source under test                                                                                                           | Cases | Notes                                                                                                                                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `smoke.test.ts` (6 lines)           | n/a                                                                                                                         | 1     | Verifies the runner works — `expect(true).toBe(true)`                                                                                                                                                |
| `auth-redirect.test.ts` (21 lines)  | `src/lib/auth-redirect.ts:11-13` (`authRedirectUrl`)                                                                        | 2     | Pure function, mocks `expo-linking`                                                                                                                                                                  |
| `map-auth-error.test.ts` (27 lines) | `src/lib/auth.tsx:27-40` (`mapAuthError`)                                                                                   | 4     | Pure function only; importing `auth.tsx` transitively runs real `createClient(...)` from `supabase.ts:20-28` at import time (no network call happens since only the pure helper is invoked)          |
| `recovery.test.ts` (67 lines)       | `src/lib/recovery.ts` — `extractRecoveryCode` (25-28), `extractAuthErrorDescription` (35-39), `validateNewPassword` (46-54) | 12    | Deep-link parsing edge cases (Expo Go vs standalone scheme, missing query/code, null/undefined/empty, `#fragment` stripping), error-description fallback, password validation (short/mismatch/valid) |

No `__mocks__/` directory exists anywhere in the repo, and no test uses `@testing-library/react-native` — so `AuthProvider`/`useAuth` (`src/lib/auth.tsx:44-127`) have **zero** rendering/state-machine test coverage.

**Coverage map by source file:**

| Source file                | Tested?             | Gap                                                                                                                                                                                                                  |
| -------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/auth-redirect.ts` | Yes                 | —                                                                                                                                                                                                                    |
| `src/lib/recovery.ts`      | Yes (all 3 exports) | —                                                                                                                                                                                                                    |
| `src/lib/auth.tsx`         | Partial             | Only `mapAuthError`; `AuthProvider`'s async methods (`signIn`, `signUp`, `signOut`, `signInWithGoogle`, `resetPassword`, `updatePassword`) are untested — this is exactly the surface `test-plan.md` Risk #5 targets |
| `src/lib/supabase.ts`      | No                  | Client construction (storage, PKCE flow, autoRefresh, `detectSessionInUrl: false`) untested                                                                                                                          |
| `src/lib/config.ts`        | No                  | Trivial env fallback, low risk                                                                                                                                                                                       |
| `src/lib/api.ts`           | No                  | `authHeader` (calls `supabase.auth.getSession()`), `parse`, `fetchTasks`, `updateTask`, `transcribe` (web vs native `FormData` branching) — all untested, including the "not authenticated" throw path               |

### 2. `backend/` — Cloudflare Worker (the actual server-side "backend")

Structure:

```
backend/
├── .dev.vars              # local secrets, gitignored/untracked
├── package.json / package-lock.json (own lockfile, not part of root install)
├── tsconfig.json           # standalone; root tsconfig.json excludes "backend"
├── wrangler.toml
└── src/
    ├── index.ts            # Hono app, CORS, /health, /db-check, route mounting
    ├── supabase.ts         # anon client + per-token client factories
    ├── types.ts            # Env bindings, Hono Variables, TaskStatus
    ├── ai/extract.ts        # Claude task-extraction call
    ├── ai/transcribe.ts     # Workers AI Whisper call
    ├── middleware/auth.ts   # requireAuth
    └── routes/tasks.ts, routes/transcribe.ts
```

**Routes** (`backend/src/index.ts:33-34` mounts `tasks` at `/tasks`, `transcribe` at `/transcribe`):

| Method | Path                | File:Line                    | Auth                                  |
| ------ | ------------------- | ---------------------------- | ------------------------------------- |
| GET    | `/health`           | `index.ts:23`                | none                                  |
| GET    | `/db-check`         | `index.ts:27-31`             | none (anon client connectivity probe) |
| GET    | `/tasks?status=&q=` | `routes/tasks.ts:21-37`      | `requireAuth`                         |
| POST   | `/tasks`            | `routes/tasks.ts:40-60`      | `requireAuth`                         |
| PATCH  | `/tasks/:id`        | `routes/tasks.ts:63-90`      | `requireAuth`                         |
| POST   | `/transcribe`       | `routes/transcribe.ts:19-56` | `requireAuth`                         |

**Auth middleware** (`backend/src/middleware/auth.ts:13-22`, `requireAuth`): checks for a `Bearer <token>` prefix only (401 if missing/malformed) and forwards the raw token to a per-request Supabase client (`supabaseForToken`, `backend/src/supabase.ts:27-32`). It **does not verify the JWT itself** — by design (comment at `auth.ts:7-11`): real validation and RLS enforcement happen downstream in Supabase/PostgREST, to avoid crypto cost against the Workers free-tier 10ms CPU cap. Applied per-router (`tasks.use('*', requireAuth)`, `transcribe.use('*', requireAuth)`), not globally — `/health` and `/db-check` are intentionally open.

**Test framework: none.** `backend/package.json` scripts are only `dev`, `dev:remote`, `deploy`, `tail`, `typegen` — no `test`, `lint`, or `typecheck` script. devDependencies are only `@cloudflare/workers-types` and `wrangler`; no `vitest`, `@cloudflare/vitest-pool-workers`, or `jest`. No `*.test.ts`/`*.spec.ts`/`__tests__`/`vitest.config.*` exists anywhere under `backend/`.

**CI never touches it**: `.github/workflows/ci.yml` runs `npm ci` (root only — backend has its own separate lockfile), `npm run lint` (Expo's `expo lint`, targets root `src/`), `npx tsc --noEmit` (uses root `tsconfig.json`, which explicitly excludes `backend`), and `npx prettier --check "src/**/*.{ts,tsx}"` (root `src/` glob only). Backend dependencies are never installed in CI, never linted, never typechecked, never tested.

**Bindings**: only `[ai]` (Workers AI, `wrangler.toml:8-9`) — no D1/KV/R2. Supabase URL/keys and the Anthropic key live in `backend/.dev.vars` (untracked, gitignored) rather than `wrangler.toml` `[vars]`; production secrets are presumably set via `wrangler secret put` (not verified — no evidence in-repo either way).

### 3. Supabase-side config

**None checked into the repo.** No `supabase/` directory, no `*.sql` migration files, no RLS policy files, no Postgres functions, no Supabase Edge Functions (Deno) anywhere tracked in git. (A `tools/10x-astro-starter/supabase/config.toml` exists but `tools/` is gitignored — vendored reference scaffold, zero files tracked, unrelated to this app.) Supabase is used exclusively as a hosted BaaS via the JS SDK on both sides.

## Code References

- `package.json:47-65` — root scripts + inline Jest config (`test: jest`, `jest-expo` preset)
- `jest.setup.js:4-6` — global AsyncStorage jest-mock (incidental plumbing, not a Supabase mock)
- `src/lib/__tests__/smoke.test.ts:1-6`
- `src/lib/__tests__/auth-redirect.test.ts:1-21`
- `src/lib/__tests__/map-auth-error.test.ts:1-27`
- `src/lib/__tests__/recovery.test.ts:1-67`
- `src/lib/auth.tsx:27-40` — `mapAuthError` (tested); `:44-127` — `AuthProvider`/`useAuth` (untested)
- `src/lib/supabase.ts:20-28` — `createClient(...)` config (untested)
- `src/lib/api.ts:9-65` — `authHeader`, `parse`, `fetchTasks`, `updateTask`, `transcribe` (all untested)
- `backend/package.json:1-12` — no test/lint/typecheck scripts, no test-framework devDependency
- `backend/wrangler.toml:1-13` — Worker config, `[ai]` binding only
- `backend/tsconfig.json` — standalone, excluded from root
- `backend/src/index.ts:13-36` — CORS, `/health`, `/db-check`, route mounting, 404 fallback
- `backend/src/middleware/auth.ts:7-22` — `requireAuth`, structural-only bearer check
- `backend/src/routes/tasks.ts:14-90` — CRUD routes, all behind `requireAuth`
- `backend/src/routes/transcribe.ts:16-56` — transcription route, behind `requireAuth`
- `.github/workflows/ci.yml:24-30` — lint/typecheck/format-check, root `src/` only, no `npm test`, no backend

## Architecture Insights

- Two independently-versioned, independently-configured codebases share one repo: the Expo app (root `package.json`/`tsconfig.json`, own lockfile) and the Worker (`backend/package.json`/`tsconfig.json`, own lockfile). Root tooling (CI, tsconfig `exclude`, ESLint) is scoped to the Expo app only — the Worker was bootstrapped without wiring it into any shared quality gate.
- The Worker's auth model deliberately pushes JWT validation to Supabase/PostgREST rather than verifying signatures in-Worker (CPU-budget tradeoff on the free tier). This means `requireAuth` unit tests can only usefully assert header-shape behavior (missing/malformed → 401); true authorization tests need either a mocked Supabase client or a live/staging Supabase project.
- On the client side, the existing Jest suite deliberately tests only pure, side-effect-free logic extracted out of `auth.tsx`/`recovery.ts`/`auth-redirect.ts` — no test mocks `@supabase/supabase-js`'s async methods, so nothing exercises `AuthProvider`'s actual Supabase calls or asserts loading/error state transitions end-to-end.

## Historical Context (from prior changes)

- `context/foundation/test-plan.md` (168 lines, current as of 2026-07-05) is the authoritative phased test-rollout plan:
  - §2 Risk Map, Risk #5 (line 46): auth-flow regression reintroducing a silent dead-end (stuck spinner, disabled button) via an unhandled promise rejection — sourced directly from `complete-auth-oauth-reset`'s impl-review findings (see below). Response guidance (line 56): every async `AuthProvider` method must resolve loading/busy state on both success and rejection, tested via a mocked Supabase client that rejects per method — this is currently **unimplemented** (Phase 3 "Auth regression lock", not started).
  - §3 Phased Rollout: Phase 1 "Backend test foundation" (the Worker's routing/CRUD/authz, risks #2/#3) has status `change opened` → this very folder, `context/changes/testing-backend-test-foundation/` — confirming this change is scoped to `backend/`, not `src/lib/`.
  - §4 Stack: frontend unit/integration = Jest + jest-expo, "4 tests in `src/lib/__tests__/`" (matches the inventory above exactly). Backend (the Worker) explicitly called out as having **no test runner at all**.
  - §5 Quality Gates: "frontend auth unit tests" gate is gated behind Phase 3 (not started) — only lint/typecheck/format-check are unconditionally required in CI today.
- `context/changes/complete-auth-oauth-reset/` (archived work, commits 950c015/154bc61/9cc8215/01be331):
  - `reviews/plan-review.md` originally flagged (CRITICAL) that the repo had no test runner at all before this change — its Phase 1 added `jest-expo` + the `test` script + the `__tests__/` convention.
  - `plan.md` Testing Strategy (lines 347-368) scoped unit tests to `authRedirectUrl`, `mapAuthError`, recovery deep-link extraction, and password validation only — explicitly no integration tests ("OAuth requires a real browser + Google... covered by Phase 3 manual e2e").
  - `reviews/impl-review.md` (2026-07-05, NEEDS ATTENTION → since fixed): findings F2/F3/F4/F8 were exactly the unhandled-promise-rejection/dead-spinner bug class in `auth.tsx`/`reset-password.tsx`/`recovery.ts` that motivated test-plan.md's Risk #5. `npm test` evidence at merge: 4 suites / 15 tests passing (recovery.test.ts has since grown to 12 cases per the current file, bringing the current total to ~19). Manual same-device password-reset verification is still pending (deferred due to Supabase free-tier email rate limiting) — a manual-verification gap, not an automated-coverage gap.

## Related Research

- `context/changes/complete-auth-oauth-reset/research.md` (if present) and `plan.md` — original Jest bootstrap and auth/recovery unit test scope.
- `context/foundation/test-plan.md` — governing document for this change's Phase 1 scope and the deferred Phase 3 auth-regression gate.

## Open Questions

- Should Phase 1 (this change) pick **Vitest with `@cloudflare/vitest-pool-workers`** (the Cloudflare-recommended runner, runs tests inside the actual `workerd` runtime) or reuse Jest for consistency with the Expo app, given the two codebases are otherwise fully independent? test-plan.md's plan-review precedent (for the Expo app) considered both vitest and jest-expo before settling on jest-expo for the app; no equivalent decision has been made for the Worker yet.
- Should CI be extended to install/lint/typecheck/test `backend/` as a second job, or does that belong to a later phase/change?
- `requireAuth`'s structural-only check means meaningful authz tests (e.g., "an expired/foreign-user token is rejected") require either a mocked Supabase client returning canned auth responses, or a test/staging Supabase project — worth deciding in the plan before writing tests.
- Live-looking keys were observed in `backend/.dev.vars` (untracked/gitignored, so not a repo leak, but flagged for local hygiene — not a testing-scope concern).
