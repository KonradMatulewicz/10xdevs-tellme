import type { Ai } from '@cloudflare/workers-types';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  ANTHROPIC_API_KEY: string; // Claude task extraction
  AI: Ai; // Cloudflare Workers AI binding — Whisper transcription
}

/** Per-request values set by middleware. */
export type Variables = {
  /** Supabase client whose requests carry the caller's JWT, so RLS scopes rows. */
  supabase: SupabaseClient;
  /** Raw bearer token from the Authorization header. */
  token: string;
};

/** Hono generics for this app. */
export type AppEnv = { Bindings: Env; Variables: Variables };

export const TASK_STATUSES = ['todo', 'done', 'deleted'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
