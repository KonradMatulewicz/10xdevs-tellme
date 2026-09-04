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
});
