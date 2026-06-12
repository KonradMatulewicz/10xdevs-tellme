# Deploy Plan — Tellme backend (first deployment)

> Audit trail of "what was supposed to happen" for the first production deploy.
> Source contracts: `context/foundation/infrastructure.md` (Cloudflare Workers) +
> `context/foundation/tech-stack.md` (Expo app; TypeScript backend).
> Created 2026-06-12. Scope: **minimal `/health` Worker to prove the pipeline** — no
> Supabase, no secrets, no custom domain yet.

## Decision recap

- **Platform:** Cloudflare Workers (5/5; reaffirmed in the revised `infrastructure.md`).
- **What deploys here:** the backend REST API only. The mobile app ships via EAS Build →
  App Store (see `tech-stack.md`), which is out of scope for this plan.
- **First-deploy posture:** ship the smallest thing that proves deploy + live URL + logs
  work end to end. Supabase (with the native-`fetch` override) and auth are deliberately
  deferred to a later session to keep the first deploy debuggable.

## What's already done (agent-owned, committed-pending)

- Scaffolded an isolated `backend/` Worker project (kept separate from the Expo `src/` so
  the two build systems don't collide):
  - `backend/wrangler.toml` — `name = "tellme-backend"`, `main = "src/index.ts"`,
    `compatibility_date = "2024-09-23"`, `compatibility_flags = ["nodejs_compat"]`.
  - `backend/src/index.ts` — fetch handler exposing `GET /health` → `200 {"ok":true}`,
    everything else `404`.
  - `backend/package.json` — scripts (`dev`, `dev:remote`, `deploy`, `tail`, `typegen`);
    `wrangler@^4.100.0` + `@cloudflare/workers-types@^4.x` pinned in `devDependencies`
    (risk-register item: Wrangler version drift breaking CI).
  - `backend/tsconfig.json` — strict, Workers types.
- **Build verified:** `wrangler deploy --dry-run` → Total Upload 21.57 KiB / gzip 5.37 KiB.
  No bindings. Well under the 3 MB free-tier bundle limit.

## Manual gates (USER — cannot be automated)

1. **Cloudflare account** — have one (free tier is sufficient at this traffic).
2. **`cd backend && npx wrangler login`** — interactive browser OAuth. `wrangler whoami`
   currently reports _not authenticated_; this must succeed before deploy.

> Production-access posture (`CLAUDE.md`): once past MVP, prefer a **scoped API token**
> (Workers for this project only — no DNS, no billing) kept in an env var, over the broad
> OAuth login. Destructive actions (delete Worker, rotate a primary secret) stay human-only.

## Deploy commands (agent-owned, after auth)

```bash
cd backend
npx wrangler deploy            # publishes tellme-backend.<subdomain>.workers.dev
```

## Verification

```bash
curl https://tellme-backend.<your-subdomain>.workers.dev/health   # → 200 {"ok":true}
npx wrangler tail --format pretty                                  # confirm the request shows
```

- Record the live `*.workers.dev` URL back into this file once deployed.

## Supabase connectivity — DONE (2026-06-12)

The #1 cross-check risk is de-risked. `@supabase/supabase-js@2.108` is wired via
`backend/src/supabase.ts` with the load-bearing `{ global: { fetch } }` override (publishable
key, not `service_role`; RLS enforces per-user access). A minimal `public.tasks` table + RLS
policy was created. The `GET /db-check` probe returns `200 {"ok":true,"rows":0,"error":null}`
**both** under `wrangler dev --remote` (real `workerd` edge) and on the live URL — proving the
fetch override, network egress, and the anon-key/RLS path all work. Production secrets
(`SUPABASE_URL`, `SUPABASE_ANON_KEY`) are set via `wrangler secret put`; local dev reads
`backend/.dev.vars` (gitignored). Both secret systems are documented in root `.env.example`.

## Auth + task CRUD — DONE (2026-06-12)

Backend now serves JWT-scoped task CRUD via **Hono** (`backend/src/`). Auth model: the
**mobile app drives Supabase Auth** (sign-up / login / Google OAuth / password reset);
the Worker only **requires a `Bearer` JWT and forwards it** (`supabaseForToken`), so RLS
enforces per-user isolation — no password hashing in the Worker (stays under the 10 ms
free-tier CPU cap). `requireAuth` middleware gates all `/tasks*` routes.

Migration applied: `alter table public.tasks alter column user_id set default auth.uid();`
so inserts omit `user_id` while RLS still binds rows to the caller.

Endpoints (all under `/tasks`, auth required):

- `GET /tasks?status=todo|done|deleted&q=<kw>` — tab filter + keyword search (FR-009/014).
- `POST /tasks` — `{ text }` or `{ texts: [] }` (batch from extraction); defaults `todo` (FR-008).
- `PATCH /tasks/:id` — `{ text? }` edit (FR-010), `{ status }` mark-done / soft-delete /
  restore (FR-011/012).

**Verified end-to-end** against a real test user (JWT minted via the Auth API): 16/16 checks
— create→list→done→delete→restore→edit→search, plus 400 (validation), 404 (unknown id), and
401 (no token). `user_id` auto-populates and RLS scoping confirmed.

## AI voice pipeline — DONE (2026-06-12)

`POST /transcribe` (auth required) implements the PRD's voice-to-task flow (FR-004..FR-008):
multipart audio → transcript → extracted tasks → auto-saved (RLS-scoped) → returned. Raw
audio is never persisted (privacy NFR). Errors return a clear state, never a silent empty
list.

- **Transcription:** Cloudflare **Workers AI** (`@cf/openai/whisper-large-v3-turbo`) via the
  `[ai]` binding — no external STT vendor or key, multilingual (PL/EN). (Originally wired to
  OpenAI Whisper, but that account had no quota; switched to Workers AI — a deliberate
  deviation from `infrastructure.md`'s "ignore Workers AI" note, traded for zero extra
  vendor/billing.)
- **Extraction:** Claude **`claude-opus-4-8`** via `@anthropic-ai/sdk`, structured output
  (`output_config.format` json_schema → `{ tasks }`), low effort. `ANTHROPIC_API_KEY` is a
  Wrangler secret. Business rule per PRD (extract verbatim, don't merge/infer/filter).
- **Verified end-to-end:** a TTS-generated clip ("buy milk / call the dentist / finish the
  quarterly report") returned `201` in **3.9s** (well under the 10s NFR) with all three tasks
  transcribed, extracted, and saved. Claude extraction alone measured 2.8s.

> Cleanup note: the now-unused `OPENAI_API_KEY` secret is still on the Worker (harmless).
> Delete it by hand if desired — and rotate the OpenAI key that was shared during setup.

## Still deferred to a later session

- Mobile app: the Expo screens + Supabase Auth client wiring (register/login/OAuth UI).
- A `staging` environment in `wrangler.toml` and GitHub Actions branch-deploy.
- Budgeting the $5/mo Paid plan before traffic grows (10 ms free-tier CPU cap).
- An `updated_at` DB trigger (currently set by the Worker on PATCH).
- Direct-to-storage audio upload (currently proxied through the Worker) if payloads grow.

## Live result

- **Status:** ✅ Auth + CRUD + voice pipeline live and verified.
- **Deployed URL:** https://tellme-backend.konrad-matulewicz1.workers.dev
- **Endpoints:** `GET /health`, `GET /db-check`, `GET|POST /tasks`, `PATCH /tasks/:id`,
  `POST /transcribe`; unknown paths → `404`, missing token → `401`.
- **Latest Version ID:** `7aaf97ce-1e12-4102-b579-656a79f9c583`
- **Bundle:** 1256.47 KiB / gzip 241.37 KiB (under the 3 MB free-tier limit).
- **History:** health-only `1c617d76` → Supabase `c8bf8655` → auth+CRUD `dc705f41` →
  voice pipeline `7aaf97ce`.
