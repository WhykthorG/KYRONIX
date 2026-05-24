// ┌ñÏ▒┘êÏ»┘ê┘é Ïº┘è┘å Ï»┌ñÏ▒Ï¿┘êÏºÏ¬ Ï│┌ñ┘å┘ê┘ç┌¢ Ïº┘ê┘ä┘è┘ç Whyktor GSV.
import { createHash } from 'node:crypto';
import { createApiError, createServiceRoleClient } from '../database/supabaseAdminServer.js';

const SECURITY_DEFAULTS = Object.freeze({
  read: Object.freeze({ limit: 120, windowSeconds: 300, blockSeconds: 300 }),
  write: Object.freeze({ limit: 40, windowSeconds: 300, blockSeconds: 900 }),
  admin: Object.freeze({ limit: 15, windowSeconds: 300, blockSeconds: 1800 }),
  critical: Object.freeze({ limit: 8, windowSeconds: 300, blockSeconds: 3600 }),
});

function normalizeText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

export function getRequestIp(req) {
  const candidates = [
    req?.headers?.['x-vercel-forwarded-for'],
    req?.headers?.['x-forwarded-for'],
    req?.headers?.['x-real-ip'],
    req?.headers?.['cf-connecting-ip'],
    req?.headers?.['true-client-ip'],
    req?.socket?.remoteAddress,
  ];

  for (const candidate of candidates) {
    const raw = Array.isArray(candidate) ? candidate[0] : candidate;
    const value = normalizeText(raw, '');
    if (!value) continue;

    const firstIp = value.split(',')[0].trim();
    if (!firstIp) continue;

    return firstIp.replace(/^::ffff:/i, '');
  }

  return null;
}

export function hashRequestIp(ip) {
  const salt = normalizeText(process.env.SECURITY_IP_HASH_SALT, '');
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

export function resolveSecurityPolicy(action = 'write') {
  return SECURITY_DEFAULTS[action] || SECURITY_DEFAULTS.write;
}

function normalizeRouteKey(routeKey, req) {
  const explicit = normalizeText(routeKey, '');
  if (explicit) return explicit;

  const pathname = normalizeText(req?.url, '');
  if (!pathname) return 'unknown';

  return pathname.split('?')[0].replace(/\/+/g, '/').replace(/^\/+/, '') || 'unknown';
}

function buildBlockMessage(routeKey, blockedUntil) {
  const until = blockedUntil ? new Date(blockedUntil).toISOString() : null;
  return until
    ? `Seu acesso foi bloqueado temporariamente para ${routeKey} ate ${until}.`
    : `Seu acesso foi bloqueado temporariamente para ${routeKey}.`;
}

function isMissingSecurityInfrastructureError(error) {
  const message = error?.message || '';
  return [
    '42883',
    '42P01',
    '42703',
    '42702',
    'PGRST202',
    'PGRST205',
  ].includes(error?.code)
    || /register_security_request/i.test(message)
    || /security_request_windows/i.test(message)
    || /security_ip_blocks/i.test(message)
    || /security_events/i.test(message)
    || /column .* does not exist/i.test(message)
    || /column reference ['"]scope_key['"] is ambiguous/i.test(message);
}

function canBypassRequestSecurityFailureInDevelopment(error) {
  return process.env.NODE_ENV !== 'production'
    && isMissingSecurityInfrastructureError(error);
}

function isLocalDevelopmentRequest(req) {
  const hostHeader = normalizeText(req?.headers?.host, '').toLowerCase();
  const forwardedHost = normalizeText(req?.headers?.['x-forwarded-host'], '').toLowerCase();
  const originHeader = normalizeText(req?.headers?.origin, '').toLowerCase();
  const refererHeader = normalizeText(req?.headers?.referer, '').toLowerCase();
  const remoteAddress = normalizeText(req?.socket?.remoteAddress, '').toLowerCase();
  const candidates = [hostHeader, forwardedHost, originHeader, refererHeader, remoteAddress];

  return candidates.some((value) => (
    value.includes('localhost')
    || value.includes('127.0.0.1')
    || value.includes('[::1]')
    || value === '::1'
  ));
}

export async function enforceRequestSecurity({
  req,
  requester = null,
  routeKey = null,
  action = 'write',
  limit = null,
  windowSeconds = null,
  blockSeconds = null,
  metadata = {},
} = {}) {
  const ip = getRequestIp(req);
  if (!ip) {
    throw createApiError('Nao foi possivel identificar o IP da requisicao.', {
      statusCode: 403,
      code: 'REQUEST_IP_REQUIRED',
    });
  }

  const policy = resolveSecurityPolicy(action);
  const resolvedLimit = Number.isInteger(limit) ? limit : policy.limit;
  const resolvedWindowSeconds = Number.isInteger(windowSeconds) ? windowSeconds : policy.windowSeconds;
  const resolvedBlockSeconds = Number.isInteger(blockSeconds) ? blockSeconds : policy.blockSeconds;
  const resolvedRouteKey = normalizeRouteKey(routeKey, req);
  const tenantId = normalizeText(requester?.tenantId, '') || null;
  const userId = normalizeText(requester?.user?.id, '') || null;
  const userEmail = normalizeText(requester?.user?.email, '').toLowerCase() || null;
  const auditActor = requester
    ? {
        actor_user_id: userId,
        actor_email: userEmail,
        actor_name: requester?.profile?.full_name || userEmail || '',
        actor_profile_type: requester?.profile?.profile_type || '',
      }
    : null;
  const client = createServiceRoleClient(auditActor);

  const { data, error } = await client.rpc('register_security_request', {
    p_tenant_id: tenantId,
    p_ip_hash: hashRequestIp(ip),
    p_route_key: resolvedRouteKey,
    p_limit: resolvedLimit,
    p_window_seconds: resolvedWindowSeconds,
    p_block_seconds: resolvedBlockSeconds,
    p_user_id: userId,
    p_user_email: userEmail,
    p_metadata: {
      ...metadata,
      method: req?.method || null,
      action,
    },
  });

  if (error) {
    if (canBypassRequestSecurityFailureInDevelopment(error) || isLocalDevelopmentRequest(req)) {
      console.warn(
        `[request-security-bypass] Development bypass for ${resolvedRouteKey} method=${req?.method || 'UNKNOWN'} code=${error?.code || 'unknown'}`
      );

      return {
        ip,
        ipHash: hashRequestIp(ip),
        routeKey: resolvedRouteKey,
        limit: resolvedLimit,
        requestCount: null,
        windowSeconds: resolvedWindowSeconds,
        blockedUntil: null,
        bypassed: true,
      };
    }

    throw createApiError('Falha ao aplicar protecao de requisicao.', {
      statusCode: 500,
      code: 'REQUEST_SECURITY_CHECK_FAILED',
      cause: error,
      details: {
        routeKey: resolvedRouteKey,
      },
    });
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (result?.blocked) {
    throw createApiError(buildBlockMessage(resolvedRouteKey, result.blocked_until), {
      statusCode: 403,
      code: 'REQUEST_IP_BLOCKED',
      details: {
        routeKey: resolvedRouteKey,
        blockedUntil: result.blocked_until || null,
      },
    });
  }

  if (result?.rate_limited) {
    throw createApiError('Limite de requisicoes excedido. Tente novamente em instantes.', {
      statusCode: 429,
      code: 'REQUEST_RATE_LIMITED',
      details: {
        routeKey: resolvedRouteKey,
        requestCount: result.request_count ?? null,
        limit: result.limit_value ?? resolvedLimit,
        windowSeconds: result.window_seconds ?? resolvedWindowSeconds,
        retryAfterSeconds: result.retry_after_seconds ?? null,
      },
    });
  }

  return {
    ip,
    ipHash: hashRequestIp(ip),
    routeKey: resolvedRouteKey,
    limit: result?.limit_value ?? resolvedLimit,
    requestCount: result?.request_count ?? null,
    windowSeconds: result?.window_seconds ?? resolvedWindowSeconds,
    blockedUntil: result?.blocked_until ?? null,
  };
}

export { SECURITY_DEFAULTS };
