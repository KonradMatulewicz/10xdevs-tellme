<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Complete Authentication - Google Sign-In + Password Reset

- **Plan**: `context/changes/complete-auth-oauth-reset/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-17
- **Verdict**: REVISE
- **Findings**: 1 critical, 2 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | FAIL |

## Grounding

Grounding: 5/5 paths OK, 8/8 symbols/deps OK, brief-to-plan OK.

Checked local files:

- `app.json`
- `package.json`
- `src/lib/auth.tsx`
- `src/lib/supabase.ts`
- `src/app/sign-in.tsx`
- `src/app/(app)/_layout.tsx`

Checked external/current API references:

- Supabase `signInWithOAuth`: https://supabase.com/docs/reference/javascript/auth-signinwithoauth
- Supabase `exchangeCodeForSession`: https://supabase.com/docs/reference/javascript/auth-exchangecodeforsession
- Supabase `resetPasswordForEmail`: https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
- Expo SDK 54 `WebBrowser.openAuthSessionAsync`: https://docs.expo.dev/versions/v54.0.0/sdk/webbrowser/

## Findings

### F1 - Plan requires unit tests but the repo has no test runner

- **Severity**: CRITICAL
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1/2/3 success criteria and Progress
- **Detail**: The plan adds unit tests in Phase 1 and Phase 2, and every phase requires `npm test`. But `package.json` has no `test` script and no test runner dependency. `rg --files src` found no existing test convention. As written, `/10x-implement` will reach Progress rows 1.3, 2.3, and 3.1 and fail on an undefined command.
- **Fix**: Add a Phase 1 task before writing tests: choose and install the test runner, add `npm test`, and define the test location convention. For this plan's pure logic tests, `vitest` is probably enough unless the implementation renders Expo/React Native components, in which case use the Expo/Jest path explicitly.
- **Decision**: PENDING

### F2 - Password reset PKCE has an unstated same-device constraint

- **Severity**: WARNING
- **Impact**: HIGH - architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details / Phase 2 reset-password screen
- **Detail**: The plan says the recovery email carries a `code` and the app exchanges it with `exchangeCodeForSession`. Supabase supports PKCE recovery, and the installed auth-js code confirms `exchangeCodeForSession` requires a stored PKCE code verifier when `flowType === 'pkce'` (`node_modules/@supabase/auth-js/src/GoTrueClient.ts:1941`). That verifier is created when `resetPasswordForEmail` runs (`GoTrueClient.ts:4342`). Therefore, a reset requested on device A and opened on device B can fail even though the email link is valid. The plan's desired end state does not say reset is same-device only.
- **Fix A Recommended**: Keep PKCE and make the same-device constraint explicit in Desired End State, runbook, manual verification, and error handling.
  - Strength: Minimal change; matches the chosen Supabase PKCE approach.
  - Tradeoff: Password reset is less robust across devices/email clients.
  - Confidence: HIGH - confirmed from installed Supabase auth-js code.
  - Blind spot: Need live confirmation of the exact error message on cross-device open.
- **Fix B**: Redesign recovery to support cross-device reset links.
  - Strength: Better user expectation for password reset.
  - Tradeoff: Larger auth-design change; needs Supabase template/token strategy research.
  - Confidence: MEDIUM - not validated in this repo yet.
  - Blind spot: Supabase dashboard template details still need confirmation.
- **Decision**: PENDING

### F3 - Redirect runbook is too vague for the riskiest external dependency

- **Severity**: WARNING
- **Impact**: MEDIUM - real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 3 setup runbook
- **Detail**: The plan correctly identifies redirect allow-list friction as the named risk, but Phase 3 only says to add the Expo Go dev pattern `exp://` and `tellme://`. Expo's `openAuthSessionAsync(url, redirectUrl)` requires the redirect URL to match the app callback, and Expo's SDK 54 docs call out redirect URL matching and app scheme behavior. The runbook should not leave the exact values to interpretation.
- **Fix**: Add a small diagnostic step to the runbook: print/log `authRedirectUrl('auth-callback')` and `authRedirectUrl('reset-password')` from the running app, then paste those exact values into Supabase Redirect URLs alongside the production `tellme://...` variants.
- **Decision**: PENDING
