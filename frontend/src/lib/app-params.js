/**
 * app-params.js
 * Replaces the old Base44 app-params with Supabase env vars.
 * Kept so any existing import of '@/lib/app-params' still resolves.
 */
export const appParams = {
  appId:            import.meta.env.VITE_SUPABASE_URL ?? '',
  token:            null,
  functionsVersion: null,
  appBaseUrl:       import.meta.env.VITE_SUPABASE_URL ?? '',
};
