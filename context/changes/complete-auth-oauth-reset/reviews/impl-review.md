<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Complete Authentication — Google Sign-In + Password Reset

- **Plan**: context/changes/complete-auth-oauth-reset/plan.md
- **Scope**: Full plan (Phases 1–3)
- **Date**: 2026-07-05
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 6 warnings, 4 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | WARNING |

## Findings

### F1 — PKCE degrades to weak primitives (no crypto polyfill)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/supabase.ts:24, package.json
- **Detail**: Hermes has no `crypto.getRandomValues` / `crypto.subtle`. Verified in installed `@supabase/auth-js`: without them the PKCE verifier is built from `Math.random()` (non-cryptographic PRNG) and the challenge method falls back to `plain` — matching the observed "WebCrypto API is not supported" console warning. Not critical (the verifier never travels in the redirect), but it removes exactly the defense-in-depth PKCE exists to provide on mobile.
- **Fix A ⭐ Recommended**: Add `react-native-get-random-values` and import it at the top of src/lib/supabase.ts (before supabase imports) — restores a CSPRNG verifier.
  - Strength: One dependency + one import; works in Expo Go; removes the guessable-verifier issue (the material risk).
  - Tradeoff: Challenge method stays `plain` (verifier still not hashed in the authorize URL).
  - Confidence: HIGH — documented supabase-js RN setup step.
  - Blind spot: Must verify the console warning about the verifier source disappears (the WebCrypto warning will remain).
- **Fix B**: Fix A plus shim `crypto.subtle.digest` via `expo-crypto` to restore S256.
  - Strength: Full PKCE strength (S256), warning gone entirely.
  - Tradeoff: Hand-rolled global shim to maintain; more surface for subtle bugs.
  - Confidence: MEDIUM — shim correctness needs a live OAuth round-trip to verify.
  - Blind spot: Interaction with future supabase-js upgrades.
- **Decision**: FIXED via Fix A — react-native-get-random-values installed, imported first in src/lib/supabase.ts

### F2 — reset-password can strand the user on an infinite spinner

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/app/reset-password.tsx:38-58, 91-98
- **Detail**: (a) If `Linking.useURL()` stays `null` (standalone build opened without a deep link) the screen sits in `verifying` forever with no link out. (b) `exchangeCodeForSession(code).then(...)` has no `.catch` — a thrown (non-AuthError) failure leaves the same dead-end spinner plus an unhandled rejection.
- **Fix**: Render the "Request a new link" link in the `verifying` state too (or time out to `error` after a few seconds of `url == null`), and append `.catch(() => { setStatus('error'); setError(…); })` to the exchange.
- **Decision**: FIXED — escape-hatch link added to `verifying` state; `.catch` appended to the exchange chain

### F3 — Boolean `exchanged` ref blocks a second, fresh recovery code

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/app/reset-password.tsx:30,39,46
- **Detail**: After a failed exchange (expired link), a new link tapped while the screen stays mounted delivers a new `?code=`, but `exchanged.current === true` blocks the exchange — the stale error persists.
- **Fix**: Guard on the code value (`lastCode` ref) instead of a boolean; reset status to `verifying` when a new code arrives. Keep setting the ref before the async call.
- **Decision**: FIXED — `exchanged` boolean replaced with `lastCode` ref; status resets to `verifying` on a new code

### F4 — Unhandled promise rejections in AuthProvider

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/auth.tsx:49-52, 72-96
- **Detail**: (a) `WebBrowser.openAuthSessionAsync` can reject (e.g., concurrent auth session on Android); `signInWithGoogle` has no try/catch, so `googleBusy` never clears and both buttons stay disabled forever. (b) `getSession().then(...)` has no `.catch` — a rejection leaves `loading: true` app-wide (permanent gate spinner).
- **Fix**: Wrap the `signInWithGoogle` body in try/catch returning `{ error: mapAuthError(e) }`; add `.catch(() => setLoading(false))` to the `getSession` chain.
- **Decision**: FIXED — try/catch around `signInWithGoogle` body; `getSession` chain now `.catch(() => {}).finally(() => setLoading(false))`

### F5 — Unjustified `'/' as Href` casts (typed-routes contract)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/app/sign-in.tsx:32, src/app/reset-password.tsx:61
- **Detail**: Generated `.expo/types/router.d.ts` includes bare `/` in the href union (group segments are optional), so the code comment justifying the cast is factually wrong. This is the one place the repo's "no plain string route literals" rule is bypassed.
- **Fix**: Replace both with `<Redirect href="/" />`, delete the casts, comments, and unused `Href` imports.
- **Decision**: FIXED — both casts replaced with typed `href="/"`; `Href` imports removed

### F6 — No `auth-callback` route (Android unmatched-route screen)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/auth.tsx:73 (redirect target), src/app/ (missing file)
- **Detail**: `authRedirectUrl('auth-callback')` is the OAuth return URL but no `src/app/auth-callback.tsx` route exists. iOS's auth session consumes the redirect, but on Android the redirect also arrives as a deep link and expo-router shows the default "Unmatched Route" screen.
- **Fix**: Add a trivial `src/app/auth-callback.tsx` that redirects to `/`.
- **Decision**: FIXED — `src/app/auth-callback.tsx` added (redirects to `/`)

### F7 — Unrelated files bundled into phase commits

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: commits 950c015, 154bc61
- **Detail**: Phase 1/2 commits carry files outside the plan (Prework/_, .claude/skills/_, roadmap.md, UI components from the routing refactor) — likely "Stage all" at the dirty-paths prompt. History has landed; rewriting is not worth it.
- **Fix**: None retroactively; prefer "stage only the planned set" in future phase commits (candidate for lessons.md).
- **Decision**: ACCEPTED-AS-RULE: "Stage only the planned set at phase commits" (context/foundation/lessons.md); no retroactive history rewrite

### F8 — Error-mapping and code-extraction inconsistencies

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/auth.tsx:61-101, src/lib/recovery.ts:15-20
- **Detail**: `mapAuthError` is applied only on the Google path (signIn/signUp/resetPassword return raw messages); two different query-code extractors exist (`Linking.parse` vs `extractRecoveryCode`); `extractRecoveryCode` doesn't strip `#fragment` and ignores `?error=`/`error_description` params from Supabase error redirects.
- **Fix**: Route all returned errors through `mapAuthError`; consolidate on `extractRecoveryCode` and make it fragment-safe, surfacing `error_description` when present.
- **Decision**: FIXED — all AuthProvider errors routed through `mapAuthError`; Google path uses `extractRecoveryCode`; parser fragment-safe; `extractAuthErrorDescription` added and surfaced on the reset screen; 4 new unit tests

### F9 — `@types/jest@^30` paired with `jest@^29`

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: package.json
- **Detail**: Type/runtime major mismatch can produce phantom type errors as the APIs drift.
- **Fix**: Align to `@types/jest@^29`.
- **Decision**: FIXED — `@types/jest` aligned to ^29

### F10 — Manual criterion 3.3 pending; 3.4 error string not captured

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md Progress 3.3; oauth-setup-runbook.md step 6
- **Detail**: 3.3 (same-device password reset) deferred due to the Supabase free-tier email rate limit — honestly documented, will surface at /10x-archive. 3.4's exact Supabase error string was not recorded (UI behavior confirmed).
- **Fix**: Complete 3.3 when the rate limit clears; capture the 3.4 error string in the same session.
- **Decision**: SKIPPED — deliberately deferred by user (deadline); tracked by the unchecked 3.3 Progress row

## Success criteria evidence (2026-07-05)

- `npx tsc --noEmit` → exit 0
- `npm run lint` → exit 0
- `npm test` → 4 suites, 15 tests passed
- Manual: 1.4, 2.4–2.6, 3.2, 3.4–3.6 confirmed by user; 3.3 pending (deferred, rate limit)
