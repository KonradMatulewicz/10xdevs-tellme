import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { config } from './config';

/**
 * Supabase client for the mobile app. AsyncStorage persists the session so the
 * user stays logged in across launches; tokens auto-refresh. The publishable key
 * is public — RLS enforces per-user access. detectSessionInUrl is off (no web
 * OAuth redirect handling in the native app yet).
 */
export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
