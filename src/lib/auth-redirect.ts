import * as Linking from 'expo-linking';

/**
 * Single source for auth redirect URLs. Wraps Linking.createURL so Expo Go
 * (`exp://…/--/<path>`) and standalone builds (`tellme://<path>`) resolve to the
 * same logical target — these exact values must be registered in the Supabase
 * redirect allow-list (see the Phase 3 OAuth setup runbook).
 */
export type AuthRedirectPath = 'auth-callback' | 'reset-password';

export function authRedirectUrl(path: AuthRedirectPath): string {
  return Linking.createURL(path);
}
