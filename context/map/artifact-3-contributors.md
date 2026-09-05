---
title: 'Wide Scan — Contributors'
type: map-artifact
created: 2026-09-04
---

# Artifact 3 — Contributor context

**This component is largely degenerate in this repo, and I'm saying so plainly instead of faking a depth that isn't there.** Lesson M4L2 designs this analysis for a repo with many contributors (Mattermost: dozens of people) — the goal is to find "who to ask." Tellme has one author under two git identities (`Konrad Matulewicz`, `Konrad.M` — the same person, different git config across machines/sessions). There's no one to ask besides you. The "Who to ask" section in `repo-map.md` will therefore be short and different from the lesson's example — instead of people, it points at **which change-ids / documents** carry context for a given area.

## What history still shows despite that: topical clusters over time

From commit themes (`artifact-1-territory.md`) and dates:

| Period (approximate) | Topic                                                                    | Evidence                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start (2026-06-10)   | Expo + 10x toolkit bootstrap                                             | `chore`, `feat(expo)` commits                                                                                                                                                       |
| Middle               | backend test foundation                                                  | `feat(testing-backend-test-foundation)` ×2, `docs(testing-backend-test-foundation)`, `context/changes/testing-backend-test-foundation/`                                             |
| Middle–end           | auth: sign-in, Google OAuth, password reset                              | `feat(complete-auth-oauth-reset)` ×3, `fix(complete-auth-oauth-reset)`, `docs(complete-auth-oauth-reset)`, `context/changes/complete-auth-oauth-reset/` (4 files, incl. `reviews/`) |
| Continuous           | CI                                                                       | `fix(ci)` ×5 — the largest single category across the whole history                                                                                                                 |
| No clear period      | voice-to-task pipeline (`record-button`, `routes/transcribe.ts`, `ai/*`) | no dedicated change-id in the history — built, but never went through the same `research → plan → implement` process as auth                                                        |

## What this actually says (interpretation, not just fact)

Auth went through a full, documented change cycle (change-id, plan, review). The voice-to-task pipeline — the **product's core** — apparently did not: it has no `context/changes/*` of its own, even though it's the actual reason the app exists ("Speak it. We'll list it." — the tagline on the home screen). This is exactly the kind of observation this component looks for: not "who," but "which area never got the same process attention as the rest" — and that's precisely why it's the target for L3 (Deep Focus) in this track.

## A limitation worth stating outright

The lack of ADRs and the lack of multiple authors means that in L4 (refactoring), "history as an intent test" won't be able to lean on `git blame` pointing to another person to ask — it will rely solely on commit content and on comments in the code. That second channel is unusually good in this repo: files like `backend/src/supabase.ts` or `src/components/record-button.tsx` carry inline reasoning for decisions ("LOAD-BEARING", "Reanimated temporarily removed to isolate an iOS-only freeze") that in a typical legacy codebase would have to be reconstructed from git archaeology — here it's already written down. That reduces, but doesn't eliminate, the need for `git log -L`/blame in L4.
