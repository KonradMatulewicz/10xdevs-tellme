# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Stage only the planned set at phase commits

- **Context**: complete-auth-oauth-reset — commits 950c015 (p1), 154bc61 (p2)
- **Problem**: Phase commits bundled files unrelated to the plan (Prework/_, .claude/skills/_, roadmap.md, UI components from a parallel routing refactor) — the result of choosing "Stage all" at the dirty-paths prompt. This muddies history, widens review scope, and makes phases hard to revert cleanly.
- **Rule**: At phase-end commit rituals, when unrelated dirty paths are reported, default to "Continue — stage only the planned set". Unrelated work gets its own commit outside the change.
- **Applies to**: /10x-implement phase commits and any manual commits made inside an active change.
