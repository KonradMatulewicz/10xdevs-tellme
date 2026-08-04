import { SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSupabaseClient } from '../src/supabase';
import { createFakeSupabaseClient } from './support/fake-supabase';

vi.mock('../src/supabase', () => ({
  createSupabaseClient: vi.fn(),
  supabaseForToken: vi.fn(),
}));

const PROTECTED_ROUTES: { method: string; path: string }[] = [
  { method: 'GET', path: '/tasks' },
  { method: 'POST', path: '/tasks' },
  { method: 'PATCH', path: '/tasks/1' },
  { method: 'POST', path: '/transcribe' },
];

beforeEach(() => {
  vi.resetAllMocks();
});

describe('auth gate', () => {
  it.each(PROTECTED_ROUTES)(
    'rejects $method $path with 401 when Authorization is missing',
    async ({ method, path }) => {
      const res = await SELF.fetch(`https://example.com${path}`, { method });
      expect(res.status).toBe(401);
    },
  );

  it.each(PROTECTED_ROUTES)(
    'rejects $method $path with 401 when Authorization is not Bearer-prefixed',
    async ({ method, path }) => {
      const res = await SELF.fetch(`https://example.com${path}`, {
        method,
        headers: { Authorization: 'Basic dXNlcjpwYXNz' },
      });
      expect(res.status).toBe(401);
    },
  );

  it('leaves /health reachable with no Authorization header (control)', async () => {
    const res = await SELF.fetch('https://example.com/health');
    expect(res.status).toBe(200);
  });

  it('leaves /db-check reachable with no Authorization header (control)', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(
      createFakeSupabaseClient({ data: [], error: null }),
    );
    const res = await SELF.fetch('https://example.com/db-check');
    expect(res.status).toBe(200);
  });
});
