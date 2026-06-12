import type { Ai } from '@cloudflare/workers-types';

/**
 * Speech-to-text via Cloudflare Workers AI (Whisper large-v3-turbo). Runs on the
 * account's AI allocation — no external STT vendor or key. Multilingual, so it
 * covers the PRD's Polish + English requirement with language auto-detected.
 *
 * The raw audio is transcribed and discarded — never persisted (PRD privacy NFR:
 * only the extracted task strings are stored).
 */
export async function transcribeAudio(file: File, ai: Ai): Promise<string> {
  const base64 = toBase64(await file.arrayBuffer());

  // whisper-large-v3-turbo takes base64 audio; returns { text, ... }.
  const result = (await ai.run('@cf/openai/whisper-large-v3-turbo', {
    audio: base64,
    task: 'transcribe',
  })) as { text?: string };

  return (result.text ?? '').trim();
}

/** Base64-encode an ArrayBuffer in chunks (avoids the spread-arg stack limit). */
function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
