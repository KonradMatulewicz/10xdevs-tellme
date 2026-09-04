# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-07-05

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the team
   is worried about X, and the failure would surface somewhere in area Y"
   carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents _what
   could fail_ and _why we believe it's likely_ — drawn from documents,
   interview, and codebase _signal_ (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/`, `backend/src/`.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the _evidence that surfaced
this risk_ — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| #   | Risk (failure scenario)                                                                                                                                                                       | Impact | Likelihood | Source (evidence — not anchor)                                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Transcription/extraction fails or hangs without a distinct, actionable error state — user sees a silent empty list or stuck spinner instead                                                   | High   | High       | interview Q1, Q4; PRD US-01 acceptance criteria ("clear error state rather than silent empty list"); PRD NFR connectivity-resilience                                                                                             |
| 2   | Backend (Worker) regressions in routing/CRUD/transcribe ship to prod undetected — no backend test runner exists at all, and CI runs no test step (lint/typecheck/format only)                 | High   | High       | interview Q2, Q3; hot-spot dir `backend/src/` (index.ts + routes/, 7+ commits/30d); backend package manifest (no test runner); CI workflow (no test job)                                                                         |
| 3   | A request bearing one user's session accesses or mutates another user's task (authorization/IDOR) despite RLS at the data layer                                                               | High   | Medium     | PRD Access Control ("every authenticated user sees only their own tasks"); infrastructure doc (RLS + `user_id default auth.uid()`); hot-spot dir `backend/src/` (routes + middleware); abuse/security lens (authorization class) |
| 4   | Extraction quality (the 80%-no-correction success metric) silently drifts after a prompt/model change, with no signal until users notice bad output accumulating                              | High   | Medium     | PRD Success Criteria (80% no-correction requirement); roadmap baseline (extraction model pinned, but changeable)                                                                                                                 |
| 5   | An auth-flow regression reintroduces a silent dead-end (stuck spinner, permanently disabled button) via an unhandled promise rejection — the exact bug class just found 4x in one review pass | Medium | Medium     | prior implementation review findings (reset spinner, stale-code guard, Google sign-in busy-state); hot-spot dir `src/lib/` (auth.tsx, 3 commits/30d)                                                                             |

### Risk Response Guidance

| Risk | What would prove protection                                                                                                                                                                       | Must challenge                                                                                                                                | Context `/10x-research` must ground                                                                               | Likely cheapest layer                                                 | Anti-pattern to avoid                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| #1   | AI-call failure (network error, malformed response, timeout, empty transcript) always surfaces as a distinct error state, never a silent empty list or infinite spinner                           | "Every failure mode from the AI call is already caught" — verify, don't assume                                                                | Backend error-response shape from the transcribe route; frontend's handling of that error on the recording screen | integration (backend) + unit (frontend error-state render)            | Asserting against whatever the current catch block already does instead of the PRD's stated behavior                       |
| #2   | A change to Worker routing/CRUD/transcribe can't merge without a test exercising it, and CI blocks the merge on failure                                                                           | "Hono's route/middleware registration order does what the author intended" — don't assume, verify                                             | Route table and middleware order in the Worker entrypoint; realistic test harness for a Hono Worker               | integration, wired into a new CI job                                  | Treating typecheck as "tested" — it doesn't catch a wrong route path or missing auth middleware                            |
| #3   | User A's valid session cannot read/edit/delete User B's task — API returns rejection, not the other user's data                                                                                   | "RLS alone is sufficient" — the backend may query with a service-role key that bypasses RLS entirely                                          | Which Supabase client/key the backend uses for task queries; whether routes filter by `user_id` explicitly        | integration (two seeded users, cross-access attempt)                  | Testing only the happy path (own-task CRUD) and calling authorization "covered"                                            |
| #4   | A fixed reference-transcript set (multi-task, single-task, empty/silence, non-task rambling) produces stable, reviewable extraction output; prompt/model changes are caught by diffing against it | "Current output for these transcripts is the correct baseline" — must be checked against the PRD's extraction rule first, not assumed correct | Extraction prompt/logic; a realistic small reference set                                                          | AI-native golden-set regression, run at lower cadence than per-commit | Byte-exact snapshot against live model output — non-determinism makes it flaky; assert structural/count properties instead |
| #5   | Every async auth method (signIn, signInWithGoogle, signOut, resetPassword, exchangeCodeForSession, getSession) resolves loading/busy state on both success and rejection                          | "The fixes just applied are permanent" — a future edit could silently drop a `.catch`/`.finally`                                              | Current auth-provider flow post-fixes; rejection scenarios worth simulating                                       | unit (mocked Supabase client rejecting per method)                    | Asserting "the function was called" instead of asserting the state machine reaches a non-loading terminal state            |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| #   | Phase name                                 | Goal (one line)                                                                    | Risks covered | Test types             | Status        | Change folder                                    |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------------- | ------------- | ---------------------- | ------------- | ------------------------------------------------ |
| 1   | Backend test foundation + route safety net | Stand up a Worker test runner; cover routing/CRUD and task-ownership authorization | #2, #3        | integration            | change opened | context/changes/testing-backend-test-foundation/ |
| 2   | AI pipeline error-handling coverage        | Failed/malformed/empty AI responses surface a clear error, backend and frontend    | #1            | integration + unit     | not started   | —                                                |
| 3   | Auth regression lock                       | Lock in the just-fixed dead-end bugs so they can't silently regress                | #5            | unit                   | not started   | —                                                |
| 4   | Extraction quality golden-set (AI-native)  | Reference-transcript regression check for the 80% success metric                   | #4            | AI-native / golden-set | not started   | —                                                |
| 5   | Quality-gates wiring                       | Wire frontend + new backend tests into CI so they actually block merges            | cross-cutting | gates                  | not started   | —                                                |

**Status vocabulary** (fixed — parser literals):

| Value           | Meaning                                                             |
| --------------- | ------------------------------------------------------------------- |
| `not started`   | No change folder for this rollout phase yet.                        |
| `change opened` | `context/changes/<id>/` exists with `change.md`; research not done. |
| `researched`    | `research.md` exists in the change folder.                          |
| `planned`       | `plan.md` exists with a `## Progress` section.                      |
| `implementing`  | Progress section has at least one `[x]` and at least one `[ ]`.     |
| `complete`      | Progress section is fully `[x]`.                                    |

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.

| Layer                         | Tool                                           | Version                   | Notes                                                                                     |
| ----------------------------- | ---------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| unit + integration (frontend) | Jest + jest-expo                               | 29 / SDK 57               | Configured in package.json; 4 tests in `src/lib/__tests__/`                               |
| unit + integration (backend)  | none yet — see Phase 1                         | —                         | Cloudflare Worker has zero test runner today; Phase 1 selects a Workers-compatible runner |
| API mocking                   | none yet — see Phase 1                         | —                         | Mock AI calls (Whisper/Claude) at the network edge for error-path tests                   |
| e2e                           | not planned                                    | —                         | Interview Q5 explicitly excludes full OAuth e2e automation; manual smoke remains          |
| (optional) AI-native          | golden-set extraction regression — see Phase 4 | n/a — checked: 2026-07-05 | Only justified once cheaper deterministic layers (Phases 1–3) exist                       |

**Stack grounding tools (current session):**

- Docs: Cloudflare-specific docs/observability MCPs available; no generic framework-docs MCP (no Context7) — checked: 2026-07-05
- Search: none available in current session — checked: 2026-07-05
- Runtime/browser: none available — no Playwright/browser MCP in this session; checked: 2026-07-05
- Provider/platform: Cloudflare (Workers/observability bindings), Linear, Expo — Cloudflare observability could later back a transcription-pipeline health gate; checked: 2026-07-05

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required after §3 Phase N" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate                                                | Where                   | Required?                 | Catches                                                |
| --------------------------------------------------- | ----------------------- | ------------------------- | ------------------------------------------------------ |
| lint + typecheck                                    | local + CI              | required                  | syntactic / type drift                                 |
| format check                                        | local + CI              | required                  | style drift                                            |
| backend integration (routing/CRUD/authz)            | local                   | required after §3 Phase 1 | routing, CRUD, and IDOR regressions                    |
| AI pipeline error-path tests                        | local                   | required after §3 Phase 2 | silent-failure regressions in transcription/extraction |
| frontend auth unit tests                            | local                   | required after §3 Phase 3 | auth-flow dead-end regressions                         |
| AI-native golden-set (extraction)                   | CI on PR, lower cadence | optional                  | extraction quality drift                               |
| CI test gate (frontend + backend tests block merge) | CI on PR                | required after §3 Phase 5 | any of the above reaching master undetected            |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase N."

### 6.1 Adding a unit test (frontend)

- **Location**: `src/lib/__tests__/` next to the unit under test.
- **Naming**: `<module>.test.ts`.
- **Reference test**: `src/lib/__tests__/recovery.test.ts`.
- **Run locally**: `npm test`.

### 6.2 Adding a backend integration test

- TBD — see §3 Phase 1.

### 6.3 Adding a test for a new API endpoint

- TBD — see §3 Phase 1.

### 6.4 Adding an AI-native golden-set test

- TBD — see §3 Phase 4.

### 6.5 Per-rollout-phase notes

(Filled in as each rollout phase lands.)

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **UI snapshot/visual tests** — a 2-week solo MVP with fast-changing screens; snapshots would break constantly and catch nothing meaningful. Re-evaluate if the team grows or the UI stabilizes long-term. (Source: Phase 2 interview Q5.)
- **Full OAuth redirect e2e automation** — the Google Sign-In round trip through a real browser/deep-link is flaky and expensive to automate; manual smoke is sufficient. Re-evaluate if OAuth breaks in production undetected by manual smoke. (Source: Phase 2 interview Q5.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-07-05
- Stack versions last verified: 2026-07-05
- AI-native tool references last verified: 2026-07-05

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
