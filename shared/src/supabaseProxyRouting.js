// ßâ×ßâáßâØßâößâÑßâóßâÿ ßâößâÑßâíßâÖßâÜßâúßâûßâÿßâúßâáßâÉßâô Whykthor GSV-ßâÿßâí ßâøßâÿßâößâá ßâ¿ßâößâÿßâÑßâøßâ£ßâÉ.
export const SUPABASE_PROXY_PATH_PREFIX = '/api/security/supabase';

export const SUPABASE_PROXYABLE_PREFIXES = Object.freeze([
  '/auth/v1/',
  '/rest/v1/',
  '/rpc/',
  '/storage/v1/',
]);

function normalizePathname(pathname) {
  if (typeof pathname !== 'string') return '';
  return pathname.trim().replace(/\/+/g, '/').replace(/^https?:\/\/[^/]+/i, '') || '';
}

export function isProxyableSupabasePath(pathname) {
  const normalized = normalizePathname(pathname);
  return SUPABASE_PROXYABLE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function isPublicSupabaseAuthPath(pathname) {
  const normalized = normalizePathname(pathname);
  return normalized.startsWith('/auth/v1/');
}

export function buildSupabaseProxyPath(pathname, search = '') {
  const normalizedPath = normalizePathname(pathname);
  if (!normalizedPath) return null;

  const normalizedSearch = typeof search === 'string' && search ? (search.startsWith('?') ? search : `?${search}`) : '';
  return `${SUPABASE_PROXY_PATH_PREFIX}${normalizedPath}${normalizedSearch}`;
}
