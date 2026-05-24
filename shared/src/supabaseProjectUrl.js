// ðƒÐÇð¥ðÁð║Ðé ð┐ð¥ð╗ð¢ð¥ÐüÐéÐîÐÄ ÐÇð░ðÀÐÇð░ð▒ð¥Ðéð░ð¢ ðúð©ð║Ðéð¥ÐÇð¥ð╝ ðôðíðÆ.
const INVALID_SUPABASE_HOSTNAMES = new Set([
  'api.supabase.com',
  'supabase.com',
  'www.supabase.com',
  'supabase.co',
  'www.supabase.co',
]);

export function normalizeSupabaseProjectUrl(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return '';
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return '';
  }

  if (INVALID_SUPABASE_HOSTNAMES.has(parsedUrl.hostname.toLowerCase())) {
    return '';
  }

  if (parsedUrl.pathname && parsedUrl.pathname !== '/') {
    return '';
  }

  return parsedUrl.origin;
}

export function assertSupabaseProjectUrl(value, envName = 'VITE_SUPABASE_URL') {
  const normalizedUrl = normalizeSupabaseProjectUrl(value);
  if (normalizedUrl) {
    return normalizedUrl;
  }

  throw new Error(
    `Invalid Supabase project URL in ${envName}. `
    + 'Expected the project base URL, for example '
    + '"https://abcdefghijklmno.supabase.co". '
    + `Received: ${JSON.stringify(value ?? '')}`
  );
}
