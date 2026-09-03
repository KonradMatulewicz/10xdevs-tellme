import { env, SELF } from 'cloudflare:test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { signIn } from './support/real-auth';

/**
 * Real integration test against the live Supabase project — no mocks. Proves
 * RLS actually blocks cross-user task access (risk #3 in
 * context/foundation/test-plan.md), not just "no row matched this id" as the
 * mocked PGRST116 case in tasks.test.ts already covers.
 *
 * Requires two CONFIRMED Supabase Auth users; see .env.example. Skips itself
 * when those vars are absent, so a fresh clone or an unconfigured CI run
 * doesn't fail the whole suite over missing test fixtures.
 */
const hasTestUsers =
  !!env.SUPABASE_URL &&
  !!env.SUPABASE_ANON_KEY &&
  !!env.TEST_USER_A_EMAIL &&
  !!env.TEST_USER_A_PASSWORD &&
  !!env.TEST_USER_B_EMAIL &&
  !!env.TEST_USER_B_PASSWORD;

describe.skipIf(!hasTestUsers)('Cross-user task access (RLS)', () => {
  let tokenA: string;
  let tokenB: string;
  let taskId: string;

  beforeAll(async () => {
    tokenA = await signIn(
      env.SUPABASE_URL,
      env.SUPABASE_ANON_KEY,
      env.TEST_USER_A_EMAIL!,
      env.TEST_USER_A_PASSWORD!,
    );
    tokenB = await signIn(
      env.SUPABASE_URL,
      env.SUPABASE_ANON_KEY,
      env.TEST_USER_B_EMAIL!,
      env.TEST_USER_B_PASSWORD!,
    );

    const res = await SELF.fetch('https://example.com/tasks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `idor-test-${Date.now()}` }),
    });
    const body = (await res.json()) as { tasks: { id: string }[] };
    taskId = body.tasks[0].id;
  });

  afterAll(async () => {
    if (!taskId) return;
    // Soft-delete the artifact this test created, using its own owner's token.
    await SELF.fetch(`https://example.com/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'deleted' }),
    });
  });

  it("rejects user B's attempt to edit user A's task with 404, not a leak", async () => {
    const res = await SELF.fetch(`https://example.com/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hijacked' }),
    });
    expect(res.status).toBe(404);
  });

  it("excludes user A's task from user B's task list", async () => {
    const res = await SELF.fetch('https://example.com/tasks', {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const body = (await res.json()) as { tasks: { id: string }[] };
    expect(body.tasks.some((t) => t.id === taskId)).toBe(false);
  });
});
