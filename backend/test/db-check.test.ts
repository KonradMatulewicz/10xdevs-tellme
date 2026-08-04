import { SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSupabaseClient } from '../src/supabase';
import { createFakeSupabaseClient } from './support/fake-supabase';

vi.mock('../src/supabase', () => ({
  createSupabaseClient: vi.fn(),
  supabaseForToken: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('GET /db-check', () => {
  it('reports ok with zero rows when the query succeeds empty', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(
      createFakeSupabaseClient({ data: [], error: null }),
    );
    const res = await SELF.fetch('https://example.com/db-check');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, rows: 0, error: null });
  });

  it('reports not-ok with the error message when the query errors', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(
      createFakeSupabaseClient({ data: null, error: { message: 'connection refused' } }),
    );
    const res = await SELF.fetch('https://example.com/db-check');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false, rows: 0, error: 'connection refused' });
  });
});
