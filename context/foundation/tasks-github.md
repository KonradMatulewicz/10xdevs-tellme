# GitHub Tasks

Generated from the GitHub issues created off `context/foundation/roadmap.md`.

- **Repo:** [KonradMatulewicz/10xdevs-tellme](https://github.com/KonradMatulewicz/10xdevs-tellme)
- **Milestone:** Tellme MVP (#1) — _Remaining work to a complete, shippable Tellme MVP._
- **Linear mirror:** [Tellme MVP](https://linear.app/konradotellme/project/tellme-mvp-e61cdf3d5737) (team Konrado) — issues KON-5–KON-10, with GitHub back-links, statuses, priorities, dependency relations, and labels.
- **Generated:** 2026-06-17

## Overview

| Issue                                                             | Roadmap | Title                                              | Stream                | Status      | State  | Depends on |
| ----------------------------------------------------------------- | ------- | -------------------------------------------------- | --------------------- | ----------- | ------ | ---------- |
| [#2](https://github.com/KonradMatulewicz/10xdevs-tellme/issues/2) | S-01    | Voice-to-task primary flow                         | A — Voice & task core | done ✅     | CLOSED | —          |
| [#3](https://github.com/KonradMatulewicz/10xdevs-tellme/issues/3) | S-03    | Email/password auth + logout                       | B — Account lifecycle | done ✅     | CLOSED | —          |
| [#5](https://github.com/KonradMatulewicz/10xdevs-tellme/issues/5) | S-02    | Task management across To-Do/Done/Deleted + search | A — Voice & task core | done ✅     | CLOSED | #2         |
| [#4](https://github.com/KonradMatulewicz/10xdevs-tellme/issues/4) | F-01    | Release & CI pipeline (auto-deploy + EAS build)    | D — Release & CI      | proposed 🏗️ | OPEN   | —          |
| [#6](https://github.com/KonradMatulewicz/10xdevs-tellme/issues/6) | S-04    | Complete auth: Google Sign-In + password reset     | B — Account lifecycle | ready ⭐    | OPEN   | #3         |
| [#7](https://github.com/KonradMatulewicz/10xdevs-tellme/issues/7) | S-05    | Pre-save review of extracted tasks                 | C — Review polish     | proposed    | OPEN   | #2         |

⭐ North star · 🏗️ Foundation enabler

## Open work

### [#6 · S-04] Complete auth: Google Sign-In + password reset ⭐

- **Change ID:** `complete-auth-oauth-reset` · **Status:** ready
- **Outcome:** User can sign in with Google and reset a forgotten password via email — completing the full auth surface the PRD requires.
- **PRD refs:** FR-001 (Google OAuth path), FR-002
- **Depends on:** #3 · **Parallel with:** F-01, S-05
- **Unknowns:** Google OAuth in Expo native via `expo-auth-session` / Supabase Auth — redirect/scheme setup + Google Cloud OAuth client config unexercised (non-blocking).
- **Next:** `/10x-plan complete-auth-oauth-reset`

### [#4 · F-01] Release & CI pipeline (auto-deploy + EAS build) 🏗️

- **Change ID:** `release-and-ci-pipeline` · **Status:** proposed
- **Outcome:** A repeatable ship path — merge to `master` auto-deploys the backend Worker, and an EAS Build produces an installable iOS/Android build for TestFlight / the App Store.
- **PRD refs:** Platform NFR; sourced from `tech-stack.md` (`deployment_target: appstore-via-eas`, `ci_default_flow: auto-deploy-on-merge`)
- **Depends on:** — · **Parallel with:** S-04, S-05 · **Unlocks:** device-level verification of US-01 / Platform NFR; faster shipping of S-04/S-05.
- **Blockers:** Apple Developer Program enrollment (~$99/yr) + App Store review — gate _publishing_, not pipeline setup.
- **Unknowns:** First EAS Build → submission flow unexercised; wiring `wrangler deploy` / EAS steps without leaking secrets (non-blocking).
- **Next:** `/10x-plan release-and-ci-pipeline`

### [#7 · S-05] Pre-save review of extracted tasks

- **Change ID:** `presave-task-review` · **Status:** proposed
- **Outcome:** User can review and inline-edit the extracted tasks before they are saved to the list.
- **PRD refs:** FR-007 (nice-to-have)
- **Depends on:** #2 · **Parallel with:** F-01, S-04
- **Unknowns:** Whether to insert a non-blocking review step into the auto-save happy path without slowing it (non-blocking).
- **Risk:** Deferrable polish — the only PRD nice-to-have; happy path already auto-saves (FR-008) with post-save edit (FR-010).
- **Next:** `/10x-plan presave-task-review`

## Completed (closed at creation — done before the roadmap existed)

### [#2 · S-01] Voice-to-task primary flow

- **Change ID:** `voice-to-task-flow`
- **Outcome:** Record a voice note and, within 10s of stopping, see an auto-saved task list with each spoken item as a separate task.
- **PRD refs:** US-01, FR-003, FR-004, FR-005, FR-006, FR-008
- **Residual:** Connectivity-resilience NFR (clear error on weak connection) tracked as a non-blocking unknown.

### [#3 · S-03] Email/password auth + logout

- **Change ID:** `email-password-auth`
- **Outcome:** Register, sign in with email + password, and log out.
- **PRD refs:** FR-001 (email/password path), FR-013 · Google OAuth portion is S-04.

### [#5 · S-02] Task management across To-Do/Done/Deleted + search

- **Change ID:** `task-management-tabs`
- **Outcome:** Edit, mark done, soft-delete (and restore), and keyword-search tasks across the To-Do, Done, and Deleted tabs.
- **PRD refs:** US-02, FR-009, FR-010, FR-011, FR-012, FR-014 · **Depends on:** #2
