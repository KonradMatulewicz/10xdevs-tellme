/**
 * Signs in against the real Supabase Auth REST API (password grant) and
 * returns the access token. Used only by real-network tests (idor.test.ts) —
 * every other test file mocks `../src/supabase` and never calls this.
 */
export async function signIn(
  supabaseUrl: string,
  anonKey: string,
  email: string,
  password: string,
): Promise<string> {
  // A malformed/empty SUPABASE_URL (e.g. a misconfigured CI secret) makes
  // fetch() throw an opaque low-level network error inside workerd — fail
  // fast here with a message that actually points at the cause.
  let url: URL;
  try {
    url = new URL(`${supabaseUrl}/auth/v1/token?grant_type=password`);
  } catch {
    throw new Error(`Invalid SUPABASE_URL for sign-in: ${JSON.stringify(supabaseUrl)}`);
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Sign-in failed for ${email}: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}
