import * as Linking from 'expo-linking';

import { authRedirectUrl } from '../auth-redirect';

// Hoisted above the imports by babel-plugin-jest-hoist, so expo-linking is mocked
// before auth-redirect pulls it in.
jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `exp://127.0.0.1:8081/--/${path}`),
}));

describe('authRedirectUrl', () => {
  it('forwards the auth-callback path to Linking.createURL unchanged', () => {
    expect(authRedirectUrl('auth-callback')).toBe('exp://127.0.0.1:8081/--/auth-callback');
    expect(Linking.createURL).toHaveBeenCalledWith('auth-callback');
  });

  it('forwards the reset-password path to Linking.createURL unchanged', () => {
    expect(authRedirectUrl('reset-password')).toBe('exp://127.0.0.1:8081/--/reset-password');
    expect(Linking.createURL).toHaveBeenCalledWith('reset-password');
  });
});
