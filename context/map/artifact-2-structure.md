---
title: 'Wide Scan — Structure'
type: map-artifact
created: 2026-09-04
---

# Artifact 2 — Structure (dependency graph)

**Tool:** `npx madge --ts-config tsconfig.json`, run separately for `src/` (Expo Router, RN) and `backend/src/` (Hono on Cloudflare Workers) — two separate runtimes with no shared import graph, so analyzed independently. `dependency-cruiser` was skipped as unnecessary install overhead for 24+8 files; `madge` gives the same signal (fan-in/out, cycles) without adding a new `devDependency` to `package.json`.

**A pitfall along the way:** the first `madge` pass without `--ts-config` reported almost every file in `src/app/*` and `src/components/*` as an "orphan" (zero connections) — because it wasn't resolving the `@/*` → `src/*` path alias from `tsconfig.json`. After adding `--ts-config`, the graph matches what's actually visible in the code. Leaving this as a warning: a raw CLI result without checking the project's config can give a false picture of "nothing is connected."

## `src/` — local centers (fan-in, how many files import a given file)

| File                         | Fan-in | Role                                                                           |
| ---------------------------- | ------ | ------------------------------------------------------------------------------ |
| `constants/theme.ts`         | 11     | design tokens — a genuine foundation, touched by nearly every screen/component |
| `hooks/use-theme.ts`         | 9      | derives from theme.ts, used just as broadly                                    |
| `components/themed-text.tsx` | 7      | UI primitive                                                                   |
| `components/themed-view.tsx` | 6      | UI primitive                                                                   |
| `lib/auth.tsx`               | 6      | the only access point to session/auth in the whole app                         |
| `types.ts`                   | 3      | `Task`/`TaskStatus` — the contract between screens                             |
| `lib/supabase.ts`            | 3      | Supabase client                                                                |

Zero cycles (`madge --circular` comes back clean for both graphs).

## `src/` — heaviest entry points (fan-out, how many files a file imports)

| File                      | Fan-out | Reading                                                                                                                                 |
| ------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `app/(app)/index.tsx`     | 10      | the home screen — recording, task list, search, tabs, all in one file (~250 lines); this is a real local center, not a thin entry point |
| `app/reset-password.tsx`  | 7       | form + validation + recovery integration                                                                                                |
| `app/forgot-password.tsx` | 5       | same idea                                                                                                                               |
| `app/sign-in.tsx`         | 5       | sign-in + Google OAuth + errors                                                                                                         |

**Orphans (zero in, zero out after the alias fix):** `app/auth-callback.tsx` (confirmed in the code — it's a deliberately thin `<Redirect href="/" />`; the OAuth code exchange happens elsewhere, in `lib/auth.tsx::signInWithGoogle`, confirmed by a comment in the file) and `hooks/use-color-scheme.web.ts` (a platform variant, loaded by Expo's `.web.ts` convention, not by import — `madge` can't see it for that reason; a false orphan, not dead code).

## `backend/src/` — centers and entry points

| File                                | Fan-in | Fan-out | Role                                                                         |
| ----------------------------------- | ------ | ------- | ---------------------------------------------------------------------------- |
| `types.ts`                          | 5      | 0       | contract: `Env`, `AppEnv`, `TaskStatus` — imported everywhere                |
| `middleware/auth.ts`                | 2      | 2       | the only auth gate for both routers                                          |
| `supabase.ts`                       | 2      | 1       | client factory (anon / per-token)                                            |
| `routes/transcribe.ts`              | 1      | 4       | the heaviest backend file — orchestrates transcription, extraction, and save |
| `routes/tasks.ts`                   | 1      | 2       | CRUD                                                                         |
| `ai/transcribe.ts`, `ai/extract.ts` | 1 each | 0       | leaves — well isolated, called only from `routes/transcribe.ts`              |
| `index.ts`                          | 0      | 4       | Hono wire-up                                                                 |

Zero cycles.

## Contracts and boundaries that don't show up in the graph alone

- **`TASK_STATUSES`/`TaskStatus` duplicated byte for byte** in `src/types.ts` and `backend/src/types.ts` — no shared package, so neither an import nor `madge` will catch it. This is connascence of meaning at a distance (see `context/domain/01-domain-distillation.md` for the full analysis) — the dependency graph by definition can't see it, since neither side has any edge to the other.
- **SDK types leak into the domain layer on the client side**: `src/lib/auth.tsx` imports `Session` directly from `@supabase/supabase-js` and exposes it as `AuthState.session` — the rest of the app that wants to know the session state knows Supabase's shape, not a domain type of its own. An ACL candidate — see `context/domain/03-anti-corruption-layer.md`.
- **Duplication of save logic, not just a type**: `backend/src/routes/transcribe.ts` (lines 49–52) and `backend/src/routes/tasks.ts` (lines 54–57) contain a near-identical `supabase.from('tasks').insert(texts.map(...)).select()` block. `madge` won't show this (it isn't an import), but it's real coupling: changing the insert shape requires a fix in two places, and nothing enforces that.
- **`ai/transcribe.ts` and `ai/extract.ts` are already a well-built port**: both SDK dependencies (`@cloudflare/workers-types` → `Ai`, `@anthropic-ai/sdk`) are sealed inside two small, stateless functions, called only from `routes/transcribe.ts`. Not a refactor candidate — an example of a boundary that already works well and is worth leaving as-is.

## Limitations of this component

- The graph shows static imports at a point in time, not intent or runtime coupling (e.g. the Cloudflare Workers AI binding `c.env.AI` or environment variables aren't "imports" and won't appear on the graph).
- `backend/` has no `store`/`repository` layer to analyze the way the Mattermost example does — Supabase access is called directly from the routers. That's itself an observation for `repo-map.md` (Real couplings), not something the graph "discovers" — it has to be read in the code.
