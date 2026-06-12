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

## Deferred to a later session (explicitly NOT in this deploy)

- Supabase client wired with the native-`fetch` override
  (`createClient(url, key, { global: { fetch } })`) and full auth flow tested via
  `wrangler dev --remote` against a real Supabase project — the load-bearing risk from the
  cross-check.
- Secrets: `wrangler secret put SUPABASE_URL` / `SUPABASE_ANON_KEY` (+ a root `.env.example`
  documenting both the EAS and Wrangler secret sets).
- A `staging` environment in `wrangler.toml` and GitHub Actions branch-deploy.
- Budgeting the $5/mo Paid plan before real password auth lands (10 ms free-tier CPU cap).

## Live result

- **Status:** ✅ deployed and verified.
- **Deployed URL:** https://tellme-backend.konrad-matulewicz1.workers.dev
- **Verified:** `GET /health` → `200 {"ok":true}`; unknown paths → `404`.
- **Version ID:** `1c617d76-10f9-4032-b7e1-d4caed214095`
- **Deployed at:** 2026-06-12 (Worker startup 11 ms; upload 21.57 KiB / gzip 5.37 KiB).
