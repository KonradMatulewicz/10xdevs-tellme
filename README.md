# Tellme

Voice memos are fast to capture but slow to act on — they need re-listening and manual transcription before anything becomes a task. Tellme closes that gap: record a voice note, and within seconds get a structured, editable task list, no manual transcription step in between.

Full product spec: [`context/foundation/prd.md`](context/foundation/prd.md).

## How it works

1. **Mobile app** (this repo root, Expo Router) — record audio, view/edit tasks across To-Do / Done / Deleted tabs, search.
2. **Backend** (`backend/`, Cloudflare Worker + Hono) — auth (Supabase), transcription (Workers AI), task extraction (Claude via `@anthropic-ai/sdk`), task CRUD.

## Running it

### Backend

```bash
cd backend
npm install
# create .dev.vars (gitignored) with SUPABASE_URL, SUPABASE_ANON_KEY, ANTHROPIC_API_KEY — see ../.env.example
npm run dev
```

### Mobile app

```bash
npm install
npx expo start
```

Open in a [development build](https://docs.expo.dev/versions/v57.0.0/develop/development-builds/introduction/), [Android emulator](https://docs.expo.dev/versions/v57.0.0/workflow/android-studio-emulator/), [iOS simulator](https://docs.expo.dev/versions/v57.0.0/workflow/ios-simulator/), or [Expo Go](https://expo.dev/go).

### Environment variables

See [`.env.example`](.env.example).

- **Backend — required.** Create `backend/.dev.vars` (gitignored) locally, as in "Running it" above. Production uses `wrangler secret put <NAME>` per-Worker.
- **Mobile app — optional.** `src/lib/config.ts` ships working defaults (deployed backend + Supabase project), so `npx expo start` runs with zero configuration. Override with `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` to point at a different environment.
- **`eas secret` — not set up yet.** No `eas.json` in the repo; EAS build is planned but not built (roadmap `F-01`, still `proposed`). Once it lands, mobile build/runtime secrets go through `eas secret:create`, never through `wrangler`.

## Tech stack

Expo SDK 57 (managed workflow) + Expo Router · TypeScript · Supabase (auth) · Cloudflare Workers + Hono (backend) · Claude (task extraction) · Workers AI (transcription).

See [`context/foundation/tech-stack.md`](context/foundation/tech-stack.md) for the full rationale.
