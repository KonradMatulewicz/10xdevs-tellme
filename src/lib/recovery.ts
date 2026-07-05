/**
 * Pure helpers for the password-recovery deep-link flow. Kept free of React /
 * native imports so they unit-test without rendering the reset screen.
 */

/** Minimum password length enforced on the reset screen (matches Supabase default). */
export const MIN_PASSWORD_LENGTH = 6;

/**
 * Extract the PKCE `code` query param from a recovery deep link such as
 * `exp://127.0.0.1:8081/--/reset-password?code=abc&type=recovery` or
 * `tellme://reset-password?code=abc`. Returns null when the URL is missing,
 * has no query string, or carries no `code`.
 */
export function extractRecoveryCode(url: string | null | undefined): string | null {
  if (!url) return null;
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) return null;
  const code = new URLSearchParams(url.slice(queryIndex + 1)).get('code');
  return code && code.length > 0 ? code : null;
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
