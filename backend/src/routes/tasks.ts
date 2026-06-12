import { Hono } from 'hono';

import { requireAuth } from '../middleware/auth';
import { TASK_STATUSES, type AppEnv, type TaskStatus } from '../types';

/**
 * Task CRUD. Every row is scoped to the authenticated user by RLS (the client
 * carries the caller's JWT). State transitions (mark done, soft-delete, restore)
 * are all PATCHes of `status`; edit is a PATCH of `text`; tabs + search are
 * query params on the list endpoint. Maps to PRD FR-008..FR-014.
 */
export const tasks = new Hono<AppEnv>();

tasks.use('*', requireAuth);

function isStatus(v: unknown): v is TaskStatus {
  return typeof v === 'string' && (TASK_STATUSES as readonly string[]).includes(v);
}

// GET /tasks?status=todo|done|deleted&q=<keyword>
tasks.get('/', async (c) => {
  const supabase = c.get('supabase');
  const status = c.req.query('status');
  const q = c.req.query('q');

  if (status !== undefined && !isStatus(status)) {
    return c.json({ error: `status must be one of ${TASK_STATUSES.join(', ')}` }, 400);
  }

  let query = supabase.from('tasks').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  if (q) query = query.ilike('text', `%${q}%`);

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ tasks: data });
});

// POST /tasks  { text: string }  |  { texts: string[] }  (batch from extraction)
tasks.post('/', async (c) => {
  const supabase = c.get('supabase');
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') return c.json({ error: 'invalid JSON body' }, 400);

  const raw: unknown[] = Array.isArray((body as any).texts)
    ? (body as any).texts
    : typeof (body as any).text === 'string'
      ? [(body as any).text]
      : [];
  const texts = raw.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean);
  if (texts.length === 0) return c.json({ error: 'provide a non-empty `text` or `texts`' }, 400);

  // user_id defaults to auth.uid() in the DB; status defaults to 'todo'.
  const { data, error } = await supabase
    .from('tasks')
    .insert(texts.map((text) => ({ text })))
    .select();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ tasks: data }, 201);
});

// PATCH /tasks/:id  { text?, status? }  — edit, mark done, soft-delete, restore
tasks.patch('/:id', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') return c.json({ error: 'invalid JSON body' }, 400);

  const patch: Record<string, unknown> = {};
  if ((body as any).text !== undefined) {
    const text = typeof (body as any).text === 'string' ? (body as any).text.trim() : '';
    if (!text) return c.json({ error: '`text` cannot be empty' }, 400);
    patch.text = text;
  }
  if ((body as any).status !== undefined) {
    if (!isStatus((body as any).status)) {
      return c.json({ error: `status must be one of ${TASK_STATUSES.join(', ')}` }, 400);
    }
    patch.status = (body as any).status;
  }
  if (Object.keys(patch).length === 0) return c.json({ error: 'nothing to update' }, 400);
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabase.from('tasks').update(patch).eq('id', id).select().single();
  if (error) {
    // PGRST116 = no row matched (wrong id, or not the caller's row under RLS).
    return c.json({ error: error.message }, error.code === 'PGRST116' ? 404 : 500);
  }
  return c.json({ task: data });
});
