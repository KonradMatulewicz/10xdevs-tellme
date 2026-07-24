/**
 * Pure helpers for the password-recovery deep-link flow. Kept free of React /
 * native imports so they unit-test without rendering the reset screen.
 */

/** Minimum password length enforced on the reset screen (matches Supabase default). */
export const MIN_PASSWORD_LENGTH = 6;

/** Query params of a deep link, with any `#fragment` stripped so it can't pollute the last value. */
function deepLinkParams(url: string | null | undefined): URLSearchParams | null {
  if (!url) return null;
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) return null;
  let query = url.slice(queryIndex + 1);
  const hashIndex = query.indexOf('#');
  if (hashIndex !== -1) query = query.slice(0, hashIndex);
  return new URLSearchParams(query);
}

/**
 * Extract the PKCE `code` query param from an auth deep link — recovery
 * (`tellme://reset-password?code=abc`) or OAuth callback alike. Returns null when
 * the URL is missing, has no query string, or carries no `code`.
 */
export function extractRecoveryCode(url: string | null | undefined): string | null {
  const code = deepLinkParams(url)?.get('code') ?? null;
  return code && code.length > 0 ? code : null;
}

/**
 * Human-readable error from a Supabase error redirect
 * (`?error=access_denied&error_code=otp_expired&error_description=…`).
 * Returns null when the URL carries no error params.
 */
export function extractAuthErrorDescription(url: string | null | undefined): string | null {
  const params = deepLinkParams(url);
  if (!params) return null;
  const description = params.get('error_description') ?? params.get('error');
  return description && description.length > 0 ? description : null;
}

/**
 * Validate a new password + confirmation. Returns an error string to display, or
 * null when the input is acceptable.
 */
export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password !== confirm) {
    return 'Passwords do not match.';
  }
  return null;
}
