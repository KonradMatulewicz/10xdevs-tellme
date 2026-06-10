---
bootstrapped_at: 2026-06-10T17:52:00Z
starter_id: expo
starter_name: "Expo (React Native)"
project_name: tellme
language_family: js
package_manager: npm
cwd_strategy: subdir-then-move
bootstrapper_confidence: verified
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
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
```

### Why this stack

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

## Pre-scaffold verification

| Signal      | Value                                      | Severity | Notes                                             |
| ----------- | ------------------------------------------ | -------- | ------------------------------------------------- |
| npm package | create-expo-app v4.0.0 published 2026-05-15 | fresh    | resolved from cmd_template                        |
| GitHub repo | not run                                    | —        | docs_url (https://docs.expo.dev) is not a GitHub URL |

## Scaffold log

**Resolved invocation**: `npx create-expo-app .bootstrap-scaffold --yes --template default`
**Strategy**: subdir-then-move (scaffold into a temp directory, then move files up)
**Exit code**: 0
**Files moved**: 15 (`.git`, `.gitignore`, `.vscode`, `AGENTS.md`, `app.json`, `assets`, `LICENSE`, `node_modules`, `package.json`, `package-lock.json`, `README.md`, `scripts`, `src`, `tsconfig.json`, `.claude/settings.json`)
**Conflicts (.scaffold siblings)**: `CLAUDE.md.scaffold` (existing `CLAUDE.md` in cwd won; scaffold copy sidelined)
**.gitignore handling**: moved silently (was absent in cwd; no append-merge needed)
**.bootstrap-scaffold cleanup**: deleted

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 0 HIGH, 11 MODERATE, 0 LOW
**Direct vs transitive**: 2/0/2/0 direct of total 0/0/11/0 (CRITICAL/HIGH/MODERATE/LOW)

#### CRITICAL findings

None.

#### HIGH findings

None.

#### MODERATE findings

| Package                        | Direct? | Via                           | Advisory / Notes                                                                   | Fix available         |
| ------------------------------ | ------- | ----------------------------- | ---------------------------------------------------------------------------------- | --------------------- |
| expo                           | yes     | @expo/cli, @expo/config, @expo/config-plugins, @expo/local-build-cache-provider, @expo/metro-config | Transitive advisories chain up through tooling packages | expo@46.0.21 (major)  |
| expo-splash-screen             | yes     | @expo/config-plugins          | Transitive advisory via xcode/uuid chain                                           | expo-splash-screen@55.0.21 (major) |
| @expo/cli                      | no      | @expo/config, @expo/config-plugins, @expo/inline-modules, @expo/metro-config, @expo/prebuild-config | Tooling package | expo@46.0.21 (major)  |
| @expo/config                   | no      | @expo/config-plugins          | Tooling package                                                                     | expo@46.0.21 (major)  |
| @expo/config-plugins           | no      | xcode                         | Tooling package                                                                     | expo-splash-screen@55.0.21 (major) |
| @expo/inline-modules           | no      | @expo/config-plugins          | Tooling package                                                                     | expo@46.0.21 (major)  |
| @expo/local-build-cache-provider | no    | @expo/config                  | Tooling package                                                                     | expo@46.0.21 (major)  |
| @expo/metro-config             | no      | @expo/config                  | Tooling package                                                                     | expo@46.0.21 (major)  |
| @expo/prebuild-config          | no      | @expo/config, @expo/config-plugins | Tooling package                                                                | available             |
| uuid                           | no      | advisory GHSA-w5hq-g745-h8pq  | Missing buffer bounds check in v3/v5/v6 when buf is provided. CVSS 7.5. Affects range <11.1.1 | expo-splash-screen@55.0.21 (major) |
| xcode                          | no      | uuid                          | Affected via uuid advisory                                                         | expo-splash-screen@55.0.21 (major) |

**Note on uuid advisory**: npm reports severity as `moderate`; raw CVSS score is 7.5 (HIGH range). All 11 advisories are transitive — they originate in Expo's internal tooling and build-time packages (`@expo/config-plugins`, `xcode`, `uuid`), not in runtime app code. Fixes require major-version upgrades of `expo` and `expo-splash-screen`; run `npm audit fix --force` when those upgrades are safe for your project.

#### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint                    | Value                    |
| ----------------------- | ------------------------ |
| bootstrapper_confidence | verified                 |
| quality_override        | false                    |
| path_taken              | standard                 |
| self_check_answers      | null                     |
| team_size               | solo                     |
| deployment_target       | appstore-via-eas         |
| ci_provider             | github-actions           |
| ci_default_flow         | auto-deploy-on-merge     |
| has_auth                | true                     |
| has_payments            | false                    |
| has_realtime            | false                    |
| has_ai                  | true                     |
| has_background_jobs     | false                    |

These hints were collected at hand-off time for future use. A future M1L4 skill ("Memory Architecture") will generate `CLAUDE.md` and `AGENTS.md` scaffolding based on these values (auth, AI, CI/CD flow, deployment target). v1 bootstrapper does not act on them beyond logging.

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- Review `CLAUDE.md.scaffold` — the scaffold shipped its own `CLAUDE.md`; diff it against your existing `CLAUDE.md` and decide which parts (if any) to merge in.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log. The 11 MODERATE advisories are all in Expo build-tooling; they affect build-time only, not runtime app code. Run `npm audit fix --force` when major-version upgrades are safe.
- Run `npx expo start` to confirm the scaffold launches cleanly in Expo Go.
- Add your project files to the `.git` repo that was created during scaffolding, or reinitialise with your preferred git config.
