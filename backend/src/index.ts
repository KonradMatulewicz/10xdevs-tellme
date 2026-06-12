import { createSupabaseClient } from './supabase';

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  // Auth / additional bindings added in a later session.
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ ok: true });
    }

    // Connectivity probe: proves @supabase/supabase-js works on workerd.
    // Under RLS an anon select returns [] with no error — a clean round-trip.
    if (request.method === 'GET' && url.pathname === '/db-check') {
      const supabase = createSupabaseClient(env);
      const { data, error } = await supabase.from('tasks').select('id').limit(1);
      return Response.json({ ok: !error, rows: data?.length ?? 0, error: error?.message ?? null });
    }

    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
