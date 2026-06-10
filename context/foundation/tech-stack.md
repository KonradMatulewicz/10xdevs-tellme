---
starter_id: expo
package_manager: npm
project_name: tellme
hints:
  language_family: js
  team_size: solo
  deployment_target: appstore-via-eas
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: verified
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
---

## Why this stack

Tellme is a solo-built, 2-week mobile MVP targeting iOS and Android with a
short timeline and no prior native experience required. Expo (React Native) is
the recommended default for the (mobile, js) cell and clears all four
agent-friendly quality gates: typed TypeScript throughout, strong Expo
conventions on file layout and routing, well-represented in training data, and
current docs. The managed workflow removes the Xcode/Android Studio setup cost
that would otherwise eat into the 2-week window. Auth is in scope (email and
Google Sign-In via expo-auth-session) and AI is in scope (cloud transcription
and task extraction); both are well-supported in the Expo ecosystem. Deployment
targets the App Store via EAS Build — the standard Expo production path. CI
runs on GitHub Actions with auto-deploy on merge. Bootstrapper confidence is
verified, so scaffolding will run end-to-end without manual steps.
