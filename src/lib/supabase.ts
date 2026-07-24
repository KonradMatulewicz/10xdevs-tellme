// Must load before supabase-js so PKCE verifiers come from a CSPRNG, not Math.random().
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { config } from './config';

/**
 * Supabase client for the mobile app. AsyncStorage persists the session so the
 * user stays logged in across launches; tokens auto-refresh. The publishable key
 * is public — RLS enforces per-user access.
 *
 * flowType 'pkce' makes both Google OAuth and password-recovery redirects return
 * a `?code=…` the app exchanges manually via exchangeCodeForSession. detectSessionInUrl
 * stays off because that exchange is driven by the app on native (deep link), not by
 * the Supabase client parsing a browser URL.
 */
export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
