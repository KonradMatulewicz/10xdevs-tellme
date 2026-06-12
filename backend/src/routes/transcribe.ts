import { Hono } from 'hono';

import { extractTasks } from '../ai/extract';
import { transcribeAudio } from '../ai/transcribe';
import { requireAuth } from '../middleware/auth';
import type { AppEnv } from '../types';

/**
 * The voice-to-task pipeline (PRD FR-004..FR-008): audio in → transcript →
 * extracted tasks → auto-saved to the caller's account → returned. Raw audio is
 * never persisted. Failures return a clear error state rather than a silent
 * empty list.
 */
export const transcribe = new Hono<AppEnv>();

transcribe.use('*', requireAuth);

// POST /transcribe  (multipart/form-data: audio=<file>)
transcribe.post('/', async (c) => {
  const form = await c.req.formData().catch(() => null);
  const file = form?.get('audio'); // FormDataEntryValue = File | string
  if (!file || typeof file === 'string') {
    return c.json({ error: 'expected multipart form field `audio` with a file' }, 400);
  }

  // 1. Transcribe (raw audio discarded after this call — privacy NFR).
  let transcript: string;
  try {
    transcript = await transcribeAudio(file, c.env.AI);
  } catch (e) {
    return c.json({ error: 'transcription failed', detail: String(e) }, 502);
  }
  if (!transcript) return c.json({ error: 'no speech detected in audio' }, 422);

  // 2. Extract tasks with Claude.
  let texts: string[];
  try {
    texts = await extractTasks(transcript, c.env.ANTHROPIC_API_KEY);
  } catch (e) {
    return c.json({ error: 'task extraction failed', detail: String(e) }, 502);
  }
  if (texts.length === 0) {
    // Explicit empty state — the transcript had no actionable items.
    return c.json({ transcript, tasks: [] });
  }

  // 3. Auto-save (RLS scopes rows to the authenticated user).
  const supabase = c.get('supabase');
  const { data, error } = await supabase
    .from('tasks')
    .insert(texts.map((text) => ({ text })))
    .select();
  if (error) return c.json({ error: error.message }, 500);

  return c.json({ transcript, tasks: data }, 201);
});
