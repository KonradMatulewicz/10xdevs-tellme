---
project: Tellme
researched_at: 2026-06-11
recommended_platform: Cloudflare Workers
runner_up: Railway
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Expo (React Native) — mobile app; backend is a TypeScript/Node.js REST API
  runtime: Cloudflare Workers (workerd + nodejs_compat)
---

> **Revision note.** Revised 2026-06-11 after a full developer interview and a fresh
> parallel web-research re-run across all six candidates. It **reaffirms Cloudflare Workers**
> (5/5). Two things changed materially from the prior version: (1) the Supabase-on-`workerd`
> risk is now characterized as a _documented one-line fetch override_ rather than open-ended
> debugging; (2) the interview answer **single-region** surfaced a genuine tension — Workers'
> edge model earns the least in exactly this case, making Railway (plain Node, ~$5/mo, zero
> `workerd` tax) a stronger runner-up than first implied. The developer reviewed that tension
> and chose to proceed with Workers. Prior version: git `c61f955`.

## Recommendation

**Deploy the backend API on Cloudflare Workers.**

Cloudflare Workers scored 5/5 on all five agent-friendly criteria and is the only candidate genuinely free at MVP traffic (100k requests/day free tier; this app's 10k–100k requests/**month** sits well inside it). The backend is a stateless TypeScript REST API — auth, AI transcription relay, and task CRUD — which maps cleanly onto a serverless fetch-handler model. The AI transcription calls are external HTTP requests whose I/O wait does **not** count against the 10ms free-tier CPU budget, so the tight CPU limit is non-binding for relay/CRUD work. The decisive tie-breaker is developer familiarity: Cloudflare is the platform the developer already knows (interview Q3), so the `workerd` learning surface — the one real cost here — is largely already paid.

Note: The mobile app itself deploys via EAS Build → App Store (locked in `tech-stack.md`). This file covers the **backend API only**.

## Platform Comparison

| Platform               | CLI-first  | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Score   |
| ---------------------- | ---------- | ------------------ | ------------------- | ----------------- | ----------------- | ------- |
| **Cloudflare Workers** | ✅ Pass    | ✅ Pass            | ✅ Pass             | ✅ Pass           | ✅ Pass           | **5/5** |
| Railway                | ✅ Pass    | ✅ Pass            | ✅ Pass             | ✅ Pass           | ⚡ Partial        | 4/5     |
| Render                 | ⚡ Partial | ✅ Pass            | ✅ Pass             | ✅ Pass           | ✅ Pass           | 4/5     |
| Vercel                 | ✅ Pass    | ✅ Pass            | ✅ Pass             | ✅ Pass           | ⚡ Partial        | 4/5     |
| Netlify                | ⚡ Partial | ✅ Pass            | ✅ Pass             | ⚡ Partial        | ✅ Pass           | 3/5     |
| Fly.io                 | ✅ Pass    | ⚡ Partial         | ⚡ Partial          | ✅ Pass           | ⚡ Partial        | 3/5     |

Per-platform notes (from the 2026-06-11 research):

- **Cloudflare Workers** — `wrangler deploy` / `wrangler rollback [version-id]` (instant 100% revert) / `wrangler tail` cover the full ops loop from the terminal. Docs published as `llms.txt` + per-product `llms-full.txt` with a dedicated docs-for-agents portal. `nodejs_compat` (GA, ≥ compat date 2024-09-23) plus unenv polyfills the Node APIs an auth + HTTP-relay API needs (`crypto`, `buffer`, `http/https`, `stream`). GA managed MCP servers (OAuth, Claude-compatible). D1/KV/R2/Queues all GA but unused here (DB is external Supabase).
- **Railway** — Railpack build (GA; Nixpacks now maintenance-mode) deploys a standard Node app with **no Dockerfile**, eliminating every `workerd` compat concern. `railway up --ci` / `railway redeploy` / `railway logs` are scriptable; rollback = redeploy a prior deployment. `llms.txt` + per-page `.md` published (docs upgraded to Pass vs prior run). ~$5/mo flat (Hobby includes $5 usage credit). MCP server is official but **explicitly documented as a work in progress (beta, 2026-06-11)** → Partial. **The no-rewrite fallback if `workerd` friction exceeds the 2-week budget.**
- **Render** — Native Node Web Service, always-on **$7/mo Starter** (skip the free tier — 30–60s cold starts after 15-min idle disqualify it for a mobile backend). `render deploys create --wait -o json` + deploy hooks + REST are scriptable, but **rollback has no CLI command** (dashboard or REST API only) → CLI Partial. Full `llms.txt`; GA `render-oss/render-mcp-server`.
- **Vercel** — Standalone Node functions deploy without Next.js; Fluid compute (default since 2025-04-23) gives 300s duration on Hobby and I/O wait is unbilled, so audio relay is _not_ a duration problem. But **Hobby is non-commercial** (a real product needs Pro at $20/seat/mo) and there's a **4.5 MB request-body cap** (`413 FUNCTION_PAYLOAD_TOO_LARGE`) — awkward for an audio-upload backend (stream large audio out-of-band). MCP is read-only public beta → Partial. Drops below Railway/Render for _this_ workload despite the 4/5.
- **Netlify** — Functions run Node/TS, but synchronous timeout is **10s default / 26s Pro on request**; long Whisper relays need Background Functions (15 min, GA) which return `202` and **cannot return a response to the caller** — a real architectural fork for the AI pipeline. `netlify deploy` is **draft-by-default** (`--prod` required), rollback is UI-only, and Sept-2025 credit billing obscures cost forecasting → two Partials. Official `@netlify/mcp` is solid (Pass).
- **Fly.io** — Everything is a container/microVM (auto-generated Dockerfile via `fly launch`, but a build layer always exists; default 256 MB can OOM Node) → Managed Partial. **No free tier for orgs created after 2024-10-07** (~$2/mo pay-as-you-go, auto-stop cold starts). No confirmed `llms.txt` → Docs Partial. `fly mcp server` is recent/unlabeled → MCP Partial.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Perfect 5/5. Genuinely free at this scale (100k req/day; I/O wait doesn't burn CPU-ms). TypeScript first-class. `wrangler` covers deploy, instant rollback, and log tailing with no dashboard. Docs are `llms.txt`-native. GA MCP ecosystem. The single significant risk — `@supabase/supabase-js` on `workerd` — is a **documented one-line fix** (pass native `fetch` into `createClient`). And it's the platform the developer already knows, so the runtime-model tax is mostly pre-paid.

#### 2. Railway

4/5, ~$5/mo flat. Standard Node runtime via Railpack (no Dockerfile, no `workerd` compat concerns) makes it the **simplest** option if Cloudflare friction runs higher than expected — migrate by copying the Express/Hono router into a plain Node server. Scale-to-zero is opt-in (cold-start 502 on first hit after idle; keep always-on for predictable latency). MCP server is official but beta/WIP; no co-location needed (Supabase is external). **Fallback recommendation** — and, given the single-region answer, a closer second than the prior run framed it.

#### 3. Render

4/5, $7/mo always-on Starter (the free tier's cold starts disqualify it for a mobile backend). GA MCP server (20+ tools), full `llms.txt`. The one rough edge: rollback is dashboard/API-only, not a CLI command, and autodeploy can silently re-restore rolled-back code on the next push.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **`workerd` ≠ Node.js — the Supabase JS client needs the fetch override.** `@supabase/supabase-js` reaches for `XMLHttpRequest` via `cross-fetch` and breaks unless you pass workerd's native fetch: `createClient(url, key, { global: { fetch } })`. It's a documented pattern, but the agent will keep regenerating the vanilla client unless explicitly told (capture it in CLAUDE.md / lessons.md).
2. **10ms free-tier CPU limit on auth endpoints.** bcrypt/argon2 password hashing alone can exceed 10ms; JWT verify + JSON parse + schema validation regularly hit 5–8ms. Budget the $5/mo Paid plan (raises CPU to 30s, up to 5 min) the moment real password auth lands.
3. **You adopt an edge runtime for a single-region app.** The interview answer was single-region — Workers' global distribution is its headline feature, and you take on a non-Node runtime model to get a benefit your traffic doesn't need. Railway delivers the same outcome in plain Node for roughly the same money.
4. **3 MB bundle limit (free) / 10 MB (Paid).** Supabase SDK + auth + validation can eat 2–3 MB before your own code. Run `wrangler deploy --dry-run` to audit bundle size after each major dependency.
5. **unenv stubs fail at runtime, not build time.** A Node package that imports cleanly can throw `[unenv] X is not implemented yet` only when that code path executes. Integration-test every external library in staging before relying on it.

### Pre-Mortem — How This Could Fail

The CRUD endpoints shipped fast and felt great under `wrangler dev`. Trouble started at the Supabase integration: the agent generated the standard client, it threw cryptic fetch errors at runtime, and two days vanished before someone found the documented fetch-override note. Password auth then tripped the 10ms CPU cap under real load — invisible in local testing — forcing the Paid plan. Minor cost, but an unplanned surprise on a "free" platform. The deeper regret surfaced at month three: the solo developer had absorbed an entire second runtime model (`workerd`, `wrangler.toml`, compat flags, bundle budgets) to ship a single-region, low-QPS API that plain Node on Railway would have run with none of that tax. For a 2-week MVP built by one person, the learning surface — not the bill — was the real cost. The mitigating fact: the developer already knew Cloudflare, so most of that surface was pre-paid; the risk is concentrated in the Supabase edge case and the CPU/bundle ceilings, not the platform model itself.

### Unknown Unknowns

- **Supabase + Workers is a known, fixable issue** — test the full auth flow against a real Supabase project with `wrangler dev` _before_ building anything else on top of it.
- **Workers AI ≠ this project's AI backend.** This app calls external Whisper/LLM APIs over HTTP; ignore Cloudflare Workers AI marketing entirely when building the transcription pipeline.
- **Free-tier 100k req/day is per Cloudflare _account_, not per Worker** — shared across every Worker in the account.
- **Audio body handling.** Workers accept up to 100 MB request bodies, but buffering/parsing audio consumes CPU-ms; keep voice memos as compact M4A/AAC (typical Expo recorder output), and prefer direct-to-storage upload + URL relay over proxying audio bytes through the Worker.
- **EAS secrets and Wrangler secrets are entirely separate systems** (`eas secret:create` for the app vs `wrangler secret put` for the API). Keep a root `.env.example` documenting both sets so neither is lost during environment setup.

## Operational Story

- **Preview deploys**: `wrangler deploy --env staging` deploys to a named environment. No automatic per-PR preview URLs (unlike Vercel/Netlify) — define a `staging` environment in `wrangler.toml` and deploy on branch push via GitHub Actions, or manually.
- **Secrets**: `wrangler secret put SECRET_NAME` prompts for the value and stores it in Cloudflare's encrypted per-Worker, per-environment vault. Secrets are write-only after creation (not readable back). Rotation: `wrangler secret put` overwrites the prior value.
- **Rollback**: `wrangler rollback` (defaults to the version before latest) or `wrangler rollback <VERSION_ID>` for a specific version; typical revert < 30s. External Supabase DB state does **not** roll back — only the Worker code version does.
- **Approval**: An agent may run `wrangler deploy`, `wrangler tail`, and `wrangler secret put` unattended. A human must approve: production secret rotation, billing-plan changes, domain/route changes, and any deletion of Workers or KV namespaces.
- **Logs**: `wrangler tail [WORKER_NAME] --format pretty` for real-time tailing; `wrangler tail --status error` to filter errors. Tail logs are not persisted beyond the session on free/Paid — pipe errors to an external sink (e.g. Sentry free tier) for retention.

## Risk Register

| Risk                                                                           | Source                              | Likelihood | Impact | Mitigation                                                                                                                                                |
| ------------------------------------------------------------------------------ | ----------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase JS client fails on `workerd` (XMLHttpRequest via cross-fetch)         | Devil's advocate + Unknown unknowns | Medium     | High   | Pass native fetch: `createClient(url, key, { global: { fetch } })`; enable `nodejs_compat`; test full auth flow with `wrangler dev` before other features |
| Free-tier 10ms CPU limit hit in auth endpoint (bcrypt/argon2 + JWT + validate) | Devil's advocate                    | High       | Low    | Budget the $5/mo Paid plan from day one (CPU rises to 30s–5min)                                                                                           |
| Bundle exceeds 3MB (free) after adding Supabase + auth + validation deps       | Devil's advocate                    | Medium     | Medium | `wrangler deploy --dry-run` after each major dependency; Paid plan raises the limit to 10MB                                                               |
| unenv stub failures surfacing at runtime, not build time                       | Devil's advocate                    | Medium     | Medium | Integration-test every external npm dependency in staging before relying on it                                                                            |
| Single-region app pays `workerd` learning tax for an edge it doesn't use       | Devil's advocate + Pre-mortem       | Medium     | Medium | Familiarity (Q3) largely pre-pays the tax; if friction exceeds the 2-week budget, fall back to Railway (plain Node, copy the router, ~$5/mo)              |
| Cumulative `workerd` friction exceeding the 2-week MVP timeline                | Pre-mortem                          | Low–Medium | High   | Fallback: Railway (runner-up) needs no runtime-model change — migrate by copying the Express/Hono router into a standard Node server                      |
| Audio streaming burns CPU-ms / hits body limits on slow uploads                | Unknown unknowns                    | Low        | Medium | Use compact M4A/AAC; validate `Content-Type` early; prefer direct-to-storage upload + URL relay over proxying bytes through the Worker                    |
| EAS secrets / Wrangler secrets environment confusion                           | Unknown unknowns                    | Medium     | Low    | Document both secret sets in a root `.env.example`                                                                                                        |
| Wrangler version drift breaking CI                                             | Research finding                    | Low        | Medium | Pin `wrangler` in `devDependencies`; use `npm ci` in CI                                                                                                   |

## Getting Started

> Validate these against the exact tool versions you install — Wrangler and the Workers
> compat surface move fast. Confirm the current `nodejs_compat` flag name and compat-date
> behavior in the docs before relying on the snippet below.

1. **Install and authenticate Wrangler (pin it):**

   ```bash
   npm install --save-dev wrangler
   npx wrangler login
   ```

2. **Scaffold the backend Worker in the repo:**

   ```bash
   npx wrangler init backend --no-delegate-c3
   ```

   Generates `wrangler.toml`, updates `package.json`, and scaffolds a `src/index.ts` fetch handler.

3. **Enable Node.js compatibility in `wrangler.toml`:**

   ```toml
   compatibility_flags = ["nodejs_compat"]
   compatibility_date = "2024-09-23"
   ```

4. **Wire the Supabase client with the native-fetch override** (the load-bearing fix) and test it against a real Supabase project early:

   ```ts
   import { createClient } from '@supabase/supabase-js';
   export const supabase = (env: Env) =>
     createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
       global: { fetch }, // workerd's native fetch — avoids the cross-fetch/XMLHttpRequest break
     });
   ```

5. **Run locally against the real edge, add secrets, deploy:**

   ```bash
   npx wrangler dev --remote          # runs on Cloudflare's edge — use for Supabase auth testing
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_ANON_KEY
   npx wrangler deploy
   ```

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup (GitHub Actions wiring)
- Production-scale architecture (multi-region, HA, DR)
- EAS Build configuration (covered by `tech-stack.md`)
