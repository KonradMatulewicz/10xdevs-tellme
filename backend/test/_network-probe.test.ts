import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

/**
 * TEMPORARY diagnostic — delete once idor.test.ts's outbound fetch to
 * Supabase is confirmed working in CI. Isolates whether a connection failure
 * is general (this probe fails too) or specific to Supabase's host/TLS.
 */
describe('_network-probe (temporary)', () => {
  it('can reach a public https endpoint from inside the pool worker', async () => {
    const res = await fetch('https://example.com/');
    expect(res.status).toBe(200);
  });

  it.skipIf(!env.SUPABASE_URL)('can reach the bare Supabase host (no path, GET)', async () => {
    console.log('SUPABASE_URL length:', env.SUPABASE_URL.length, JSON.stringify(env.SUPABASE_URL));
    const res = await fetch(env.SUPABASE_URL);
    console.log('Supabase root responded with status', res.status);
    // Any HTTP response (even 404) proves the connection itself succeeded.
    expect(res).toBeDefined();
  });
});
