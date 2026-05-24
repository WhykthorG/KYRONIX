import { createApiError, handleApiError, requireAuthenticatedRequest } from '../database/supabaseAdminServer.js';
import { enforceRequestSecurity } from '../middlewares/requestSecurity.js';
import { isProxyableSupabasePath } from '../../../shared/src/supabaseProxyRouting.js';
import { assertSupabaseProjectUrl } from '../../../shared/src/supabaseProjectUrl.js';

function getSupabaseUrl() {
  const configuredUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  return assertSupabaseProjectUrl(configuredUrl, process.env.VITE_SUPABASE_URL ? 'VITE_SUPABASE_URL' : 'SUPABASE_URL');
}

const FORWARDED_HEADER_NAMES = new Set([
  'accept',
  'accept-language',
  'apikey',
  'authorization',
  'cache-control',
  'content-type',
  'if-match',
  'if-none-match',
  'prefer',
  'range',
  'x-client-info',
  'x-supabase-api-version',
  'x-tenant-id',
  'x-audit-actor-id',
  'x-audit-actor-email',
  'x-audit-actor-name',
  'x-audit-actor-profile-type',
]);

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

const DECODED_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'content-length',
]);

function normalizePathParts(pathParts) {
  if (Array.isArray(pathParts)) {
    return pathParts.filter(Boolean).map((part) => String(part).trim()).filter(Boolean);
  }

  if (typeof pathParts === 'string') {
    return pathParts.split('/').map((part) => String(part).trim()).filter(Boolean);
  }

  return [];
}

function buildPathname(pathParts) {
  const normalized = normalizePathParts(pathParts);
  return `/${normalized.join('/')}`;
}

function getRouteAction(method) {
  return ['GET', 'HEAD', 'OPTIONS'].includes(String(method || '').toUpperCase()) ? 'read' : 'write';
}

function getRequestHeader(req, name) {
  if (!req?.headers) return null;
  const direct = req.headers[name];
  if (Array.isArray(direct)) return direct[0] || null;
  if (typeof direct === 'string') return direct;

  const lower = req.headers[String(name).toLowerCase()];
  if (Array.isArray(lower)) return lower[0] || null;
  if (typeof lower === 'string') return lower;

  return null;
}

function collectForwardHeaders(req, requester = null) {
  const headers = new Headers();

  for (const [name, value] of Object.entries(req?.headers || {})) {
    if (!value || HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
      continue;
    }

    if (!FORWARDED_HEADER_NAMES.has(name.toLowerCase()) && !name.toLowerCase().startsWith('x-')) {
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length > 0) headers.set(name, value[0]);
      continue;
    }

    headers.set(name, value);
  }

  const tenantId = requester?.tenantId || requester?.profile?.tenant_id || null;
  const actorId = requester?.user?.id || null;
  const actorEmail = requester?.user?.email || null;
  const actorName = requester?.profile?.full_name || actorEmail || null;
  const actorProfileType = requester?.profile?.profile_type || null;

  if (tenantId) headers.set('x-tenant-id', tenantId);
  if (actorId) headers.set('x-audit-actor-id', actorId);
  if (actorEmail) headers.set('x-audit-actor-email', actorEmail);
  if (actorName) headers.set('x-audit-actor-name', actorName);
  if (actorProfileType) headers.set('x-audit-actor-profile-type', actorProfileType);

  return headers;
}

async function readRequestBody(req) {
  if (['GET', 'HEAD'].includes(String(req?.method || '').toUpperCase())) {
    return undefined;
  }

  if (req?.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) return req.body;
    if (typeof req.body === 'string') return req.body;
    if (req.body instanceof Uint8Array) return req.body;
    if (typeof req.body === 'object') {
      return JSON.stringify(req.body);
    }
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return Buffer.concat(chunks);
}

async function resolveProxyRequester(req) {
  const authorization = getRequestHeader(req, 'authorization');
  if (!authorization) {
    return null;
  }

  try {
    return await requireAuthenticatedRequest(req);
  } catch (error) {
    if (error?.statusCode && error.statusCode < 500) {
      return null;
    }

    throw error;
  }
}

function getProxyTargetUrl(pathname, search = '') {
  const supabaseUrl = getSupabaseUrl();

  if (!supabaseUrl) {
    throw createApiError('URL do Supabase nao configurada.', {
      statusCode: 500,
      code: 'SUPABASE_PROXY_URL_MISSING',
    });
  }

  if (!isProxyableSupabasePath(pathname)) {
    throw createApiError('Rota Supabase nao suportada pelo proxy.', {
      statusCode: 404,
      code: 'SUPABASE_PROXY_ROUTE_NOT_ALLOWED',
    });
  }

  const normalizedSearch = typeof search === 'string' && search
    ? (search.startsWith('?') ? search : `?${search}`)
    : '';

  return `${supabaseUrl}${pathname}${normalizedSearch}`;
}

function isPublicSupabaseAuthPath(pathname) {
  return typeof pathname === 'string' && pathname.replace(/\/+/g, '/').startsWith('/auth/v1/');
}

function canBypassRequestSecurityFailureInDevelopment(error) {
  return process.env.NODE_ENV !== 'production'
    && error?.code === 'REQUEST_SECURITY_CHECK_FAILED'
    && (!error?.statusCode || error.statusCode >= 500);
}

function isLocalDevelopmentRequest(req) {
  const host = String(req?.headers?.host || '').toLowerCase();
  const forwardedHost = String(req?.headers?.['x-forwarded-host'] || '').toLowerCase();
  const origin = String(req?.headers?.origin || '').toLowerCase();
  const referer = String(req?.headers?.referer || '').toLowerCase();
  const remoteAddress = String(req?.socket?.remoteAddress || '').toLowerCase();
  const candidates = [host, forwardedHost, origin, referer, remoteAddress];

  return candidates.some((value) => (
    value.includes('localhost')
    || value.includes('127.0.0.1')
    || value.includes('[::1]')
    || value === '::1'
  ));
}

async function runProxySecurityCheck({ req, requester, routeKey, pathname, securityCheck }) {
  try {
    await securityCheck({
      req,
      requester,
      routeKey,
      action: getRouteAction(req.method),
      metadata: {
        proxy: 'supabase',
        upstream_path: pathname,
        method: req.method || null,
      },
    });
  } catch (error) {
    if (!canBypassRequestSecurityFailureInDevelopment(error) && !isLocalDevelopmentRequest(req)) {
      throw error;
    }

    console.warn(
      `[supabase-proxy][request-security-bypass] Development bypass for ${routeKey} method=${req.method || 'UNKNOWN'} traceId=${error?.traceId || 'unavailable'}`
    );
  }
}

function copyResponseHeaders(sourceHeaders, res) {
  for (const [name, value] of sourceHeaders.entries()) {
    const lowerName = name.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lowerName) || DECODED_RESPONSE_HEADERS.has(lowerName)) continue;
    res.setHeader(name, value);
  }
}

export async function handleSupabaseProxyRequest(
  req,
  res,
  {
    pathParts = null,
    fetchImpl = fetch,
    securityCheck = enforceRequestSecurity,
    resolveRequester = resolveProxyRequester,
  } = {},
) {
  try {
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(String(req.method || '').toUpperCase())) {
      throw createApiError('Metodo nao permitido.', {
        statusCode: 405,
        code: 'METHOD_NOT_ALLOWED',
      });
    }

    const pathname = buildPathname(pathParts);
    const url = new URL(req.url || '/', 'http://localhost');
    const targetUrl = getProxyTargetUrl(pathname, url.search);
    const isPublicAuthRoute = isPublicSupabaseAuthPath(pathname);
    const requester = isPublicAuthRoute ? null : await resolveRequester(req);
    const routeKey = `api/security/supabase${pathname}`;

    if (!isPublicAuthRoute) {
      await runProxySecurityCheck({
        req,
        requester,
        routeKey,
        pathname,
        securityCheck,
      });
    }

    const body = await readRequestBody(req);
    const headers = collectForwardHeaders(req, requester);
    const response = await fetchImpl(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    res.statusCode = response.status;
    copyResponseHeaders(response.headers, res);

    if (response.status === 204 || response.status === 205) {
      res.end();
      return;
    }

    const arrayBuffer = await response.arrayBuffer();
    res.end(Buffer.from(arrayBuffer));
  } catch (error) {
    if (error?.statusCode === 405) {
      res.setHeader('Allow', 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS');
    }

    return handleApiError(res, error);
  }
}

export {
  buildPathname as buildSupabaseProxyPathname,
  collectForwardHeaders,
  canBypassRequestSecurityFailureInDevelopment,
  copyResponseHeaders,
  getProxyTargetUrl,
  getRouteAction,
  readRequestBody,
  resolveProxyRequester,
};
