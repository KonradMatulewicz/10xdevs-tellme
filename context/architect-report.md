---
title: '10xArchitect — Module 4 activity report (Tellme)'
created: 2026-09-04
type: architect-report
---

# Architecture report — module 4 (10xArchitect)

## 1. Projects covered

One project across the whole module: **Tellme** (RN/Expo Router frontend in `src/`, Hono/Cloudflare Worker backend in `backend/`, Supabase as auth+DB). Scale: 43 commits, ~3 months, one author, ~24 files in `src/` + ~8 in `backend/src/`. This isn't legacy in the classic sense (many authors, conflicting decisions) — it's an MVP built quickly, where some areas were never revisited after being first written. The lesson's methods were applied at a scale calibrated down: no quarterly breakdown (too short a history), no real contributor map (one author), with `npx madge`/`npx ast-grep` instead of persistent dependencies in `package.json`.

Artifacts: `repo-map.md` (L2), `voice-task-pipeline/research.md` (L3), `refactor-opportunities/{research,plan}.md` (L4), `context/domain/*.md` ×3 (L5).

## 2. Project map (from L2)

- **Risk zone #1**: the voice-to-task pipeline (`record-button.tsx` → `routes/transcribe.ts` → Whisper → Claude → Supabase insert) — the only area with no tests on either side, despite being the product's core.
- **Local centers**: `lib/auth.tsx` (the only access point to the session, fan-in 6, 46 co-change partners), `app/(app)/index.tsx` (fan-out 10 — recording+list+search+tabs in one screen).
- **A real coupling invisible in the graph**: `TaskStatus`/`TASK_STATUSES` duplicated byte for byte between `src/types.ts` and `backend/src/types.ts`, zero import — neither the import graph nor co-changes will catch this.
- **The most important unknown**: whether the production Worker currently has all three secrets correctly set — unverifiable from the repo alone.

## 3. Feature analysis (from L3)

**Flow studied**: the voice-to-task pipeline — chosen directly from the map's Risk zone #1.

**Feature overview (3-4 sentences)**: The recording goes to Whisper (Cloudflare Workers AI), the transcript to Claude (structured JSON output), the result is saved to Supabase. Key finding: the task list in the UI is **not** updated from the `/transcribe` response — on success the client does a full refetch (`GET /tasks`), unlike `onUpdate`, which is explicitly optimistic. Three distinguishable error states (422 no speech, 200 zero tasks, 502 AI failure) are mapped to a UI banner.

**Technical debt (2-3 most important, one confirmed with ast-grep)**: (1) a duplicated insert into `tasks` across two routers, **confirmed with ast-grep** at exactly 2 identical occurrences; (2) zero tests on 5 of 6 files on the path — but this isn't an unnamed risk: `context/foundation/test-plan.md:42` already lists it as risk #1, Phase 2, status "not started" — the analysis confirms and deepens it, it doesn't discover it from scratch; (3) no transactionality — if the insert fails after a successful (costly) transcription+extraction, the transcript and tasks are lost with no logging.

## 4. Refactor plan (from L4)

**What's being refactored**: of the four candidates in the ranking (insert duplication, `TaskStatus` duplication, no transactionality, untyped Supabase client), **C1 (extract a shared `insertTasks()`)** + a cheap prerequisite was chosen: **turn on the backend `typecheck` as a blocking CI step** (currently not run at all — directly verified, no CI job typechecks `backend/src`).

**What we're deliberately NOT doing**: `TaskStatus` (no mechanism to share it between the RN app and the Worker, needs new infrastructure), a typed Supabase client (depends on the enabled CI typecheck as a prerequisite), logging on insert failure (the weakest intentionality evidence of the four, deferred to `test-plan.md` Phase 2).

**Plan phases**: (1) add an `npm run typecheck` step to the `backend-tests` CI job, blocking from the start — the baseline was verified clean this session, zero risk; verification: automated (the Actions run shows a green step). (2) Extract `insertTasks()` into `backend/src/db/tasks.ts`, rewire both routers, extend `fake-supabase.ts` to record insert arguments, add a unit test; verification: automated (`typecheck`+`test`) and manual (`wrangler dev`, one call to each endpoint).

## 5. Domain per DDD (from L5)

**Ubiquitous language**: the PRD and the code are unusually consistent — no classic "3×Account." Key terms: `Task` (one name across the whole repo), `TaskStatus` (todo/done/deleted), `Transcript` (never persisted, deliberately). The most interesting model-vs-code drift: FR-007 (an optional pre-save review screen) was never implemented — but the PRD itself marks it nice-to-have, so this is a gap worth stating explicitly, not a bug.

**Invariant #1 and aggregate**: "a task's text is never empty" — enforced independently today in three places (`ai/extract.ts`, `POST /tasks`, `PATCH /tasks/:id`), one of which (`routes/transcribe.ts`) doesn't validate at all, just trusts its neighbor. The aggregate design converges with L4: the same `insertTasks()` that L4 creates to remove insert duplication becomes the natural single place to enforce this invariant.

**Anti-Corruption Layer**: `src/app/reset-password.tsx` calls `supabase.auth.exchangeCodeForSession()` directly, bypassing the `lib/auth.tsx` port, even though **the same operation already exists** inside `signInWithGoogle` — with different error handling in each place. Success criterion (checkable with grep): `supabase.auth.exchangeCodeForSession` should occur in exactly one file (`auth.tsx`), not two.

## 6. Decisions that are mine

_(A section for you to edit before submitting the form — the draft below is grounded in choices actually made this session, not something to paste in unread.)_

Of the four refactor candidates, I chose the narrowest, safest scope (C1 + CI typecheck) instead of all four at once — that was my decision at the `AskUserQuestion` prompt, not the agent's default. Within that scope I confirmed three further choices: a new module, `backend/src/db/tasks.ts`, instead of adding to the existing `supabase.ts`; adding a new test that closes a safety-net gap instead of a purely mechanical extraction; and a blocking mode for the new CI step — all three matched the agent's recommendation, but were accepted deliberately after seeing the reasoning, not applied automatically.
