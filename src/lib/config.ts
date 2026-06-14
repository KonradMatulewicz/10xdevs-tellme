/**
 * Client config. All values here are public-by-design: the Supabase URL and
 * publishable (anon) key ship in the app and are gated by RLS; the API URL is
 * the public Worker endpoint. Override per-environment via EXPO_PUBLIC_* vars.
 */
export const config = {
  apiUrl:
    process.env.EXPO_PUBLIC_API_URL ?? 'https://tellme-backend.konrad-matulewicz1.workers.dev',
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://mzbpchvzmuaqpuomwrpu.supabase.co',
  supabaseAnonKey:
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_2jukHQ69G_hgVnvtVdJ3CA_cyXilMi7',
} as const;
