# Complete Authentication — Google Sign-In + Password Reset Implementation Plan

## Overview

Add the two missing pieces of Tellme's auth surface to the existing Supabase email/password
foundation: **Sign in with Google** (FR-001 Google path) and **password reset via email** (FR-002).
Google uses Supabase's `signInWithOAuth` opened in an in-app browser with the PKCE flow; password
reset uses a deep link from the recovery email into an in-app reset screen. Both are built to work
on **Expo Go (SDK 54)** so the free iOS testing loop is preserved, and the change closes with a
live end-to-end verification after a dashboard-config runbook is run.

## Current State Analysis

- **Auth module is cleanly factored.** `src/lib/auth.tsx` is an `AuthProvider` exposing
  `session`, `loading`, `signIn`, `signUp`, `signOut` over a Supabase client; consumers use
  `useAuth()`. New methods slot in without restructuring (`src/lib/auth.tsx:8`–`46`).
- **Single auth screen.** `src/app/sign-in.tsx` toggles sign-in / sign-up with email+password and
  redirects to `/` on session. It has natural slots for a Google button and a "Forgot password?"
  link (`src/app/sign-in.tsx:21`–`130`).
- **OAuth was deliberately deferred.** `src/lib/supabase.ts:19` sets `detectSessionInUrl: false`
  with the comment "no web OAuth redirect handling in the native app yet." No `flowType` is set
  (so the client default applies — we will pin PKCE explicitly).
- **Redirect deps present, auth-session absent.** `expo-web-browser` and `expo-linking` are
  installed; `expo-auth-session` is **not**. The chosen flow needs no new dependency.
- **Config is still scaffold-default.** `app.json` has `slug: ".bootstrap-scaffold"` and
  `scheme: "bootstrapscaffold"`. The scheme is load-bearing for deep-link redirects.
- **Routing is mid-refactor.** An uncommitted change moves the authenticated home screen into a
  gated `src/app/(app)/` group (`(app)/_layout.tsx` redirects unauthenticated users to
  `/sign-in`). New auth screens must be **public** — siblings of `sign-in`, outside `(app)`.
- **External config is user-owned.** A Google Cloud OAuth client and the Supabase Google provider
  - redirect allow-list live in dashboards the plan cannot mutate.

## Desired End State

A user on a fresh device can:

1. Tap **"Continue with Google"** on the sign-in screen, complete Google login in the in-app
   browser, and land authenticated on the home screen.
2. Tap **"Forgot password?"**, enter their email, receive a recovery email, tap its link **on the
   same device that requested the reset**, be taken to an in-app **reset-password** screen, set a new
   password, and sign in with it.

> **Same-device constraint (PKCE).** Password reset is supported **same-device only** this change.
> The PKCE code verifier is created on the device that calls `resetPasswordForEmail` and is required
> by `exchangeCodeForSession`; opening the recovery link on a different device has no stored verifier
> and fails. Cross-device recovery is explicitly out of scope (see _What We're NOT Doing_).

Verification: both flows demonstrated live in **Expo Go** (Phase 3 manual gate); `npm run lint`,
`npx tsc --noEmit`, and the unit test suite all green.

### Key Discoveries:

- `src/lib/auth.tsx:18`–`48` — `AuthProvider` shape to extend with three new methods.
- `src/app/sign-in.tsx:98`–`125` — CTA + toggle region where the Google button and forgot link go.
- `src/lib/supabase.ts:14`–`21` — client options; needs `flowType: 'pkce'` so
  `exchangeCodeForSession` works for both OAuth and recovery codes.
- `expo-linking` `Linking.createURL(path)` returns `exp://…/--/path` in Expo Go and `tellme://path`
  in a build — one helper covers both redirect targets without `expo-auth-session`.
- The `(app)` gate (`src/app/(app)/_layout.tsx`, uncommitted) means auth screens stay at
  `src/app/*`, not inside the group.

## What We're NOT Doing

- **No Apple Sign In** — deferred (PRD is Google-only). Flagged for the App Store release: Apple
  Guideline 4.8 requires Apple Sign In once Google is offered; tracked against F-01, not here.
- **No native Google account-picker** (`@react-native-google-signin`) — it breaks Expo Go.
- **No `expo-auth-session` dependency** — the Supabase + WebBrowser + `expo-linking` path covers it.
- **No dev/standalone build requirement** — everything must run in Expo Go this change.
- **No change to the email/password or logout flows** (S-03, already done) beyond adding siblings.
- **No automated browser/e2e harness** (Detox/Maestro) — OAuth happy path is verified manually.
- **No custom account-linking logic** — we surface a clear error on email collision, we don't
  build identity-merge logic.
- **No cross-device password reset** — PKCE ties the recovery code verifier to the requesting
  device (see _Desired End State_). Opening the link on a different device is an accepted failure
  this change; a cross-device design is deferred.

## Implementation Approach

Three phases, each independently verifiable. Phase 1 lays the library + config foundation (PKCE,
scheme, redirect helper, new `AuthProvider` methods) with unit tests over the pure logic. Phase 2
builds the UI and routing (Google button, forgot-password + reset-password public screens, deep-link
handling). Phase 3 supplies the dashboard runbook and gates on a live end-to-end demonstration in
Expo Go. Coding (Phases 1–2) is fully unblocked from dashboard access; only Phase 3 depends on it.

## Critical Implementation Details

- **PKCE is mandatory for both flows.** With `flowType: 'pkce'`, both the OAuth callback and the
  password-recovery email carry a `?code=…` that the app exchanges via
  `supabase.auth.exchangeCodeForSession(code)`. Keep `detectSessionInUrl: false` — exchange is
  manual on native. Setting this wrong makes the redirect return tokens the client never consumes.
- **One redirect helper, two environments.** `Linking.createURL('auth-callback')` /
  `Linking.createURL('reset-password')` must be the single source for `redirectTo` so Expo Go
  (`exp://`) and builds (`tellme://`) stay consistent with what is registered in Supabase. The
  Supabase redirect allow-list must include both the `exp://` dev pattern and `tellme://` (Phase 3).
- **OAuth sequencing.** Call `signInWithOAuth({ provider:'google', options:{ redirectTo,
skipBrowserRedirect:true }})` to get the URL, open it with
  `WebBrowser.openAuthSessionAsync(url, redirectTo)`, then on a `type:'success'` result parse `code`
  from the returned URL and `exchangeCodeForSession`. A `type:'cancel'`/`dismiss` is a user cancel,
  not an error — return quietly.
- **Recovery deep link can arrive cold.** The reset email may open the app from a killed state, so
  the `reset-password` screen must read the initial URL (`Linking.useURL()` / `getInitialURL`) as
  well as live events, exchange the code, then allow `updateUser({ password })`.
- **Recovery is same-device only (PKCE).** `exchangeCodeForSession` needs the code verifier stored
  by `resetPasswordForEmail` on the requesting device. Opening the link on a different device (or
  after app storage is cleared) yields a "missing code verifier"-class failure — the reset screen
  must treat that as a recoverable error (clear message + restart link), indistinguishable in copy
  from an expired/invalid code. Confirm the exact error string during Phase 3.

## Phase 1: Auth foundation — config + AuthProvider methods

### Overview

Stand up the test runner (none exists yet), pin PKCE, fix the app identity/scheme, add a redirect
helper, and extend `AuthProvider` with `signInWithGoogle`, `resetPassword`, and `updatePassword` —
including email-collision error mapping.

### Changes Required:

#### 1. Test runner setup (do this first)

**File**: `package.json` (+ `jest.config.js` / `jest.setup.js` as needed)

**Intent**: The repo has no test runner or `test` script today, yet every phase's success criteria
and the `## Progress` rows call `npm test`. Establish the runner and convention before any test file
is written, or `/10x-implement` fails on an undefined command at row 1.3.

**Contract**: Install **`jest-expo`** (the Expo-documented testing path for SDK 54; it ships the
preset that transforms RN/Expo modules and lets `expo-linking` be mocked, which `authRedirectUrl`
needs). Add `"test": "jest"` to `scripts` (use `jest --watchAll=false` semantics in CI). Configure
`preset: "jest-expo"`. Define the test-location convention as colocated `__tests__/` folders
(`src/lib/__tests__/…`, `src/app/__tests__/…`) — used by step 6 below and Phase 2 step 4. A
trivial smoke test (`expect(true).toBe(true)`) must run green before real tests are added.

#### 2. App identity & deep-link scheme

**File**: `app.json`

**Intent**: Replace scaffold placeholders so deep links are production-clean and stable for the
registered redirect URIs.

**Contract**: Set `expo.slug` to `tellme` and `expo.scheme` to `tellme`. No other keys change.

#### 3. Supabase client — PKCE

**File**: `src/lib/supabase.ts`

**Intent**: Enable manual code exchange for OAuth and recovery on native.

**Contract**: Add `flowType: 'pkce'` to the `auth` options; keep `detectSessionInUrl: false`.
Update the stale comment to reflect that OAuth redirect handling now exists (PKCE, manual exchange).

#### 4. Redirect-URL helper

**File**: `src/lib/auth-redirect.ts` (new)

**Intent**: Single source for redirect URLs so Expo Go and builds stay consistent with the
Supabase allow-list.

**Contract**: Export `authRedirectUrl(path: 'auth-callback' | 'reset-password'): string` wrapping
`Linking.createURL(path)`. Pure, unit-testable.

#### 5. AuthProvider — Google, reset, update

**File**: `src/lib/auth.tsx`

**Intent**: Add the three new auth operations behind the existing `useAuth()` contract.

**Contract**: Extend `AuthState` with:

- `signInWithGoogle(): Promise<Result>` — `signInWithOAuth` (skipBrowserRedirect) →
  `WebBrowser.openAuthSessionAsync` → `exchangeCodeForSession`; user cancel returns `{}` (no error).
- `resetPassword(email: string): Promise<Result>` — `supabase.auth.resetPasswordForEmail(email,
{ redirectTo: authRedirectUrl('reset-password') })`.
- `updatePassword(password: string): Promise<Result>` — `supabase.auth.updateUser({ password })`.
- An exported pure helper `mapAuthError(error)` that maps Supabase's email-collision error to a
  user-facing string ("This email already uses password sign-in — sign in with your password.")
  and otherwise returns `error.message`. Used by `signInWithGoogle`. Keep `Result` shape consistent
  with existing methods.

#### 6. Unit tests for pure logic

**File**: `src/lib/__tests__/auth-redirect.test.ts`, `src/lib/__tests__/map-auth-error.test.ts`
(colocated `__tests__/` convention established in step 1; mock `expo-linking` via the `jest-expo`
preset so `authRedirectUrl` is exercised without a native runtime)

**Intent**: Lock the brittle URL + error-mapping logic where redirect bugs hide.

**Contract**: Assert `authRedirectUrl` returns the expected path suffix; assert `mapAuthError`
returns the collision message for the collision error code and passthrough otherwise.

### Success Criteria:

#### Automated Verification:

- Test runner runs: `npm test` (script added in step 1; smoke test green)
- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Unit tests pass: `npm test`

#### Manual Verification:

- App still boots in Expo Go and existing email/password sign-in/out is unaffected.

**Implementation Note**: After automated verification passes, pause for manual confirmation before
Phase 2.

---

## Phase 2: UI & routing — Google button, forgot-password, reset screen + deep link

### Overview

Expose the new auth operations: a Google button and "Forgot password?" link on the sign-in screen,
a forgot-password request screen, and a reset-password screen that consumes the recovery deep link.

### Changes Required:

#### 1. Sign-in screen — Google + forgot link

**File**: `src/app/sign-in.tsx`

**Intent**: Add "Continue with Google" (calls `signInWithGoogle`) and a "Forgot password?" link to
the forgot-password route. Surface mapped errors in the existing error slot.

**Contract**: New button below the existing CTA wired to `signInWithGoogle` with busy/disabled
state mirroring the current submit handling; a `Link`/navigation to `/forgot-password`. Use typed
routes (no string literals) per repo convention. No change to the email/password path.

#### 2. Forgot-password screen (public)

**File**: `src/app/forgot-password.tsx` (new)

**Intent**: Collect an email and trigger the recovery email.

**Contract**: Email input + submit calling `resetPassword`; on success show a "check your email"
confirmation and a link back to `/sign-in`. Public route (sibling of `sign-in`, outside `(app)`).

#### 3. Reset-password screen (public, deep-link target)

**File**: `src/app/reset-password.tsx` (new)

**Intent**: Consume the recovery deep link, establish the recovery session, and let the user set a
new password.

**Contract**: On mount, read the incoming URL (initial + live), extract `code`, call
`exchangeCodeForSession`; on success render a new-password + confirm form calling `updatePassword`,
then redirect to `/` (or `/sign-in`). Handle missing/expired code with a clear error and a link to
restart via `/forgot-password`. Public route. (See Critical Implementation Details — cold start.)

#### 4. Unit tests for parsing + validation

**File**: `src/app/__tests__/reset-password.test.ts` (or colocated per convention)

**Intent**: Cover code extraction from the deep-link URL and new-password validation (non-empty,
match confirm) without rendering the browser flow.

**Contract**: Pure helper for `code` extraction is unit-tested for present/absent/malformed URLs;
password-match validation asserted. Extract any parsing logic into a testable pure function.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Unit tests pass: `npm test`

#### Manual Verification:

- Sign-in screen shows the Google button and "Forgot password?" link; layout intact on iOS.
- Forgot-password screen sends a request and shows the confirmation state.
- Reset-password screen renders its form when opened with a `code` param and shows a clear error
  without one. (Full live deep-link demonstrated in Phase 3.)

**Implementation Note**: After automated verification passes, pause for manual confirmation before
Phase 3.

---

## Phase 3: External config runbook + end-to-end verification

### Overview

Document and run the dashboard configuration, then prove both flows live in Expo Go. This phase
gates "done."

### Changes Required:

#### 1. Setup runbook

**File**: `context/changes/complete-auth-oauth-reset/oauth-setup-runbook.md` (new)

**Intent**: Give the user exact, ordered dashboard steps so the live flow works and is reproducible.

**Contract**: Step-by-step covering:

- **Google Cloud**: create an OAuth client; authorized redirect URI = the Supabase project
  callback (`https://<project>.supabase.co/auth/v1/callback`).
- **Supabase → Auth → Providers → Google**: enable, paste client ID/secret.
- **Capture the exact redirect values first (diagnostic step).** Before touching the dashboard, run
  the app and log `authRedirectUrl('auth-callback')` and `authRedirectUrl('reset-password')` (a
  temporary `console.log` on the sign-in screen, or a debug button). This prints the live `exp://…`
  values for _this_ machine/session — do not hand-type them. `WebBrowser.openAuthSessionAsync(url,
redirectUrl)` only resolves when the returned URL matches the registered redirect, so an
  approximate `exp://` pattern is the most likely failure mode.
- **Supabase → Auth → URL Configuration → Redirect URLs**: paste the two exact `exp://…` values from
  the diagnostic step, plus the production `tellme://auth-callback` and `tellme://reset-password`
  variants. Note that the `exp://` host/port changes per machine/session, so this list is re-checked
  whenever the dev URL changes.
- **Supabase → Auth → Email Templates → Reset Password**: ensure the recovery link points at the
  redirect (carrying `code` for PKCE).
- A short "how to find your `exp://` URL in Expo Go" note (it varies per machine/session) — the
  diagnostic step above is the source of truth.

#### 2. Execution + verification

**Intent**: Run the runbook and demonstrate the flows.

**Contract**: User completes the runbook; then both flows are exercised on a real device/simulator
via Expo Go.

### Success Criteria:

#### Automated Verification:

- Full suite green: `npx tsc --noEmit`, `npm run lint`, `npm test`.

#### Manual Verification:

- **Google login in Expo Go**: tapping "Continue with Google" completes Google auth in the in-app
  browser and returns to an authenticated home screen with a persisted session.
- **Password reset in Expo Go (same device)**: requesting a reset, opening the email link **on the
  same device/session**, setting a new password, and signing in with it all succeed.
- **Cross-device reset is a graceful failure**: opening the recovery link on a different device (or
  after clearing app storage) shows the reset screen's recoverable error + restart link, not a
  crash or silent dead-end. Record the exact Supabase error string observed.
- **Email-collision path**: attempting Google with an email already registered via password shows
  the mapped guidance message (or auto-links per the verified Supabase setting — behavior is
  understood, not silent).
- **Cancel path**: dismissing the Google browser leaves the user on sign-in with no error toast.

**Implementation Note**: This is the final manual gate; the change is done when both flows are
demonstrated live.

---

## Testing Strategy

### Unit Tests:

- `authRedirectUrl` returns the correct path suffix for each target.
- `mapAuthError` maps the collision error to guidance, passes others through.
- Recovery deep-link `code` extraction: present / absent / malformed URLs.
- New-password validation: non-empty and matches confirmation.

### Integration Tests:

- None automated (OAuth requires a real browser + Google); covered by the Phase 3 manual e2e.

### Manual Testing Steps:

1. Email/password sign-in/out still works (regression).
2. Continue with Google → authenticated home (Expo Go).
3. Cancel the Google browser → back on sign-in, no error.
4. Forgot password → email arrives → link opens reset screen → set password → sign in with it.
5. Reset screen opened without a code → clear error + restart link.
6. Google with an email already used for password → mapped guidance (or verified auto-link).

## Performance Considerations

Negligible — auth is interactive and infrequent. No hot paths touched.

## Migration Notes

Changing `app.json` `scheme`/`slug` changes the app's deep-link scheme; any previously registered
redirect URIs must be updated to `tellme://` (handled in the Phase 3 runbook). No data migration.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-04, north star)
- PRD: `context/foundation/prd.md` (FR-001 Google path, FR-002, Access Control)
- Tech stack: `context/foundation/tech-stack.md` (Expo native auth)
- Auth module: `src/lib/auth.tsx:8`–`55`
- Sign-in screen: `src/app/sign-in.tsx:21`–`130`
- Supabase client: `src/lib/supabase.ts:14`–`21`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Auth foundation — config + AuthProvider methods

#### Automated

- [x] 1.0 Test runner installed (`jest-expo`), `npm test` script added, smoke test green — 950c015
- [x] 1.1 Type checking passes: `npx tsc --noEmit` — 950c015
- [x] 1.2 Linting passes: `npm run lint` — 950c015
- [x] 1.3 Unit tests pass: `npm test` — 950c015

#### Manual

- [x] 1.4 App boots in Expo Go; existing email/password sign-in/out unaffected — 950c015

### Phase 2: UI & routing — Google button, forgot-password, reset screen + deep link

#### Automated

- [x] 2.1 Type checking passes: `npx tsc --noEmit` — 154bc61
- [x] 2.2 Linting passes: `npm run lint` — 154bc61
- [x] 2.3 Unit tests pass: `npm test` — 154bc61

#### Manual

- [x] 2.4 Sign-in shows Google button + "Forgot password?" link; iOS layout intact — 154bc61
- [x] 2.5 Forgot-password screen sends request and shows confirmation — 154bc61
- [x] 2.6 Reset-password screen renders form with `code` param; clear error without one — 154bc61

### Phase 3: External config runbook + end-to-end verification

#### Automated

- [x] 3.1 Full suite green: `npx tsc --noEmit`, `npm run lint`, `npm test`

#### Manual

- [x] 3.2 Google login completes in Expo Go → authenticated home, session persists
- [ ] 3.3 Password reset completes in Expo Go, same device (request → email link → set → sign in)
- [x] 3.4 Cross-device reset fails gracefully (recoverable error + restart link; error string noted)
- [x] 3.5 Email-collision path shows mapped guidance (or verified auto-link)
- [x] 3.6 Cancel path leaves user on sign-in with no error
