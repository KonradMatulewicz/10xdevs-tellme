import { SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { supabaseForToken } from '../src/supabase';
import { createFakeSupabaseClient, PGRST116, type FakeResponse } from './support/fake-supabase';

vi.mock('../src/supabase', () => ({
  createSupabaseClient: vi.fn(),
  supabaseForToken: vi.fn(),
}));

const AUTH = { Authorization: 'Bearer test-token' };
const JSON_HEADERS = { ...AUTH, 'Content-Type': 'application/json' };

function mockSupabaseResponse(data: unknown, error: FakeResponse['error'] = null) {
  vi.mocked(supabaseForToken).mockReturnValue(createFakeSupabaseClient({ data, error }));
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('GET /tasks', () => {
  it('returns tasks with no filter', async () => {
    mockSupabaseResponse([{ id: '1', text: 'a' }]);
    const res = await SELF.fetch('https://example.com/tasks', { headers: AUTH });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tasks: [{ id: '1', text: 'a' }] });
  });

  it.each(['todo', 'done', 'deleted'])('accepts status=%s', async (status) => {
    mockSupabaseResponse([]);
    const res = await SELF.fetch(`https://example.com/tasks?status=${status}`, { headers: AUTH });
    expect(res.status).toBe(200);
  });

  it('rejects an invalid status filter with 400', async () => {
    const res = await SELF.fetch('https://example.com/tasks?status=bogus', { headers: AUTH });
    expect(res.status).toBe(400);
  });

  it('applies a q search param', async () => {
    mockSupabaseResponse([{ id: '1', text: 'buy milk' }]);
    const res = await SELF.fetch('https://example.com/tasks?q=milk', { headers: AUTH });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tasks: [{ id: '1', text: 'buy milk' }] });
  });

  it('returns 500 when the query errors', async () => {
    mockSupabaseResponse(null, { message: 'boom' });
    const res = await SELF.fetch('https://example.com/tasks', { headers: AUTH });
    expect(res.status).toBe(500);
  });
});

describe('POST /tasks', () => {
  it('creates a task from a single text', async () => {
    mockSupabaseResponse([{ id: '1', text: 'buy milk' }]);
    const res = await SELF.fetch('https://example.com/tasks', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ text: 'buy milk' }),
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ tasks: [{ id: '1', text: 'buy milk' }] });
  });

  it('creates tasks from a batch texts[] array', async () => {
    mockSupabaseResponse([{ id: '1' }, { id: '2' }]);
    const res = await SELF.fetch('https://example.com/tasks', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ texts: ['a', 'b'] }),
    });
    expect(res.status).toBe(201);
  });

  it('rejects an invalid JSON body with 400', async () => {
    const res = await SELF.fetch('https://example.com/tasks', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });

  it('rejects when all texts are blank after trimming', async () => {
    const res = await SELF.fetch('https://example.com/tasks', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ texts: ['   ', ''] }),
    });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /tasks/:id', () => {
  it('edits text', async () => {
    mockSupabaseResponse({ id: '1', text: 'updated' });
    const res = await SELF.fetch('https://example.com/tasks/1', {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ text: 'updated' }),
    });
    expect(res.status).toBe(200);
  });

  it('transitions status', async () => {
    mockSupabaseResponse({ id: '1', status: 'done' });
    const res = await SELF.fetch('https://example.com/tasks/1', {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ status: 'done' }),
    });
    expect(res.status).toBe(200);
  });

  it('rejects an invalid status with 400', async () => {
    const res = await SELF.fetch('https://example.com/tasks/1', {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ status: 'bogus' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects an empty patch with 400', async () => {
    const res = await SELF.fetch('https://example.com/tasks/1', {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 when no row matches (PGRST116)', async () => {
    mockSupabaseResponse(null, PGRST116);
    const res = await SELF.fetch('https://example.com/tasks/does-not-exist', {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ text: 'x' }),
    });
    expect(res.status).toBe(404);
  });
});
