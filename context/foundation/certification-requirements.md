---
doc: 10xDevs certification requirements
status: reference
source: course announcements (Circle/Baserow), pasted by user
last_updated: 2026-09-03
---

# 10xDevs 3.0 certification requirements

> Reference record of the 10xDevs badge requirements, pasted from the course
> announcements. This is not a working document edited by skills — edit it
> by hand when the organizers update the rules. Used to assess project
> readiness (e.g. `.claude/prompts/mvp-check.md` assesses against the
> Builder section).

## 10xBuilder (modules 1–3) — base badge, required

Minimum technical requirements for the MVP before filling out the form:

1. **CRUD actions supported** — the project must allow creating, reading,
   updating, and deleting items (e.g. add / list / edit / delete
   to-do list tasks).
2. **Business logic** — at least one function implementing logic beyond
   plain CRUD (e.g. automatically suggesting task priority based on the
   name, description, and deadline).
3. **Tests** — at least one test suite addressing a concrete risk
   defined in the test-plan document.
4. **Authentication** — system access tied to a user who logs in
   and sees only resources assigned to them.

Modules 1–3 are enough to earn this badge; modules 4–5 are not required.

## 10xArchitect (module 4) — optional track

Evidence: an **architecture report** (a concise two-pager) assembled from four
artifacts from the module 4 lessons:

- repository map (L2)
- research on a chosen feature (L3)
- refactor plan (L4)
- domain notes inspired by DDD, `context/domain/` (L5)

The report is generated with the prompt from lesson M4L5. Key point: the report
must be "mine" — one you can defend, not the unread output of a single prompt
accepted as-is.

## 10xChampion (module 5) — optional track

Building **one of two** module 5 projects is enough. Does not require publishing
a company repository — evidence is screenshots showing it working in context
(or a standalone PoC).

**Option A — CI/CD pipeline for code review (M5L2–L3):**

- a view of the pipeline with at least one visible job
- logs from the pipeline/job while a code review operation runs
- behavior on a PR: a screenshot of a code review comment from the agent

**Option B — Team artifact registry (M5L4):**

- a repository/registry where the flow exists (screenshot)
- a package definition or equivalent artifact definition (e.g. `package.json`)
- a list of published versions (from the registry UI or via CLI command)

## Deadlines (shared across the whole certification, submissions due 23:59)

| #   | Deadline   | Note                                             |
| --- | ---------- | ------------------------------------------------ |
| 1   | 2026-07-05 | Only deadline with honors and a shot at Demo Day |
| 2   | 2026-08-10 |                                                  |
| 3   | 2026-09-14 | Final                                            |

## Submission rules

- **Everything in one round** — if you want more than one badge
  (e.g. Builder + Architect + Champion), all forms go in for the
  same deadline.
- **Only one attempt** — certification at a single, chosen deadline.
  It's worth submitting closer to the end of the chosen window.
- **No adding tasks later** — submitting only Builder at a given deadline
  earns only that badge; Architect/Champion can't be added later
  at a subsequent deadline.

Submission form (one form for all badges, fields are dynamic based on selection):
https://baserow.io/form/fwnBioduXc90QTli6lsCVL_YgRdTECPTCmwiVhu8d-E
