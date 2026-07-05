import 'react-native-url-polyfill/auto';

import { extractRecoveryCode, validateNewPassword } from '../recovery';

describe('extractRecoveryCode', () => {
  it('extracts the code from an Expo Go recovery deep link', () => {
    const url = 'exp://127.0.0.1:8081/--/reset-password?code=abc123&type=recovery';
    expect(extractRecoveryCode(url)).toBe('abc123');
  });

  it('extracts the code from a standalone scheme deep link', () => {
    expect(extractRecoveryCode('tellme://reset-password?code=xyz')).toBe('xyz');
  });

  it('returns null when the URL has no query string', () => {
    expect(extractRecoveryCode('exp://127.0.0.1:8081/--/reset-password')).toBeNull();
  });

  it('returns null when the query carries no code', () => {
    expect(extractRecoveryCode('tellme://reset-password?type=recovery')).toBeNull();
  });

  it('returns null for null/undefined/empty input', () => {
    expect(extractRecoveryCode(null)).toBeNull();
    expect(extractRecoveryCode(undefined)).toBeNull();
    expect(extractRecoveryCode('')).toBeNull();
  });
});

describe('validateNewPassword', () => {
  it('rejects passwords shorter than the minimum', () => {
    expect(validateNewPassword('123', '123')).toMatch(/at least/);
  });

  it('rejects when confirmation does not match', () => {
    expect(validateNewPassword('secret123', 'secret124')).toBe('Passwords do not match.');
  });

  it('accepts a valid, matching password', () => {
    expect(validateNewPassword('secret123', 'secret123')).toBeNull();
  });
});
