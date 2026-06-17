import { mapAuthError } from '../auth';

const COLLISION = 'This email already uses password sign-in — sign in with your password.';

describe('mapAuthError', () => {
  it('maps the email-collision error code to actionable guidance', () => {
    expect(mapAuthError({ code: 'email_exists', message: 'User already registered' })).toBe(
      COLLISION,
    );
  });

  it('maps a collision message even without a known code', () => {
    expect(
      mapAuthError({ message: 'A user with this email address has already been registered' }),
    ).toBe(COLLISION);
  });

  it('passes a non-collision error message through unchanged', () => {
    expect(mapAuthError({ code: 'invalid_grant', message: 'Invalid login credentials' })).toBe(
      'Invalid login credentials',
    );
  });

  it('falls back to a generic message when none is provided', () => {
    expect(mapAuthError({})).toBe('Something went wrong. Please try again.');
  });
});
