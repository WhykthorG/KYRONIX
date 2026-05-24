// ßâ×ßâáßâØßâößâÑßâóßâÿ ßâößâÑßâíßâÖßâÜßâúßâûßâÿßâúßâáßâÉßâô Whykthor GSV-ßâÿßâí ßâøßâÿßâößâá ßâ¿ßâößâÿßâÑßâøßâ£ßâÉ.
import { createClient } from '@supabase/supabase-js';
import { buildSupabaseProxyPath, isProxyableSupabasePath } from '@shared/supabaseProxyRouting';
import { assertSupabaseProjectUrl } from '@shared/supabaseProjectUrl';

const supabaseUrl = assertSupabaseProjectUrl(import.meta.env.VITE_SUPABASE_URL, 'VITE_SUPABASE_URL');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_CLIENT_VERSION = 'proxy-non-auth-v3';
const supabaseState = globalThis.__appSupabaseState || (globalThis.__appSupabaseState = {
  client: null,
  version: null,
  accessToken: null,
});
const RECOVERABLE_AUTH_ERROR_PATTERNS = [
  /requested device not found/i,
  /invalid refresh token/i,
  /refresh token.*not found/i,
  /session.*not found/i,
];

export const resolveFetch = (customFetch) => {
  if (customFetch) {
    return (...args) => customFetch(...args);
  }

  return (...args) => fetch(...args);
};

export const resolveHeadersConstructor = () => {
  return Headers;
};

export function setSupabaseAccessToken(accessToken) {
  supabaseState.accessToken = accessToken || null;
}

export function isRecoverableSupabaseSessionError(error) {
  const message = String(error?.message || '');
  return RECOVERABLE_AUTH_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export async function clearCorruptedSupabaseSession() {
  setSupabaseAccessToken(null);

  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore cleanup failures and fall back to a signed-out state in memory.
    }
  }
}

export async function getSessionSafely() {
  const result = await supabase.auth.getSession();

  if (result.error && isRecoverableSupabaseSessionError(result.error)) {
    await clearCorruptedSupabaseSession();
    return {
      data: { session: null },
      error: null,
      recovered: true,
    };
  }

  return {
    ...result,
    recovered: false,
  };
}

export async function getAccessTokenOrThrow(
  missingSessionMessage = 'Sessao expirada. Entre novamente para continuar.'
) {
  const { data, error } = await getSessionSafely();
  if (error) throw error;

  const accessToken = data?.session?.access_token ?? null;
  if (!accessToken) {
    throw new Error(missingSessionMessage);
  }

  return accessToken;
}

function isRequestLike(value) {
  return Boolean(value && typeof value === 'object' && typeof value.url === 'string');
}

function shouldProxyRequest(input) {
  const requestUrl = isRequestLike(input) ? input.url : String(input || '');

  if (!requestUrl) return false;

  let parsedUrl;
  try {
    parsedUrl = new URL(requestUrl, supabaseUrl);
  } catch {
    return false;
  }

  if (parsedUrl.origin !== supabaseUrl) {
    return false;
  }

  const pathname = parsedUrl.pathname || '';
  if (!isProxyableSupabasePath(pathname)) {
    return false;
  }

  if (pathname.startsWith('/auth/v1/')) {
    return false;
  }

  return true;
}

async function resolveProxyBody(input, init) {
  if (init?.body !== undefined) {
    return init.body;
  }

  if (!isRequestLike(input)) {
    return undefined;
  }

  if (typeof input.clone !== 'function') {
    return undefined;
  }

  if (['GET', 'HEAD'].includes((input.method || '').toUpperCase())) {
    return undefined;
  }

  const cloned = input.clone();
  const arrayBuffer = await cloned.arrayBuffer();
  return arrayBuffer.byteLength > 0 ? arrayBuffer : undefined;
}

function buildProxyFetchUrl(input, init) {
  const requestUrl = isRequestLike(input) ? input.url : String(input || '');
  const parsedUrl = new URL(requestUrl, supabaseUrl);
  return buildSupabaseProxyPath(parsedUrl.pathname, parsedUrl.search) || requestUrl;
}

function isSafeDirectFallbackMethod(method) {
  const normalizedMethod = String(method || 'GET').toUpperCase();
  return normalizedMethod === 'GET' || normalizedMethod === 'HEAD';
}

function shouldRetryWithoutProxy(response, proxiedUrl, method = 'GET') {
  if (!response) {
    return false;
  }

  if (typeof proxiedUrl !== 'string' || !proxiedUrl) {
    return false;
  }

  try {
    const resolvedUrl = new URL(proxiedUrl, globalThis.location?.origin || 'http://localhost');
    if (!resolvedUrl.pathname.startsWith('/api/security/supabase/')) {
      return false;
    }

    if (response.status === 404) {
      return true;
    }

    return isSafeDirectFallbackMethod(method) && response.status >= 500 && response.status < 600;
  } catch {
    return false;
  }
}

function shouldRetryWithoutProxyAfterError(error, proxiedUrl, method = 'GET') {
  if (!isSafeDirectFallbackMethod(method)) {
    return false;
  }

  if (typeof proxiedUrl !== 'string' || !proxiedUrl) {
    return false;
  }

  try {
    const resolvedUrl = new URL(proxiedUrl, globalThis.location?.origin || 'http://localhost');
    if (!resolvedUrl.pathname.startsWith('/api/security/supabase/')) {
      return false;
    }
  } catch {
    return false;
  }

  const message = String(error?.message || '').toLowerCase();
  return (
    error?.name === 'TypeError'
    || message.includes('failed to fetch')
    || message.includes('networkerror')
  );
}

export const fetchWithAuth = (
  supabaseKey,
  getAccessToken,
  customFetch
) => {
  const resolvedFetch = resolveFetch(customFetch);
  const HeadersConstructor = resolveHeadersConstructor();

  return async (input, init) => {
    const accessToken = (await getAccessToken()) ?? supabaseKey;
    const headers = new HeadersConstructor(init?.headers);
    const method = String(
      init?.method
      || (isRequestLike(input) ? input.method : '')
      || 'GET'
    ).toUpperCase();

    if (!headers.has('apikey')) {
      headers.set('apikey', supabaseKey);
    }

    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    if (!shouldProxyRequest(input)) {
      return resolvedFetch(input, { ...init, headers });
    }

    const proxiedUrl = buildProxyFetchUrl(input, { ...init, headers });
    const body = await resolveProxyBody(input, init);
    let proxiedResponse;
    try {
      proxiedResponse = await resolvedFetch(proxiedUrl, {
        ...init,
        headers,
        body,
      });
    } catch (error) {
      if (!shouldRetryWithoutProxyAfterError(error, proxiedUrl, method)) {
        throw error;
      }

      return resolvedFetch(input, {
        ...init,
        headers,
        body,
      });
    }

    if (!shouldRetryWithoutProxy(proxiedResponse, proxiedUrl, method)) {
      return proxiedResponse;
    }

    return resolvedFetch(input, {
      ...init,
      headers,
      body,
    });
  };
};

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables.\n'
    + 'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file.',
  );
}

const customFetch = fetchWithAuth(
  supabaseAnonKey,
  async () => supabaseState.accessToken ?? null,
  globalThis.fetch?.bind(globalThis)
);

const shouldReuseSupabaseClient = supabaseState.client && supabaseState.version === SUPABASE_CLIENT_VERSION;

export const supabase = shouldReuseSupabaseClient ? supabaseState.client : createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: customFetch,
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

supabaseState.client = supabase;
supabaseState.version = SUPABASE_CLIENT_VERSION;

export default supabase;
