---
change_id: complete-auth-oauth-reset
title: Complete authentication — Google Sign-In + password reset
status: implementing
created: 2026-06-17
updated: 2026-07-05
archived_at: null
---

## Notes

Roadmap slice **S-04** (north star) from `context/foundation/roadmap.md`.

Outcome: user can sign in with Google and reset a forgotten password via email — completing the full auth surface the PRD requires (FR-001 Google OAuth path, FR-002).

Prerequisite S-03 (email/password auth) is done. Remaining gap per the roadmap baseline: Google OAuth and password reset are absent (`src/lib/supabase.ts`: "no web OAuth redirect handling in the native app yet"). Resolved approach per `tech-stack.md`: Expo native + `expo-auth-session` / Supabase Auth; main risk is OAuth redirect-URI / Google Cloud client config friction, not architecture.
