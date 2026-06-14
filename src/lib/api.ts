import type { Task, TaskStatus } from '@/types';

import { config } from './config';
import { supabase } from './supabase';

/** Current user's bearer token; the backend forwards it so RLS scopes rows. */
async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}` };
}

async function parse<T>(res: Response, fallback: string): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error((body.error as string) ?? fallback);
  return body as T;
}

export async function fetchTasks(status?: TaskStatus, q?: string): Promise<Task[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  const res = await fetch(`${config.apiUrl}/tasks?${params.toString()}`, {
    headers: await authHeader(),
  });
  const { tasks } = await parse<{ tasks: Task[] }>(res, 'Could not load tasks');
  return tasks;
}

export async function updateTask(
  id: string,
  patch: { text?: string; status?: TaskStatus },
): Promise<Task> {
  const res = await fetch(`${config.apiUrl}/tasks/${id}`, {
    method: 'PATCH',
    headers: { ...(await authHeader()), 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const { task } = await parse<{ task: Task }>(res, 'Could not update task');
  return task;
}

export type TranscribeResult = { transcript: string; tasks: Task[] };

/** Upload a recorded audio file to the voice pipeline; returns saved tasks. */
export async function transcribe(uri: string): Promise<TranscribeResult> {
  const form = new FormData();
  // React Native FormData file shape.
  form.append('audio', { uri, name: 'note.m4a', type: 'audio/m4a' } as unknown as Blob);
  const res = await fetch(`${config.apiUrl}/transcribe`, {
    method: 'POST',
    headers: await authHeader(), // let fetch set the multipart boundary
    body: form,
  });
  return parse<TranscribeResult>(res, 'Transcription failed');
}
