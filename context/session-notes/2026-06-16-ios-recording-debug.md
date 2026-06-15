# Session notes — iOS recording / Expo SDK downgrade (2026-06-15 → 06-16)

## Goal

Run Tellme on a physical **iPhone 13 mini (iOS 17.6.1)** for free via Expo Go.

## Outcome so far

- ✅ **Web works fully** (auth, record, transcribe, tasks).
- ✅ **Downgraded Expo SDK 56 → 54** so the App Store Expo Go (capped at SDK 54) can load the app. iOS bundle compiles; app loads on device, login + task list work.
- ✅ **RESOLVED — iOS Expo Go hero buttons (2026-06-16).** Record + transcribe now fire on device. Root cause: `styles.hero` used `gap` together with `alignItems: 'center'` with children narrower than the container; on iOS Fabric this mis-measured the View's hit rect so taps on the centered buttons landed outside it and were dropped (web/RNW kept them live). Fix: removed `gap`, switched to explicit `marginTop` (`styles.heroSpace`). The earlier "still dead" reading was stale Metro cache — confirmed only after a clean `npx expo start -c` restart. Reanimated was exonerated (a no-animation `Pressable` in the hero was equally dead). All diagnostics (TOP PROBE, PROBE-REC, green TEST RECORD, `✦BUILD` marker) removed.
- ❌ **NEW OPEN BUG:** Buttons do **not** respond in **Chrome on iOS** (mobile web / iOS WebKit), though they work in desktop web and now in Expo Go native. Separate layer (RNW pointer handling under iOS WebKit). Under investigation.

---

## Why SDK 54 (do NOT bump back to 56)

App Store Expo Go only supports up to SDK 54; SDK 56 → "incompatible with this version of Expo Go". Keeping 56 on iOS needs a paid EAS dev build (declined). SDK 54 kept `expo-audio` (no audio rewrite) and Reanimated v4. See memory `tellme-ios-sdk-constraint`.

---

## Working-tree changes — KEEP vs TEMPORARY

### KEEP (real fixes — do not revert)

| File                                 | Change                                                                                                                   | Why                                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `app.json`                           | `web.output: "static" → "single"`                                                                                        | SSR crashed: Supabase touches `window` during Node prerender                                                            |
| `backend/src/index.ts`               | added `hono/cors` middleware                                                                                             | Browser preflight failed → "Failed to fetch". **Already deployed** to Cloudflare (`wrangler deploy`, version f51dc818). |
| `src/lib/api.ts`                     | `transcribe()` web branch resolves `blob:` URL → real `File`                                                             | RN FormData pseudo-blob doesn't upload on web                                                                           |
| `package.json` / `package-lock.json` | full SDK 54 version set (RN 0.81.5, React 19.1.0, Reanimated ~4.1.1, etc.) via authoritative `bundledNativeModules.json` | the downgrade itself                                                                                                    |
| `src/app/_layout.tsx`                | `ThemeProvider/DarkTheme/DefaultTheme` import moved `expo-router` → `@react-navigation/native`                           | SDK 54 expo-router stopped re-exporting them                                                                            |
| `src/hooks/use-theme.ts`             | null-safe (`scheme === 'dark' ? 'dark' : 'light'`)                                                                       | `useColorScheme` can return null; old code compared to stale `'unspecified'`                                            |
| `src/app/index.tsx` (partial)        | `onRecord` idle branch wrapped in try/catch + surfaces "Record error: …"                                                 | error was being swallowed                                                                                               |
| `src/components/animated-icon.tsx`   | `scheduleOnRN` → `runOnJS` (dead scaffold file, but harmless)                                                            | worklets import removed                                                                                                 |

### TEMPORARY — must be resolved/reverted

| File                               | Change                                    | Action needed                                                                                                                                                             |
| ---------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/record-button.tsx` | **Reanimated fully removed**, static ring | Isolation test. If Reanimated is NOT the cause, **restore the pulse animation** (see git `HEAD` version). If it IS, reintroduce without the UI-thread worklet that froze. |
| `src/app/index.tsx`                | header `"Tellme ✦BUILD-B1"` marker        | **Revert** to `"Tellme"`                                                                                                                                                  |
| `src/app/index.tsx`                | green **TEST RECORD** `Pressable` in hero | **Remove** (diagnostic only)                                                                                                                                              |
| `package.json`                     | `@expo/ngrok` devDep                      | optional — only added for tunnel attempt (tunnel failed to connect); can keep or drop                                                                                     |

---

## The open bug — what's RULED OUT

1. **Audio API** — onPress never fires (no "Starting…" banner ever shows), so it never reaches the audio code. Not an `expo-audio` problem. API verified present in 1.1.1.
2. **Ring `pointerEvents` prop** — moved into style; did not fix.
3. **Code delivery / stale cache** — DISPROVEN. `Tellme ✦BUILD-B1` marker **is visible on device**, so fresh code reaches the phone.
4. **Reanimated** — removed from the route tree in BUILD-B1. ⚠️ **Last unanswered question:** does the button respond in BUILD-B1? (User was asked, not yet answered.) Metro logs only ever showed WEB bundles — no iOS errors logged.

## Leading hypotheses to try NEXT

- **A view overlays the hero on iOS and eats touches.** Prime suspect: the `FlatList` (a ScrollView) under `controls` overlapping the hero region due to a flex/layout difference on Fabric (works on RNW).
  - Test: temporarily comment out the `<FlatList>` in `index.tsx` → if hero buttons revive, it's the overlay.
  - Or: give `styles.hero` `zIndex: 10` / `elevation`, or absolutely-position the TEST button at the very top with high zIndex.
- If removing Reanimated DID fix it: reintroduce animation via `Animated`/CSS without a UI-thread worklet, and consider disabling `experiments.reactCompiler` (experimental; known to conflict with Reanimated worklets on native).

---

## Environment / how to resume

- Start dev server: `cd C:\Users\konra\10xDEVS && npx expo start` (LAN). Run it in a **real terminal** so the QR is visible.
- iPhone: Expo Go → connect to `exp://<LAN-IP>:8081` (was `192.168.1.75`, **IP may change**). **Force-quit Expo Go** before reconnecting to guarantee a fresh bundle.
- Backend is live at `https://tellme-backend.konrad-matulewicz1.workers.dev` (CORS deployed).
- Tunnel mode (`--tunnel`) was attempted but ngrok "took too long to connect"; LAN works.
- Note: several background Metro processes from this session will be killed on clear — just restart fresh.
