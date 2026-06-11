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

## Recommendation

**Deploy the backend API on Cloudflare Workers.**

Cloudflare Workers scored 5/5 on all agent-friendly criteria and is the only candidate with a genuinely $0 cost at MVP traffic levels (100k requests/day free tier). The backend is a stateless TypeScript REST API handling auth, AI transcription relay, and task CRUD — a workload that maps perfectly to a serverless fetch-handler model. The AI transcription calls are external HTTP requests whose I/O wait time does not count toward the 10ms free-tier CPU budget, making the tight CPU limit non-binding for this architecture. The developer accepted the cross-check risks (Supabase JS compat, `workerd` learning curve) as manageable.

Note: The mobile app itself deploys via EAS Build → App Store (already locked in `tech-stack.md`). This file covers the backend API only.

## Platform Comparison

| Platform               | CLI-first  | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Score   |
| ---------------------- | ---------- | ------------------ | ------------------- | ----------------- | ----------------- | ------- |
| **Cloudflare Workers** | ✅ Pass    | ✅ Pass            | ✅ Pass             | ✅ Pass           | ✅ Pass           | **5/5** |
| Railway                | ✅ Pass    | ✅ Pass            | ⚡ Partial          | ✅ Pass           | ⚡ Partial        | 4/5     |
| Render                 | ⚡ Partial | ✅ Pass            | ✅ Pass             | ✅ Pass           | ✅ Pass           | 4/5     |
| Vercel                 | ✅ Pass    | ✅ Pass            | ✅ Pass             | ✅ Pass           | ⚡ Partial        | 4/5     |
| Netlify                | ⚡ Partial | ✅ Pass            | ✅ Pass             | ⚡ Partial        | ✅ Pass           | 3/5     |
| Fly.io                 | ✅ Pass    | ⚡ Partial         | ⚡ Partial          | ✅ Pass           | ⚡ Partial        | 3/5     |

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Perfect 5/5 score. Genuinely free at MVP scale (100k requests/day, no charge for I/O wait). TypeScript is a first-class citizen. `wrangler` CLI covers deploy, rollback, and log tailing without a dashboard. Docs published as `llms.txt` and `llms-full.txt` with per-page markdown. GA MCP server ecosystem. The primary risks (Supabase JS compat, `workerd` != Node.js) are documented and manageable with version pinning and early testing.

#### 2. Railway

4/5 score, $5/month flat (Hobby plan includes $5 compute credit — low-traffic APIs typically stay within this). Zero-config Railpack build handles TypeScript natively — no Dockerfile required. Standard Node.js runtime eliminates all `workerd` compat concerns, making it the simplest option if Cloudflare friction is higher than anticipated. Scale-to-zero available (cold start returns 502 on first hit after idle — acceptable for dev; set `min_machines_running = 1` for production). MCP server is official but labeled "work in progress" (beta as of 2026-06-11). No published `llms.txt`. **Fallback recommendation** if Workers compat issues block progress.

#### 3. Render

4/5 score, $7/month minimum for production (free tier has 30-60s cold starts, disqualifying for a mobile backend). GA MCP server (20+ tools, open-sourced at `render-oss/render-mcp-server`). Full `llms.txt` published. CLI covers deploy and logs; rollback requires API or dashboard. The always-on $7 Starter plan is the right entry point — no cold-start surprises.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **10ms CPU time (free tier) will likely force the $5/month Paid plan.** JWT verification + JSON parsing + schema validation in auth endpoints regularly consumes 5-8ms. Bcrypt or argon2 in a password-hash flow exceeds the limit alone. The $5/month Paid plan raises the ceiling to 30s — budget for it from day one.
2. **`workerd` is not Node.js — Supabase JS client has documented compatibility issues.** The `@supabase/supabase-js` v2 client's WebSocket and realtime modules use Node.js internals that unenv stubs only partially cover. Expect 2-4 hours of debugging and version pinning before the client works correctly in Workers.
3. **3MB bundle limit (free) / 10MB (Paid) requires mandatory tree-shaking.** Supabase SDK + auth library + validation = 2-3MB before your own code. Run `wrangler deploy --dry-run` before the first real deploy to audit bundle size.
4. **unenv stub failures appear at runtime, not build time.** A Node.js package that imports cleanly will throw `[unenv] X is not implemented yet` only when the specific code path executes. Write integration tests for every external library before deploying.
5. **Wrangler version drift breaks CI.** Pin `wrangler` in `package.json` (`"wrangler": "^X.Y.Z"`) to prevent `npm ci` from pulling an incompatible CLI version.

### Pre-Mortem — How This Could Fail

The team shipped Tellme's backend to Cloudflare Workers. Month one was smooth — simple task CRUD endpoints worked perfectly under `wrangler dev`. The first sign of trouble came at week three: auth endpoints threw intermittent CPU-exceeded errors only under real request patterns, not in local testing. After two days of profiling, bcrypt was the culprit. The developer upgraded to the $5/month Paid plan — minor cost, but unexpected for a "free" platform.

The bigger problem emerged at month two when integrating Supabase for user accounts and task storage. The Supabase JS client's realtime channel initialization code pulled in Node.js WebSocket internals via unenv stubs. Certain auth methods worked; others threw cryptic `not implemented yet` errors at runtime. The developer spent three days pinning specific Supabase imports and disabling realtime features that weren't needed. The agent kept regenerating standard Supabase client patterns — it wasn't aware of the Workers-specific compatibility constraints.

By month three, the 3MB bundle limit was hit as AI integration code grew. Dynamic imports became necessary, breaking the agent's ability to reliably generate idiomatic code. The final regret: the developer had learned an entirely separate runtime model (Workers, `wrangler.toml`, KV/D1 bindings) instead of writing standard Node.js. For a 2-week MVP timeline, this was a material tax on velocity — Railway would have cost $5/month and eliminated all of it.

### Unknown Unknowns

- **Supabase JS client + Workers = known open issue.** If Supabase is the auth/DB provider, test the full auth flow locally against a real Supabase project with `wrangler dev` before writing any other feature.
- **Audio upload gotcha.** Workers accept up to 100MB request bodies, but streaming a buffered audio file consumes CPU time during parsing. Keep voice memo encoding to M4A/AAC (typical Expo AudioRecorder output) to minimize payload size.
- **Free tier request counter is per Cloudflare account**, not per Worker. All Workers across all projects share the 100k/day limit.
- **Cloudflare Workers AI ≠ this project's AI backend.** Workers AI is Cloudflare's hosted inference service. This project calls external Whisper and LLM APIs over HTTP — the developer should ignore Workers AI marketing when building the transcription pipeline.
- **EAS secrets and Wrangler secrets are entirely separate systems.** `eas secret:create` for the mobile app and `wrangler secret put` for the API backend. Keep a local `.env.example` that documents both sets of keys so they're not lost during environment setup.

## Operational Story

- **Preview deploys**: `wrangler deploy --env staging` deploys to a named environment. No automatic PR preview URLs (unlike Vercel/Netlify) — set up a `staging` environment in `wrangler.toml` and deploy manually or via GitHub Actions on branch push.
- **Secrets**: `wrangler secret put SECRET_NAME` — prompts for value, stores in Cloudflare's encrypted secrets vault per Worker per environment. Secrets are not visible after creation, only writable. Rotation: `wrangler secret put` overwrites the old value.
- **Rollback**: `wrangler rollback` (defaults to the version before latest) or `wrangler rollback <VERSION_ID>` for a specific version. Typical time-to-revert: < 30 seconds. Database state (external Supabase) does not roll back — only the Worker code version rolls back.
- **Approval**: An agent may run `wrangler deploy`, `wrangler tail`, `wrangler secret put` unattended. A human must approve: production secret rotation, billing plan changes, domain routing changes, and any deletion of Workers or KV namespaces.
- **Logs**: `wrangler tail [WORKER_NAME] --format pretty` for real-time tailing. `wrangler tail --status error` to filter errors only. Logs are not persisted beyond the tail session on the free/Paid plan — Logpush (Enterprise) adds log persistence. For structured log retention, pipe errors to an external sink (e.g., Sentry free tier).

## Risk Register

| Risk                                                                       | Source                              | Likelihood | Impact | Mitigation                                                                                                                                           |
| -------------------------------------------------------------------------- | ----------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Free-tier 10ms CPU limit hit in auth endpoint (bcrypt/JWT + validation)    | Devil's advocate                    | High       | Low    | Budget $5/month Paid plan from day one; CPU limit becomes 30s                                                                                        |
| Supabase JS client compat issues in `workerd`                              | Devil's advocate + Unknown unknowns | Medium     | High   | Test full Supabase auth flow with `wrangler dev` before writing other features; pin `@supabase/supabase-js` to a known-good version                  |
| Bundle size exceeds 3MB (free) on adding Supabase + auth + validation deps | Devil's advocate                    | Medium     | Medium | Run `wrangler deploy --dry-run` after adding each major dependency; upgrade to Paid ($5/mo) for 10MB limit                                           |
| unenv stub failures appearing at runtime, not build time                   | Devil's advocate                    | Medium     | Medium | Add integration test for every external npm dependency before deploying; catch failures in staging                                                   |
| Wrangler version drift breaking CI                                         | Devil's advocate                    | Low        | Medium | Pin `wrangler` version in `devDependencies`; use `npm ci` in CI pipeline                                                                             |
| Pre-mortem: cumulative `workerd` friction exceeding 2-week MVP timeline    | Pre-mortem                          | Medium     | High   | Fallback plan: Railway (runner-up) requires no runtime model change — migrate by copying the Express/Hono router code into a standard Node.js server |
| Audio streaming CPU timeout on slow connections                            | Unknown unknowns                    | Low        | Medium | Test with M4A encoded audio (compact); add explicit `Content-Type` validation to reject unexpected formats early                                     |
| EAS secrets / Wrangler secrets environment confusion                       | Unknown unknowns                    | Medium     | Low    | Document both secret sets in `.env.example` at project root                                                                                          |

## Getting Started

1. **Install and authenticate Wrangler:**

   ```bash
   npm install --save-dev wrangler
   npx wrangler login
   ```

2. **Create a new Worker project targeting the existing TypeScript repo:**

   ```bash
   npx wrangler init backend --no-delegate-c3
   ```

   This generates `wrangler.toml`, updates `package.json`, and scaffolds a `src/index.ts` fetch handler.

3. **Enable Node.js compatibility in `wrangler.toml`:**

   ```toml
   compatibility_flags = ["nodejs_compat"]
   compatibility_date = "2024-09-23"
   ```

4. **Run locally against real environment variables:**

   ```bash
   npx wrangler dev --remote
   ```

   `--remote` runs against the actual Cloudflare edge rather than a local emulator — use this when testing Supabase auth integration.

5. **Deploy to production:**
   ```bash
   npx wrangler deploy
   ```
   Add secrets before the first deploy: `npx wrangler secret put SUPABASE_URL`, `npx wrangler secret put SUPABASE_ANON_KEY`, etc.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup (GitHub Actions wiring)
- Production-scale architecture (multi-region, HA, DR)
- EAS Build configuration (covered by tech-stack.md)
