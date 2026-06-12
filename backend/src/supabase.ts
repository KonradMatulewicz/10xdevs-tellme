import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Env } from './index';

/**
 * Build a Supabase client that works on Cloudflare Workers (`workerd`).
 *
 * LOAD-BEARING: pass workerd's native `fetch` into the client. Without
 * `global: { fetch }`, `@supabase/supabase-js` falls back to `cross-fetch` /
 * `XMLHttpRequest` and breaks at runtime on `workerd`. This is risk-register
 * item #1 in context/foundation/infrastructure.md — do NOT remove the override
 * or regenerate the vanilla `createClient(url, key)`.
 *
 * Uses the anon key (not service_role): RLS enforces per-user access, and the
 * anon key is public-by-design.
 */
export function createSupabaseClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { fetch },
    auth: { persistSession: false },
  });
}
