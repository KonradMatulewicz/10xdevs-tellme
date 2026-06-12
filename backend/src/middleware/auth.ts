import { createMiddleware } from 'hono/factory';

import { supabaseForToken } from '../supabase';
import type { AppEnv } from '../types';

/**
 * Require a `Authorization: Bearer <supabase-jwt>` header. Builds a
 * request-scoped Supabase client carrying that token (RLS does the actual
 * per-user enforcement) and stashes it on the context. The JWT is validated
 * downstream by PostgREST/Supabase — we don't verify the signature here, so no
 * heavy crypto runs in the Worker (keeps us under the 10 ms free-tier CPU cap).
 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return c.json({ error: 'Missing or malformed Authorization bearer token' }, 401);
  }
  c.set('token', token);
  c.set('supabase', supabaseForToken(c.env, token));
  await next();
});
