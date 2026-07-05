# OAuth & Password-Reset Setup Runbook

One-time dashboard configuration for **Sign in with Google** and **password reset via email**,
plus the per-session redirect-URL refresh needed for Expo Go testing. Run the steps in order.
Everything the app itself needs is already in code (PKCE flow, `tellme` scheme, redirect helper);
this runbook covers only the external config the repo cannot mutate.

- Supabase project: `mzbpchvzmuaqpuomwrpu` → https://supabase.com/dashboard/project/mzbpchvzmuaqpuomwrpu
- Supabase auth callback (needed in step 1): `https://mzbpchvzmuaqpuomwrpu.supabase.co/auth/v1/callback`
- App deep-link scheme (builds): `tellme://`
- Expo Go dev URLs: `exp://…/--/<path>` — captured live in step 3, **never hand-typed**

---

## Step 1 — Google Cloud: create the OAuth client

1. Open https://console.cloud.google.com/apis/credentials (create/select a project, e.g. `tellme`).
2. If prompted, configure the **OAuth consent screen** first:
   - User type: **External**, publishing status **Testing** is fine for now.
   - Add your Google account under **Test users** (required while in Testing, otherwise
     sign-in fails with `access_denied`).
   - Scopes: the defaults (`email`, `profile`, `openid`) are all Supabase needs.
3. **Create credentials → OAuth client ID**:
   - Application type: **Web application** (yes, web — Supabase's server does the exchange;
     the app never talks to Google directly).
   - Name: `tellme-supabase`.
   - **Authorized redirect URIs** — add exactly one:
     ```
     https://mzbpchvzmuaqpuomwrpu.supabase.co/auth/v1/callback
     ```
4. Save and copy the **Client ID** and **Client secret**.

## Step 2 — Supabase: enable the Google provider

1. Dashboard → **Authentication → Sign In / Providers → Google**.
2. Toggle **Enable Sign in with Google**.
3. Paste the **Client ID** and **Client secret** from step 1.
4. Leave "Skip nonce checks" off; no authorized client IDs are needed (we don't use native
   Google sign-in).
5. Save.

> **Email-collision behavior (relevant to test 3.5):** Supabase's default is to link a Google
> identity onto an existing account with the same **verified** email. If the existing account's
> email is unverified, sign-in fails and the app shows the mapped guidance message
> ("This email already uses password sign-in — sign in with your password."). Note which
> behavior you observe during verification — either is acceptable per the plan, it just must
> be understood, not silent.

## Step 3 — Capture the exact redirect URLs (diagnostic, do this before step 4)

`WebBrowser.openAuthSessionAsync(url, redirectUrl)` only resolves when the returned URL matches
the registered redirect **exactly**, so an approximate `exp://` pattern is the most likely
failure mode. Do not guess the values — print them:

1. Add a temporary log to `src/app/sign-in.tsx` (top of the component body):
   ```ts
   import { authRedirectUrl } from '@/lib/auth-redirect';
   console.log('auth-callback  →', authRedirectUrl('auth-callback'));
   console.log('reset-password →', authRedirectUrl('reset-password'));
   ```
2. Start the dev server — **on this machine use the tunnel** (LAN QR does not work here):
   ```
   npx expo start --tunnel
   ```
3. Open the app in Expo Go (scan the QR) and read the two URLs off the Metro console. With the
   tunnel they look like:
   ```
   exp://<random-slug>-anonymous-8081.exp.direct/--/auth-callback
   exp://<random-slug>-anonymous-8081.exp.direct/--/reset-password
   ```
4. Copy both verbatim, then **remove the temporary log** before committing anything.

> **These values rotate.** The `exp://` host is per-machine and per-tunnel-session. Whenever the
> printed URL changes (new tunnel slug), re-run this step and update the allow-list in step 4.
> If Google sign-in suddenly hangs in the browser or the reset email links stop opening the app,
> a stale redirect URL is the first thing to check.

## Step 4 — Supabase: redirect allow-list

1. Dashboard → **Authentication → URL Configuration → Redirect URLs**.
2. Add all four values:

   | Purpose                   | URL                                             |
   | ------------------------- | ----------------------------------------------- |
   | Dev — Google callback     | the exact `…/--/auth-callback` URL from step 3  |
   | Dev — reset link target   | the exact `…/--/reset-password` URL from step 3 |
   | Build — Google callback   | `tellme://auth-callback`                        |
   | Build — reset link target | `tellme://reset-password`                       |

3. Optional, to reduce churn while the tunnel slug rotates, you may additionally add wildcard
   dev patterns (Supabase supports globs in this list):
   ```
   exp://*.exp.direct/--/auth-callback
   exp://*.exp.direct/--/reset-password
   ```
   Keep the exact URLs from step 3 registered as well — the wildcards are a convenience, the
   exact values are the source of truth if anything misbehaves.
4. Save.

## Step 5 — Supabase: reset-password email template

1. Dashboard → **Authentication → Emails → Templates → Reset Password**.
2. Ensure the link uses the redirect + PKCE token hash form. The default template's
   `{{ .ConfirmationURL }}` already resolves to
   `…/auth/v1/verify?token=…&type=recovery&redirect_to=<redirectTo>` and lands on the
   `redirect_to` with `?code=…` — that is what the reset screen consumes. If the template was
   customized, restore `{{ .ConfirmationURL }}`.
3. No SMTP change needed — the built-in Supabase mailer is fine for this verification (note its
   ~2 emails/hour rate limit on the free tier; don't burn retries).

## Step 6 — Live verification (Expo Go, same device)

Run with the tunnel (`npx expo start --tunnel`), app opened fresh in Expo Go on the iPhone.

1. **Google login (3.2):** Sign-in screen → _Continue with Google_ → complete Google auth in the
   in-app browser → should land on the authenticated home screen. Kill and reopen the app: the
   session persists.
2. **Password reset, same device (3.3):** _Forgot password?_ → enter the account email → email
   arrives → tap its link **on the iPhone** → app opens the reset screen, verifies the code →
   set a new password → sign out → sign in with the new password.
3. **Cross-device reset fails gracefully (3.4):** Request a reset, open the emailed link on a
   _different_ device/browser (or after clearing the app's storage). Expect the reset screen's
   recoverable error ("could not be verified … Request a new link") with the restart link — not
   a crash. **Record the exact Supabase error string** (visible in the Metro console) here:
   - Observed error: recoverable error screen with "Request a new link" confirmed (2026-07-05);
     the exact underlying Supabase error string was not captured — record it when re-running
     alongside the pending 3.3 test.
4. **Email collision (3.5):** With an account that already uses password sign-in, tap _Continue
   with Google_ using that same Google email. Expect either the mapped guidance message or a
   successful auto-link (see step 2 note). Record which:
   - Observed behavior: **auto-link** (2026-07-05) — Google sign-in with an email already
     registered via password (and confirmed) logged in silently, no collision message. This is
     Supabase's default for verified emails; the mapped guidance message remains the fallback
     for unverified ones.
5. **Cancel path (3.6):** Tap _Continue with Google_, then dismiss the browser sheet. Expect to
   stay on sign-in with no error shown.

## Troubleshooting

- **"Network request failed" + NXDOMAIN on the Supabase URL** → the free-tier project is paused.
  Restore it from the dashboard before debugging anything else.
- **Browser completes Google auth but the app never returns** → redirect URL mismatch; re-run
  step 3 and fix the allow-list (step 4).
- **`redirect_to` ignored / lands on localhost** → the URL isn't in the allow-list; Supabase
  silently falls back to the Site URL.
- **Reset link opens the browser, not the app** → scan the link's QR with the iPhone Camera app
  or ensure the mail client opens links externally; `exp://` links only resolve while the same
  tunnel session is running.
- **`access_denied` from Google** → your account isn't in the consent screen's Test users list.
- **"missing code verifier" class errors on reset** → the link was opened on a device/session
  other than the one that requested it — expected, this is the 3.4 graceful-failure path.
