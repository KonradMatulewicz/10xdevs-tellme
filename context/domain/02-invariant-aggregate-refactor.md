---
title: 'Invariant & aggregate refactor plan — Task text non-emptiness'
created: 2026-09-04
type: refactor-plan
---

# Invariant and guard aggregate — task text is never empty

**This document's product is a PLAN, not an implementation.** No code has been changed.

## Step 1 — Identified invariants

From `context/domain/01-domain-distillation.md` (Step 3) and direct reading of the code:

1. **A task's text is never empty/whitespace-only** — implied by `context/foundation/prd.md:124` ("an ordered list of task strings" — an empty string isn't a "distinct actionable item"), enforced in two independent places.
2. **A user sees/modifies only their own tasks** — `prd.md:130`, enforced by Postgres RLS, confirmed by `backend/test/idor.test.ts`.
3. **Exactly one source of truth for session state** — implied, enforced structurally by `AuthContext`, but the port is sometimes bypassed (see `03-anti-corruption-layer.md`).

## Step 2 — Classification and selecting #1

| Invariant                   | (a) Core-ness                         | (b) How spread out                                                                                                                                                                                                                      | (c) Enforcement                                                                 |
| --------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1. Task text non-empty      | High — concerns `Task`, a Core entity | 2 independent places (`ai/extract.ts:51`, `routes/tasks.ts:50-51`), **plus a third: no insert has a type-level guarantee** (`texts: string[]` in `insertTasks` — see L4's `plan.md` — doesn't exclude an empty string in the signature) | Violable: the two copies of the rule can drift if one changes without the other |
| 2. Per-user isolation (RLS) | High                                  | 1 place (the RLS policy in Supabase)                                                                                                                                                                                                    | Enforced and **tested on a live network** — the strongest of the three          |
| 3. Single session source    | Medium (Supporting, not Core)         | 1 "place" structurally (`AuthContext`), but bypassed in practice                                                                                                                                                                        | Declared, but violable — see ACL                                                |

**Choice: #1 — task text non-empty.** It is simultaneously the most core (concerns `Task`, a Core entity) and the weakest enforced (two independent copies of the rule, no type that structurally enforces it). #2 is stronger and verified — no intervention needed. #3 is real, but it's Supporting, not Core, and has its own, more fitting repair pattern (ACL, not an aggregate) — see `03-anti-corruption-layer.md`.

## Step 3 — Diagnosis

The rule lives today in two places, each with a different form of enforcement:

- **`backend/src/ai/extract.ts:51`**: `parsed.tasks.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean)` — Claude's extraction goes through `.trim()` + `.filter(Boolean)`, so an empty/whitespace string never gets further down this path.
- **`backend/src/routes/tasks.ts:50-51`**: `const texts = raw.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean); if (texts.length === 0) return c.json({ error: 'provide a non-empty `text`or`texts`' }, 400);` — the manual `POST /tasks` endpoint has its own, separately written, near-identical logic.
- **`backend/src/routes/transcribe.ts:36-53`**: **doesn't validate anything itself** — trusts that `extractTasks()` already did. This works today (because `extract.ts:51` does actually filter), but nothing in `extractTasks()`'s return type, `Promise<string[]>`, guarantees it — the signature allows any `string[]`, including empty elements. Someone changing `extract.ts` (e.g. removing `.filter(Boolean)` while refactoring the prompt) would silently break the rule, because `routes/transcribe.ts` never checks it itself.
- **The client doesn't validate at all** — `PATCH /tasks/:id` (`tasks.ts:70-73`) checks for non-empty `text` on edit, but that's a third, again separate, copy of the same rule.

No layer is the sole guardian. The rule is "spread out" across three places (extraction, POST /tasks, PATCH /tasks/:id), one of which (`transcribe.ts`) relies entirely on its neighbor (`extract.ts`) never changing.

## Step 4 — Guard aggregate design

**A coincidence worth using**: `context/changes/refactor-opportunities/plan.md` (L4, already planned, not yet implemented) creates `backend/src/db/tasks.ts::insertTasks(supabase, texts)` as the single place that inserts into `tasks` — for an entirely different reason (removing C1's duplication). This is the natural aggregate boundary for this invariant: instead of adding a fourth, separate validation spot, the same point L4 is already centralizing for the insert should also be the single place that validates.

- **Extended signature** (an extension of the L4 plan, not a new entity): `insertTasks(supabase, texts: string[])` **throws a named domain error** (e.g. `EmptyTaskTextError`) if, after `.trim()`, any element is empty, instead of silently skipping it (today's behavior in `extract.ts`/`tasks.ts` is _filtering_, the new behavior is _rejection with an explicit error_ — see "Before/after" below for why the behavior should change).
- **Precondition**: `texts` is non-empty as an array (at least one element after trim) and every element is non-empty after trim.
- **Callers** (`routes/tasks.ts`, `routes/transcribe.ts`) catch `EmptyTaskTextError` and map it onto the existing 400/422 response shape — no change to the HTTP contract.
- **`PATCH /tasks/:id`** (editing a single task) is a separate operation (update, not insert) — out of scope for `insertTasks`, but should call the same validating helper function (e.g. extract `assertNonEmptyText(text: string): string` used by both places), so as not to leave a third copy of the rule.

## Step 5 — Before / after, plan, tests

**Before:**

- `extract.ts:51` — filters quietly (not an error, just skips)
- `tasks.ts:50-51` — validates and returns 400 only if **all** elements are empty (doesn't reject partially-empty input — `['do laundry', '']` passes as `['do laundry']`, silently losing the fact that the second element was empty)
- `tasks.ts:70-73` (PATCH) — a third, separate copy

**After:**

- One helper function, `assertNonEmptyText`, used by both `insertTasks` (for batches) and `PATCH` (for single edits)
- The behavior for partially-empty input becomes **an explicit decision to make in the implementation plan** (today's silent filtering in `extract.ts` vs. `tasks.ts` already subtly differing — exactly the kind of quiet inconsistency the aggregate is meant to eliminate, not just relocate)

**Phase plan (to be executed as a separate change, `/10x-new`/`/10x-plan`, after L4's `refactor-opportunities` lands):**

1. Test-first: a characterization test for today's `extract.ts`/`tasks.ts` behavior on empty/whitespace elements (pins down _current_, not _target_, behavior — per M4L4's "add a test before you touch" rule).
2. Add `assertNonEmptyText` + `EmptyTaskTextError` as new, isolated code (doesn't touch call sites yet).
3. Wire it into `insertTasks` (piggybacking on L4's C1) and into `PATCH /tasks/:id`.
4. Remove the duplicated validation from `tasks.ts:50-51` and `ai/extract.ts:51` (replace with a call to the shared function, or remove if `insertTasks` already guarantees it).

**Test cases (legal/illegal):**

- Legal: `['do laundry']`, `['do laundry', 'call mom']`
- Illegal: `['']`, `['   ']`, `['do laundry', '']` (partially empty — behavior is an explicit decision for the plan, not here)
- Edge case: an empty array `[]` (today `transcribe.ts:42-45` already handles this correctly, separately — "zero tasks" is an explicit 200, not an error; don't confuse this with "a list containing an empty element")

## Limitations

- Citations verified by directly reading the files in this session (`extract.ts`, `tasks.ts`, `transcribe.ts`) — not via ast-grep in this document (this is a plan, not a research pass concluded with metrics; L3/L4's `research.md` files already have full ast-grep verification for the related insert-duplication claims).
- This plan assumes L4's `refactor-opportunities/plan.md` (C1: `insertTasks()`) lands first — if the order changes, the aggregate can still be built on its own, it just loses its natural anchor point.
