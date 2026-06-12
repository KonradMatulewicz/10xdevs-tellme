import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Env } from './types';

/**
 * LOAD-BEARING: pass workerd's native `fetch` into every Supabase client.
 * Without `global: { fetch }`, `@supabase/supabase-js` falls back to
 * `cross-fetch` / `XMLHttpRequest` and breaks at runtime on `workerd`. This is
 * risk-register item #1 in context/foundation/infrastructure.md — do NOT remove
 * the override or regenerate a vanilla `createClient(url, key)`.
 *
 * Uses the anon/publishable key (never `service_role`): RLS enforces per-user
 * access, and the publishable key is public-by-design.
 */
export function createSupabaseClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { fetch },
    auth: { persistSession: false },
  });
}

/**
 * A client that forwards the caller's JWT on every request, so PostgREST runs
 * as that authenticated user and RLS scopes the rows. This is how the Worker
 * enforces per-user isolation without ever touching `service_role`.
 */
export function supabaseForToken(env: Env, token: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { fetch, headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
}
