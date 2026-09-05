---
title: 'Wide Scan — Territory'
type: map-artifact
created: 2026-09-04
---

# Artifact 1 — Territory (git history)

**Scope note:** 43 commits, 2026-06-10 → today (~3 months), one author under two git identities (`Konrad Matulewicz` / `Konrad.M` — the same person). Too little history and too few people for a quarterly trend or a real contributor map — see `artifact-3-contributors.md` for that limitation named explicitly. What history still shows well at this scale: where work concentrated and what changes together.

## Most-changed files (whole history, noise filtered)

Filtered out: `package-lock.json`, `.wrangler/`, `dist/`, `Prework/` (course material, not app code), `.claude/skills/`, `.claude/prompts/` (toolkit, not domain).

| #   | File                                                         | Changes | Comment                                           |
| --- | ------------------------------------------------------------ | ------- | ------------------------------------------------- |
| 1   | `CLAUDE.md`                                                  | 8       | instruction root — grows with every project phase |
| 2   | `package.json`                                               | 7       | frontend dependencies                             |
| 3   | `.github/workflows/claude-review.yml`                        | 6       | CI/AI review, being tuned                         |
| 4   | `src/components/animated-icon.tsx`                           | 5       | **removed** — dead Expo scaffold (see below)      |
| 5   | `backend/src/index.ts`                                       | 5       | Worker entry point                                |
| 6   | `backend/package.json`                                       | 5       | backend dependencies                              |
| 7   | `app.json`                                                   | 5       | Expo config                                       |
| 8   | `src/lib/auth.tsx`                                           | 4       | auth provider (frontend)                          |
| 9   | `src/components/ui/collapsible.tsx`                          | 4       | **removed** — scaffold                            |
| 10  | `src/app/_layout.tsx`                                        | 4       | root layout / auth gate                           |
| 11  | `context/changes/complete-auth-oauth-reset/{plan,change}.md` | 4+4     | the only large, named change in the history       |

**Finding: the structure (partially) lies.** Four of the top-15 most-changed files (`animated-icon.tsx`, `ui/collapsible.tsx`, `app-tabs.tsx`, `app-tabs.web.tsx`) **no longer exist** — dead `create-expo-app` scaffold that was edited a few times and then removed entirely. Likewise `src/app/index.tsx` (the old, flat routing) is gone — routes moved under the `(app)/` group. A "most-changed" history without checking presence in the repo would mislead; every number above is already filtered for what actually exists today (except where explicitly marked "removed").

## Directories with the most activity (app code, excluding `Prework/`, `.claude/`, `context/`)

| Directory                        | Changes | Role                                                                                    |
| -------------------------------- | ------- | --------------------------------------------------------------------------------------- |
| `src/components`                 | 26      | UI — mostly dead scaffold + live components (`record-button`, `task-card`, `segmented`) |
| `src/app`                        | 18      | screens (Expo Router)                                                                   |
| `src/lib`                        | 13      | client domain logic: auth, api, recovery                                                |
| `backend/test`                   | 13      | Worker tests                                                                            |
| `backend` (root) / `backend/src` | 11 / 9  | Worker: routing, AI, Supabase                                                           |

## Co-changes (file pairs in the same commits)

| Pair                                                                                      | Occurrences | Reading                                                                                                                                    |
| ----------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `backend/src/index.ts` ↔ `context/deployment/deploy-plan.md`                              | 4           | Worker deploy and its plan move together — consistent                                                                                      |
| `backend/package.json` ↔ `backend/src/index.ts`                                           | 4           | backend dependencies and entry point — expected                                                                                            |
| `app.json` ↔ `package.json`                                                               | 4           | Expo config and dependencies — expected                                                                                                    |
| `src/lib/auth.tsx` ↔ `src/lib/supabase.ts`                                                | 3           | auth and the Supabase client — a consistent pair, no surprise                                                                              |
| `context/changes/complete-auth-oauth-reset/change.md` ↔ `src/lib/auth.tsx`                | 3           | the change-id and the auth implementation move together — the process is working as intended                                               |
| `src/app/sign-in.tsx` ↔ `src/lib/{auth.tsx,recovery.ts,supabase.ts}` + `recovery.test.ts` | 2 each      | the sign-in screen consistently changes together with the auth layer — a coherent cluster                                                  |
| `src/components/record-button.tsx` ↔ `src/lib/api.ts`                                     | 2           | the **only** co-change touching the record→transcribe path; low count because this path was rarely touched at all after it was first built |

No worrying "at-a-distance" co-changes (e.g. backend and frontend changing the same concept without a shared file) — but see `artifact-2-structure.md` and `03-anti-corruption-layer.md` in `context/domain/`: `TaskStatus`/`TASK_STATUSES` is duplicated **byte for byte** in `src/types.ts` and `backend/src/types.ts` with no import between them, so git will never catch a drift if someone changes one copy and forgets the other — this is exactly the kind of coupling co-changes _can't see_, because nothing physically links them.

## Hub file (touched alongside the most other files)

`package.json`, `CLAUDE.md`, `app.json` dominate — that's not structural risk, it's normal repo config. The more signal-bearing hubs: `src/lib/auth.tsx` (46 distinct co-change partners) and `backend/src/index.ts` (32) — both sides of the auth/routing boundary are the points most of the project's work has passed through.

## Commit themes (a stand-in for the contributor map — see artifact-3)

| Type                                    | Count       | What it says                                                 |
| --------------------------------------- | ----------- | ------------------------------------------------------------ |
| `fix(ci)`                               | 5           | the largest single category of individual fixes went into CI |
| `feat(complete-auth-oauth-reset)`       | 3           | the only large feature with its own change-id in the history |
| `feat(testing-backend-test-foundation)` | 2           | building the backend's test foundation                       |
| `chore`, `docs*`                        | ~8 combined | cleanup and documentation                                    |

**Territorial conclusion:** the project has one clear center of practical work — **auth** (sign-in, Google OAuth, password reset) — documented with its own change-id and visible as a co-change hub. Beyond that there is one large, quiet zone: the **voice-to-task pipeline** (`record-button.tsx` → `backend/src/routes/transcribe.ts` → `ai/transcribe.ts` → `ai/extract.ts` → `routes/tasks.ts`), i.e. the app's actual value proposition, which has been barely touched since it was built (2 co-changes total) — quiet doesn't mean safe, see `artifact-3-structure.md`/`repo-map.md` (Risk zones) for the tests missing there.
