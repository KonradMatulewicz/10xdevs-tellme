import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { authRedirectUrl } from './auth-redirect';
import { supabase } from './supabase';

type Result = { error?: string };

type AuthState = {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<Result>;
  signUp: (email: string, password: string) => Promise<Result & { needsConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<Result>;
  resetPassword: (email: string) => Promise<Result>;
  updatePassword: (password: string) => Promise<Result>;
};

/**
 * Map a Supabase auth error to a user-facing string. The email-collision case
 * (Google email already registered for password sign-in) gets actionable guidance;
 * everything else passes the original message through. Pure and unit-tested.
 */
export function mapAuthError(error: { message?: string; code?: string }): string {
  const code = error.code ?? '';
  const message = error.message ?? 'Something went wrong. Please try again.';
  if (
    code === 'email_exists' ||
    code === 'user_already_exists' ||
    code === 'identity_already_exists' ||
    /already (registered|exists|in use)/i.test(message) ||
    /email address.*already/i.test(message)
  ) {
    return 'This email already uses password sign-in — sign in with your password.';
  }
  return message;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    session,
    loading,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message };
    },
    signUp: async (email, password) => {
      const { data, error } = await supabase.auth.signUp({ email, password });
      // If email confirmation is on, signUp returns a user but no session.
      return { error: error?.message, needsConfirmation: !error && !data.session };
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
    signInWithGoogle: async () => {
      const redirectTo = authRedirectUrl('auth-callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          // Google keeps its Safari session after our signOut; without this the
          // browser auto-redirects and the user can never switch accounts.
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) return { error: mapAuthError(error) };
      if (!data?.url) return { error: 'Could not start Google sign-in.' };

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      // cancel / dismiss is a user choice, not an error — return quietly.
      if (result.type !== 'success') return {};

      const code = Linking.parse(result.url).queryParams?.code;
      if (typeof code !== 'string') return { error: 'Google sign-in did not return a code.' };

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      return { error: exchangeError ? mapAuthError(exchangeError) : undefined };
    },
    resetPassword: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: authRedirectUrl('reset-password'),
      });
      return { error: error?.message };
    },
    updatePassword: async (password) => {
      const { error } = await supabase.auth.updateUser({ password });
      return { error: error?.message };
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
