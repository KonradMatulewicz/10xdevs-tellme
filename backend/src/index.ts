import { Hono } from 'hono';

import { tasks } from './routes/tasks';
import { transcribe } from './routes/transcribe';
import { createSupabaseClient } from './supabase';
import type { AppEnv, Env } from './types';

export type { Env };

const app = new Hono<AppEnv>();

// Liveness — no auth, no DB.
app.get('/health', (c) => c.json({ ok: true }));

// Connectivity probe: proves @supabase/supabase-js works on workerd.
// Under RLS an anon select returns [] with no error — a clean round-trip.
app.get('/db-check', async (c) => {
  const supabase = createSupabaseClient(c.env);
  const { data, error } = await supabase.from('tasks').select('id').limit(1);
  return c.json({ ok: !error, rows: data?.length ?? 0, error: error?.message ?? null });
});

app.route('/tasks', tasks);
app.route('/transcribe', transcribe);

app.notFound((c) => c.json({ error: 'Not Found' }, 404));

export default app;
