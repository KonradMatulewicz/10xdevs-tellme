# Complete Authentication — Google Sign-In + Password Reset — Plan Brief

> Full plan: `context/changes/complete-auth-oauth-reset/plan.md`

## What & Why

Complete Tellme's auth surface by adding **Sign in with Google** (FR-001 Google path) and
**password reset via email** (FR-002) on top of the existing email/password foundation. This is the
roadmap **north star (S-04)** — the last functional gap before any user can fully onboard on a fresh
device, and pure software with no external publishing gate.

## Starting Point

`src/lib/auth.tsx` is a clean `AuthProvider` (email/password sign-in/up/out); `src/app/sign-in.tsx`
is the single auth screen. OAuth was deliberately deferred — `src/lib/supabase.ts:19` sets
`detectSessionInUrl: false` with a "no OAuth redirect handling yet" note. `expo-web-browser` +
`expo-linking` are installed (`expo-auth-session` is not); `app.json` still has scaffold-default
`slug`/`scheme`.

## Desired End State

A user on a fresh device can tap **"Continue with Google"** and land authenticated, or tap
**"Forgot password?"**, get a recovery email, follow its link into an in-app reset screen, set a new
password, and sign in — both demonstrated live in **Expo Go**.

## Key Decisions Made

| Decision           | Choice                                          | Why                                                             | Source |
| ------------------ | ----------------------------------------------- | --------------------------------------------------------------- | ------ |
| Google flow        | Supabase `signInWithOAuth` + WebBrowser (PKCE)  | Uses installed deps, official Expo guide, works in Expo Go      | Plan   |
| Password reset     | Deep link → in-app reset screen                 | Fully native, matches FR-002                                    | Plan   |
| Redirect target    | Make it work in Expo Go now                     | Preserves free iOS testing loop (SDK-54 constraint)             | Plan   |
| Redirect helper    | `expo-linking` `Linking.createURL` (no new dep) | One source for `exp://` (Go) + `tellme://` (build)              | Plan   |
| Scheme/slug        | Fix to `tellme`, register dev + prod redirects  | Production-clean deep links, no rework at release               | Plan   |
| Email collision    | Surface clear guidance message                  | No silent surprises; no custom identity-merge logic             | Plan   |
| Apple Sign In      | Defer                                           | PRD is Google-only; required only at App Store release (F-01)   | Plan   |
| Definition of done | Code + runbook + live e2e in Expo Go            | Proves it works, not just "code written"                        | Plan   |
| Testing            | Light unit tests + manual e2e                   | Covers brittle URL/parse logic; avoids flaky browser automation | Plan   |

## Scope

**In scope:** Google Sign-In (PKCE via WebBrowser); password-reset request + deep-link reset screen;
`flowType: 'pkce'`; `app.json` scheme/slug fix; redirect helper; error mapping; unit tests; dashboard
runbook; live verification.

**Out of scope:** Apple Sign In; native Google account-picker; `expo-auth-session`; dev-build-only
flows; custom account-linking; e2e browser automation; changes to existing email/password + logout.

## Architecture / Approach

`AuthProvider` gains `signInWithGoogle` / `resetPassword` / `updatePassword`. Google: get URL from
`signInWithOAuth` → open with `WebBrowser.openAuthSessionAsync` → parse `code` →
`exchangeCodeForSession`. Reset: `resetPasswordForEmail(redirectTo)` → recovery email deep-links to a
public `reset-password` screen → exchange `code` → `updateUser({password})`. New `forgot-password`
and `reset-password` screens are **public** (siblings of `sign-in`, outside the `(app)` gate).

## Phases at a Glance

| Phase                         | What it delivers                                              | Key risk                                            |
| ----------------------------- | ------------------------------------------------------------- | --------------------------------------------------- |
| 1. Auth foundation            | PKCE, scheme fix, redirect helper, 3 new AuthProvider methods | Getting PKCE/redirect config right up front         |
| 2. UI & routing               | Google button, forgot + reset screens, deep-link handling     | Cold-start deep link; public-route placement        |
| 3. Runbook + e2e verification | Dashboard runbook + live Google + reset proof in Expo Go      | Redirect-URI / allow-list friction (the named risk) |

**Prerequisites:** Supabase + Google Cloud dashboard access (user-owned); awareness that the
uncommitted `(app)` gated-group refactor places new auth screens as public siblings of `sign-in`.
**Estimated effort:** ~2–3 sessions across 3 phases.

## Open Risks & Assumptions

- **Expo Go `exp://` redirect URLs vary per machine/session** — the Supabase allow-list must permit
  the dev pattern; the runbook documents how to find the current URL.
- **`(app)` routing refactor is uncommitted** — plan assumes new screens are public siblings of
  `sign-in`; if the refactor lands first, confirm they sit outside `(app)`.
- **Email-collision behavior depends on a Supabase project setting** — verified during the runbook,
  not coded around.
- **Apple Sign In debt** — App Store Guideline 4.8 will require it before public iOS release.

## Success Criteria (Summary)

- A new user can sign in with Google end-to-end in Expo Go and stays signed in across launches.
- A user can reset a forgotten password via email link entirely in-app and sign in with the new one.
- Cancel and email-collision edge cases behave clearly; lint/typecheck/unit tests green.
