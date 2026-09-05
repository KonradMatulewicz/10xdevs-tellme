---
title: 'Anti-Corruption Layer refactor plan — Supabase Auth port'
created: 2026-09-04
type: refactor-plan
---

# Anti-Corruption Layer — the auth port (`lib/auth.tsx`) bypassed directly

**This document's product is a PLAN, not an implementation.** No code has been changed.

## Step 1 — Identifying leaking dependencies

The repo has one domain port for auth: `src/lib/auth.tsx` (`AuthProvider`/`useAuth()`), which wraps `@supabase/supabase-js`'s `supabase.auth.*`. Checked every place that "knows" this package or its wrapped singleton:

- `grep -rn "supabase\.auth\." src/` → 9 calls in `src/lib/auth.tsx` (`onAuthStateChange`, `signInWithPassword`, `signUp`, `signOut`, `signInWithOAuth`, `exchangeCodeForSession`, `resetPasswordForEmail`, `updateUser`) + 1 in `src/lib/api.ts:10` (`getSession`, to fetch the token for the `Authorization` header).
- `grep -rn "from '@/lib/supabase'" src/` → three files: `src/lib/api.ts`, `src/lib/auth.tsx` (expected — the port itself and its infrastructure neighbor), **and `src/app/reset-password.tsx`** — a UI file, a screen.

**The worst leak**: `src/app/reset-password.tsx:25,62-63` imports `supabase` directly and calls `supabase.auth.exchangeCodeForSession(code)` **bypassing `lib/auth.tsx` entirely**, even though `lib/auth.tsx:100` **already calls the exact same method** (`supabase.auth.exchangeCodeForSession(code)`) inside `signInWithGoogle`. The same SDK operation has two independent implementations in the repo today.

A second, weaker leak: `AuthState.session: Session | null` in `src/lib/auth.tsx:13` exposes a type straight from `@supabase/supabase-js` as part of the port's public contract, instead of a domain type of its own.

## Step 2 — Classification and selecting the worst leak

| Leak                                                                                 | (a) Number of files touched                                                                                                                                     | (b) Cost of swapping today                                                                                                                                  | (c) Does a document declare replaceability?                                                                                                                                                            |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `exchangeCodeForSession` called directly in `reset-password.tsx`, bypassing the port | 2 (`auth.tsx`, `reset-password.tsx`)                                                                                                                            | Swapping Supabase Auth for another provider would require finding and fixing **two** independent implementations of the same operation, risking missing one | Not explicit, but `auth.tsx` exists precisely to be the only place that "knows" Supabase Auth — the file's purpose is evident from its own structure (the `AuthState` interface, the `useAuth()` hook) |
| The vendor `Session` type in `AuthState.session`                                     | 1 file defines it, 2 files consume it (`(app)/_layout.tsx`, `sign-in.tsx`) — but **no consumer reaches for a Supabase-specific field**, only checks `!!session` | Low — confirmed by grep that the only uses outside `auth.tsx` are truthiness checks                                                                         | No                                                                                                                                                                                                     |

**Choice: `exchangeCodeForSession` in `reset-password.tsx`.** This isn't a hypothetical future-vendor-swap risk (as in the classic ACL example) — it's **an already-existing duplication with a real, present cost**: two implementations of the same operation have two different error-handling strategies (see Step 3). The `Session`-as-a-type leak is real but low-risk given how narrowly it's consumed today — noted, not escalated to #1.

## Step 3 — Diagnosis

**`src/lib/auth.tsx:77-107` (`signInWithGoogle`)** — calls `exchangeCodeForSession` at line 100, the error is mapped through `mapAuthError()` (`auth.tsx:27-40` — a dedicated function, tested in `src/lib/__tests__/map-auth-error.test.ts`, 4 cases), including a special "email already exists" case with a friendly message.

**`src/app/reset-password.tsx:55-81`** — the same SDK call, but:

```
supabase.auth
  .exchangeCodeForSession(code)
  .then(({ error: exchangeErr }) => {
    if (exchangeErr) {
      setExchangeStatus('error');
      setExchangeError('This reset link could not be verified. It may have expired or been opened on a different device...');
    }
```

The error here **does not go through `mapAuthError`** — it's a separate, hand-written message, stylistically and informationally inconsistent with what `signInWithGoogle` would return for an analogous code-exchange error. If `mapAuthError` were to gain a new specialization for code-exchange errors in the future (e.g. distinguishing "code expired" from "code already used"), `reset-password.tsx` wouldn't get it — someone would have to remember there are two places.

This isn't hypothetical: `reset-password.tsx` and `signInWithGoogle` **both** implement OAuth-style code exchange (PKCE `flowType`, `src/lib/supabase.ts:26`) for two different flows (Google sign-in, password reset) — the same SDK mechanism, two independent implementations in the code.

## Step 4 — ACL design

**A domain function** (an extension of the existing `auth.tsx` port, not a new file): add `exchangeAuthCode(code: string): Promise<Result>` to `AuthState`, wrapping `supabase.auth.exchangeCodeForSession` + `mapAuthError`, analogous to the existing `resetPassword`/`updatePassword`.

- **Signature**: `exchangeAuthCode: (code: string) => Promise<Result>` (the same `Result` shape as `signIn`/`resetPassword` — `{ error?: string }`, already defined in `auth.tsx:9`).
- **`signInWithGoogle`** (`auth.tsx:77-107`) and **`reset-password.tsx`** both call `exchangeAuthCode(code)` from `useAuth()` instead of each independently calling `supabase.auth.exchangeCodeForSession`.
- **The rest of the code only knows `useAuth()`** — `reset-password.tsx` stops importing `@/lib/supabase` at all (its only import from there today is this one call).

## Step 5 — Proof of isolation + before/after

**Before:** `grep -rn "supabase\.auth\.exchangeCodeForSession" src/` → 2 files (`auth.tsx`, `reset-password.tsx`).
**After (success criterion, checkable in a second):** the same grep → exactly 1 file (`auth.tsx`). `grep -rn "from '@/lib/supabase'" src/` → 2 files (`api.ts`, `auth.tsx`), not 3.

**Before/after of the bug:** today a user resetting their password with an expired link gets a different style of message than a user whose Google OAuth code exchange failed — even though these are technically the same kind of SDK failure. After the change, both go through `mapAuthError`, so any future improvement to the message reaches both flows at once, from a single point of change.

## Step 6 — Verification and plan

**Success criterion:** `grep -rn "supabase\.auth\.exchangeCodeForSession" src/` returns only `src/lib/auth.tsx`.

**Phase plan (to be carried out as a separate change):**

1. Add `exchangeAuthCode` to `AuthState` + `AuthProvider`, internally identical logic to today's `signInWithGoogle:98-101` fragment, so `signInWithGoogle` can lean on it without a behavior change.
2. Rewire `signInWithGoogle` to use `exchangeAuthCode` (should be a behavioral no-op — the same code, moved).
3. Rewire `reset-password.tsx` to use `exchangeAuthCode` from `useAuth()`, remove the `@/lib/supabase` import. **This is the only step with a real behavior change** — the error message changes from hand-written text to `mapAuthError`'s output (to be decided in the plan: keep today's text as a fallback inside `mapAuthError`, or accept a new, more consistent message).
4. `src/lib/__tests__/map-auth-error.test.ts` already exists and already tests `mapAuthError` — a new test for `exchangeAuthCode` should mainly cover "the error passes through," not re-test `mapAuthError` itself.

## Limitations

- The `Session`-as-vendor-type leak is not fixed here — low cost today (confirmed by a grep of its consumption), left as a noted, deliberate observation in `01-domain-distillation.md`, not a separate plan.
- Not verified with ast-grep in this document (a plan, not a closed research pass) — the success criterion from Step 6 is, however, trivially checkable on its own after implementation, with the same grep used for the diagnosis.
