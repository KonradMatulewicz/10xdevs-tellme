---
project: Tellme
version: 1
status: draft
created: 2026-06-17
updated: 2026-06-17
prd_version: 1
main_goal: speed
top_blocker: skills
---

# Roadmap: Tellme

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline (2026-06-17).
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.
>
> **Provenance note on `done` items.** S-01, S-02, and S-03 were implemented and verified
> _before_ this roadmap existed (see `context/deployment/deploy-plan.md`, 2026-06-12, and git
> history `831452a` / `7aaf97ce`). They are recorded here with `Status: done` for full PRD
> traceability at the user's request — **not** via `/10x-archive` (no change folder was archived).
> The `## Done` section below stays empty per the foundation-doc convention; `/10x-archive`
> remains its sole writer.

## Vision recap

Voice memos are fast to record but slow to process — the friction lives entirely in the step
between speaking and having an actionable, editable task list. Tellme collapses that step: the
user records a voice note, and within ten seconds gets a structured, editable task list, with at
least 80% of tasks needing no correction. The core hypothesis — that spoken words already contain
everything needed to produce a clean task list — is the product's entire value.

As of 2026-06-17 the core of that flow is already built, deployed, and verified end-to-end
(recording → Workers AI transcription → Claude extraction → auto-save → three-tab task management,
3.9s measured). This roadmap therefore sequences the **remaining gaps to a complete, shippable
MVP**, biased toward **speed**: finish the authentication surface, expose the optional pre-save
review, and (when ready) ship to real devices.

## North star

**S-04: Complete authentication (Google Sign-In + password reset)** — it is the last functional
gap before any user (including you on a fresh device) can fully onboard, and unlike App Store
release it is pure software with no external gate, so it is the fastest path to "the product works
for any user."

> _North star_ here means the smallest end-to-end, user-visible slice whose delivery would prove
> the product works for a real user — placed as early as its prerequisites allow because the rest
> only matters once it lands. The voice-to-task core that classically _would_ be the north star is
> already built (S-01), so the remaining validation milestone is completing onboarding.

## At a glance

| ID   | Change ID                 | Outcome (user can …)                                                                          | Prerequisites | PRD refs                                      | Status   |
| ---- | ------------------------- | --------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------- | -------- |
| F-01 | release-and-ci-pipeline   | (foundation) ship repeatably — merges auto-deploy backend; EAS build installs on real devices | —             | NFR Platform, tech-stack (EAS + auto-deploy)  | proposed |
| S-01 | voice-to-task-flow        | record a voice note and get an auto-saved task list in <10s                                   | —             | US-01, FR-003, FR-004, FR-005, FR-006, FR-008 | done     |
| S-02 | task-management-tabs      | edit, complete, soft-delete and search tasks across three tabs                                | S-01          | US-02, FR-009, FR-010, FR-011, FR-012, FR-014 | done     |
| S-03 | email-password-auth       | register, sign in with email/password, and log out                                            | —             | FR-001, FR-013                                | done     |
| S-04 | complete-auth-oauth-reset | sign in with Google and reset a forgotten password                                            | S-03          | FR-001, FR-002                                | ready    |
| S-05 | presave-task-review       | review and inline-edit extracted tasks before they are saved                                  | S-01          | FR-007                                        | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme             | Chain           | Note                                                                    |
| ------ | ----------------- | --------------- | ----------------------------------------------------------------------- |
| A      | Voice & task core | `S-01` → `S-02` | Built and live; foundation the rest builds on.                          |
| B      | Account lifecycle | `S-03` → `S-04` | `S-04` is the north star; `S-03` already done.                          |
| C      | Review polish     | `S-05`          | Optional (FR-007 nice-to-have); parked under the speed goal.            |
| D      | Release & CI      | `F-01`          | Standalone release/deploy enabler; gated externally (Apple enrollment). |

## Baseline

What's already in place in the codebase as of `2026-06-17` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Expo Router app: sign-in screen plus a home screen with record button, three tabs (To-Do/Done/Deleted), keyword search, and inline edit (`src/app/index.tsx`, `src/app/sign-in.tsx`).
- **Backend / API:** present — Hono Worker live at `tellme-backend.konrad-matulewicz1.workers.dev`; `/tasks` CRUD, `/transcribe`, `/health`, `/db-check` (`backend/src/`).
- **Data:** present — Supabase `public.tasks` with RLS and `user_id default auth.uid()` (`src/lib/supabase.ts`, `backend/src/supabase.ts`).
- **Auth:** partial — Supabase email/password sign-up / sign-in / logout wired (`src/lib/auth.tsx`); Google OAuth and password reset are **absent** (`supabase.ts`: "no web OAuth redirect handling in the native app yet").
- **AI pipeline:** present — Workers AI Whisper transcription + Claude `claude-opus-4-8` extraction, auto-save, raw audio not persisted; verified 3.9s end-to-end (`backend/src/ai/`, `backend/src/routes/transcribe.ts`).
- **Deploy / infra:** partial — backend deployed to Cloudflare Workers; CI runs lint/typecheck/format only (`.github/workflows/ci.yml`) — no auto-deploy, no staging env; mobile app not yet on the App Store (EAS deferred).
- **Observability:** absent — no Sentry/OTel; `deploy-plan.md` flags an external error sink as future work. No PRD NFR requires it for MVP, so no foundation is opened for it.

## Foundations

### F-01: Release & CI pipeline

- **Outcome:** (foundation) a repeatable ship path exists — a merge to `master` auto-deploys the backend Worker (replacing manual `wrangler deploy`), and an EAS Build produces an installable iOS/Android build for TestFlight / the App Store.
- **Change ID:** release-and-ci-pipeline
- **PRD refs:** NFR (Platform — "accessible on iOS and Android mobile devices as its primary platform"); sourced also from `tech-stack.md` (`deployment_target: appstore-via-eas`, `ci_default_flow: auto-deploy-on-merge`).
- **Unlocks:** the named verification path for the mobile-first guardrail (US-01 / Platform NFR can only be fully verified on real devices via TestFlight/App Store, beyond Expo Go); and faster shipping of S-04 / S-05 by removing the manual deploy step.
- **Prerequisites:** —
- **Parallel with:** S-04, S-05
- **Blockers:** Apple Developer Program enrollment (external, ~$99/yr) and App Store review turnaround — gate _publishing_, not pipeline setup.
- **Unknowns:**
  - First EAS Build → submission flow is unexercised (the `skills` top-blocker concentrates here). Owner: user. Block: no.
  - Wiring `wrangler deploy` / EAS steps into the existing workflow without leaking secrets (EAS vs Wrangler secret systems are separate). Owner: user. Block: no.
- **Risk:** This is the team's first native-release path, so the `skills` blocker lives here; keep it to the minimal pipeline (one deploy step + one EAS build), not production-grade infra. Publishing publicly is best done after S-04 so the store build is fully onboardable; staying on Expo Go remains a valid interim per the SDK-54 testing setup. No prerequisites, so it can be set up in parallel with the auth work.
- **Status:** proposed

## Slices

### S-01: Voice-to-task primary flow

- **Outcome:** user can record a voice note and, within 10 seconds of stopping, see an auto-saved task list with each spoken item as a separate task.
- **Change ID:** voice-to-task-flow
- **PRD refs:** US-01, FR-003, FR-004, FR-005, FR-006, FR-008
- **Prerequisites:** —
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:**
  - Connectivity-resilience NFR (clear error on 3G/weak WiFi rather than silent hang) — currently best-effort via error banners; residual hardening. Owner: user. Block: no.
- **Risk:** Implemented & verified pre-roadmap (`deploy-plan.md` 2026-06-12, git `6876ddc` backend pipeline + `831452a` mobile capture; 3.9s e2e). Marked `done` for traceability — not via `/10x-archive`. Remaining exposure is degraded-connection robustness, tracked as a non-blocking unknown.
- **Status:** done

### S-02: Task management across tabs

- **Outcome:** user can edit, mark done, soft-delete (and restore), and keyword-search tasks across the To-Do, Done, and Deleted tabs.
- **Change ID:** task-management-tabs
- **PRD refs:** US-02, FR-009, FR-010, FR-011, FR-012, FR-014
- **Prerequisites:** S-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Implemented & verified pre-roadmap (`deploy-plan.md` 2026-06-12, 16/16 backend checks; git `200a433` CRUD API + `831452a` mobile UI). Marked `done` for traceability — not via `/10x-archive`.
- **Status:** done

### S-03: Email/password authentication

- **Outcome:** user can register, sign in with email + password, and log out.
- **Change ID:** email-password-auth
- **PRD refs:** FR-001 (email/password path), FR-013
- **Prerequisites:** —
- **Parallel with:** S-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Implemented & verified pre-roadmap (`src/lib/auth.tsx`; Supabase Auth + RLS, git `831452a`). Marked `done` for traceability — not via `/10x-archive`. Covers only the email/password + logout portion of FR-001; the Google OAuth portion is S-04.
- **Status:** done

### S-04: Complete authentication (Google Sign-In + password reset)

- **Outcome:** user can sign in with Google and reset a forgotten password via email — completing the full auth surface the PRD requires.
- **Change ID:** complete-auth-oauth-reset
- **PRD refs:** FR-001 (Google OAuth path), FR-002
- **Prerequisites:** S-03
- **Parallel with:** F-01, S-05
- **Blockers:** —
- **Unknowns:**
  - Google OAuth in an Expo native app via `expo-auth-session` / Supabase Auth — redirect/scheme setup and the Google Cloud OAuth client config are unexercised. Owner: user. Block: no (resolved approach per `tech-stack.md`; standard Supabase config, learnable).
- **Risk:** North star. Skills blocker concentrates here — first time wiring native OAuth redirects. Sequenced immediately after the done email/password base (S-03) so onboarding is complete before any public release (S-06). Risk is config friction (redirect URIs), not architecture.
- **Status:** ready

### S-05: Pre-save review of extracted tasks

- **Outcome:** user can review and inline-edit the extracted tasks before they are saved to the list.
- **Change ID:** presave-task-review
- **PRD refs:** FR-007
- **Prerequisites:** S-01
- **Parallel with:** F-01, S-04
- **Blockers:** —
- **Unknowns:**
  - Whether to insert a non-blocking review step into the existing auto-save happy path without slowing it. Owner: user. Block: no.
- **Risk:** FR-007 is nice-to-have, and the happy path already auto-saves (FR-008) with post-save edit available (FR-010). Under the speed goal this is deferrable polish; included as a slice for completeness but not part of the must-have feature set required for launch (FR-007 is the PRD's only nice-to-have).
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                 | Suggested issue title                              | Ready for `/10x-plan` | Notes                                                  |
| ---------- | ------------------------- | -------------------------------------------------- | --------------------- | ------------------------------------------------------ |
| F-01       | release-and-ci-pipeline   | Release & CI pipeline (auto-deploy + EAS build)    | yes                   | No prereqs; publishing gated by Apple enrollment       |
| S-01       | voice-to-task-flow        | Voice-to-task primary flow                         | no                    | Done (built pre-roadmap)                               |
| S-02       | task-management-tabs      | Task management across To-Do/Done/Deleted + search | no                    | Done (built pre-roadmap)                               |
| S-03       | email-password-auth       | Email/password auth + logout                       | no                    | Done (built pre-roadmap)                               |
| S-04       | complete-auth-oauth-reset | Complete auth: Google Sign-In + password reset     | yes                   | Run `/10x-plan complete-auth-oauth-reset` — north star |
| S-05       | presave-task-review       | Optional pre-save review of extracted tasks        | yes                   | Nice-to-have; deferrable                               |

This table is the clean handoff to Jira/Linear or any MCP-backed backlog. Include one row for every `F-NN` and `S-NN`.

## Open Roadmap Questions

1. **Error sink / observability for production** — `deploy-plan.md` flags an external error sink (e.g. Sentry free tier) as future; no PRD NFR mandates it for MVP. Owner: user. Block: roadmap-wide (none; informational — promote to a foundation only if a launch NFR demands it).
2. **Adoption-resistance hypothesis (PRD OQ-03)** — no hypothesis on why a current voice-recording user would switch to Tellme. Owner: product owner. Block: none (post-MVP).

> PRD Open Questions #1 (native vs. mobile web) and #2 (Google OAuth path on mobile) are now **resolved** by `tech-stack.md` (Expo native + `expo-auth-session`) and are not carried forward.

## Parked

- **No calendar integration** — Why parked: PRD §Non-Goals (task data lives only in Tellme; no external sync in MVP).
- **No push notifications or reminders** — Why parked: PRD §Non-Goals (users check the list manually).
- **No multi-language support beyond Polish and English** — Why parked: PRD §Non-Goals (AI pipeline scoped to PL/EN).
- **No sharing or collaboration** — Why parked: PRD §Non-Goals (lists are private per account).
- **No AI prioritisation or scheduling** — Why parked: PRD §Non-Goals (extract only; no ranking/scheduling).
- **No offline mode** — Why parked: PRD §Non-Goals (transcription/extraction require cloud calls).
- **Toggleable pre-save editing setting** — Why parked: PRD §Non-Goals (the on/off toggle for FR-007 is post-MVP; the review screen itself is tracked as S-05).

## Done

(Empty on first generation. `/10x-archive` appends an entry here — and flips that item's `Status` to `done` — when a change whose `Change ID` matches the item is archived. Do NOT pre-populate.)
