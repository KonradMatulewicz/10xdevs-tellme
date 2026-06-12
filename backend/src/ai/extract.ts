import Anthropic from '@anthropic-ai/sdk';

/**
 * Extract a to-do list from a transcript using Claude. Single structured-output
 * call (claude-opus-4-8) — the JSON schema guarantees a parseable `{ tasks }`.
 * Low effort + no thinking keeps it inside the PRD's 10s end-to-end budget; the
 * schema constrains output so nothing leaks into the result.
 *
 * Business rule (PRD): extract each distinct actionable item verbatim — do not
 * merge similar items, infer implicit tasks, or filter non-task content.
 */
const SYSTEM = `You convert a transcribed voice note into a to-do list.

Extract every distinct actionable task the speaker stated, one entry per task, in the
speaker's original language (Polish or English). Rules:
- One task per distinct actionable item.
- Keep the wording close to what was said; lightly clean filler, don't rephrase intent.
- Do NOT merge similar items, infer tasks that weren't stated, or invent detail.
- Ignore non-task chatter (greetings, asides) — extract only stated to-dos.
- If there are no actionable tasks, return an empty list.`;

const SCHEMA = {
  type: 'object',
  properties: {
    tasks: { type: 'array', items: { type: 'string' } },
  },
  required: ['tasks'],
  additionalProperties: false,
} as const;

export async function extractTasks(transcript: string, apiKey: string): Promise<string[]> {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: SCHEMA }, effort: 'low' },
    messages: [{ role: 'user', content: transcript }],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('extraction refused by safety classifier');
  }

  const block = response.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') return [];

  const parsed = JSON.parse(block.text) as { tasks?: unknown };
  if (!Array.isArray(parsed.tasks)) return [];
  return parsed.tasks.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean);
}
