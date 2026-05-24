import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import {
  buildAuditEventLogEntry,
  buildAuditLogEntry,
  getAuditActorFromRequester,
} from '../../../shared/src/auditLog.js';
import { hasPermission } from '../../../shared/src/contracts/access.js';
import {
  buildObservabilityLogEntry,
  OBSERVABILITY_TABLE_NAME,
} from '../../../shared/src/contracts/observability.js';
import { assertSupabaseProjectUrl } from '../../../shared/src/supabaseProjectUrl.js';

const ALLOWED_ADMIN_ROLES = ['administrador', 'coordenador', 'secretario'];
const DEFAULT_STORAGE_BUCKET = process.env.VITE_STORAGE_BUCKET || 'project-wg-files';

function getEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getConfig() {
  return {
    supabaseUrl: assertSupabaseProjectUrl(getEnv('VITE_SUPABASE_URL'), 'VITE_SUPABASE_URL'),
    supabaseAnonKey: getEnv('VITE_SUPABASE_ANON_KEY'),
    serviceRoleKey: getEnv('SUPABASE_SERVICE_ROLE_KEY'),
  };
}

function buildAuditHeaders(auditActor) {
  if (!auditActor) return {};

  return {
    'x-audit-actor-id': auditActor.actor_user_id || '',
    'x-audit-actor-email': auditActor.actor_email || '',
    'x-audit-actor-name': auditActor.actor_name || '',
    'x-audit-actor-profile-type': auditActor.actor_profile_type || '',
  };
}

export function createServiceRoleClient(auditActor = null) {
  const { supabaseUrl, serviceRoleKey } = getConfig();
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: buildAuditHeaders(auditActor),
    },
  });
}

export function createRequestScopedClient(req) {
  const token = getBearerToken(req);
  if (!token) {
    const error = new Error('Token de autenticacao ausente.');
    error.statusCode = 401;
    throw error;
  }

  const { supabaseUrl, supabaseAnonKey } = getConfig();
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }

  const explicitToken = req.headers['x-supabase-access-token'] || req.headers['X-Supabase-Access-Token'];
  if (Array.isArray(explicitToken)) return explicitToken[0]?.trim() || null;
  if (typeof explicitToken === 'string') return explicitToken.trim() || null;

  return null;
}

function normalizeTenantId(...values) {
  for (const value of values) {
    if (typeof value !== 'string') continue;

    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

function extractAuthUserTenantId(authUser) {
  return normalizeTenantId(
    authUser?.app_metadata?.tenant_id,
    authUser?.raw_app_meta_data?.tenant_id,
  );
}

function applyTenantFilter(query, tenantId) {
  if (!tenantId) {
    return query;
  }

  return query.eq('tenant_id', tenantId);
}

function isMissingTenantColumnError(error) {
  const message = error?.message || '';
  return (
    error?.code === '42703'
    || /column .*tenant_id.* does not exist/i.test(message)
    || /could not find the ['"]tenant_id['"] column/i.test(message)
  );
}

async function fetchUserProfilesByEmail(serviceClient, email, tenantId, limit = 2) {
  let query = serviceClient
    .from('user_profiles')
    .select('id, user_email, profile_type, status, full_name, tenant_id')
    .ilike('user_email', email);

  query = applyTenantFilter(query, tenantId);

  let result = await query.limit(limit);

  if (result.error && isMissingTenantColumnError(result.error)) {
    result = await serviceClient
      .from('user_profiles')
      .select('id, user_email, profile_type, status, full_name')
      .ilike('user_email', email)
      .limit(limit);
  }

  return result;
}

async function fetchUserProfileAdmin(serviceClient, { profileId = null, email = null, tenantId = null } = {}) {
  let query = serviceClient
    .from('user_profiles')
    .select('id, user_email, profile_type, status, full_name, tenant_id')
    .limit(1);

  query = profileId ? query.eq('id', profileId) : query.eq('user_email', email);
  query = applyTenantFilter(query, tenantId);

  let result = await query.maybeSingle();

  if (result.error && isMissingTenantColumnError(result.error)) {
    let legacyQuery = serviceClient
      .from('user_profiles')
      .select('id, user_email, profile_type, status, full_name')
      .limit(1);

    legacyQuery = profileId ? legacyQuery.eq('id', profileId) : legacyQuery.eq('user_email', email);
    result = await legacyQuery.maybeSingle();
  }

  return result;
}

function isTenantMatch(expectedTenantId, resourceTenantId) {
  if (!expectedTenantId) {
    return true;
  }

  return normalizeTenantId(resourceTenantId) === expectedTenantId;
}

function createJson(res, statusCode, payload) {
  if (typeof res.status === 'function') {
    res.status(statusCode);
  } else {
    res.statusCode = statusCode;
  }

  if (typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'application/json');
  } else if (typeof res.set === 'function') {
    res.set('Content-Type', 'application/json');
  }

  res.end(JSON.stringify(payload));
}

export function createApiError(
  message,
  {
    statusCode = 500,
    code = 'ADMIN_API_ERROR',
    details = null,
    traceId = randomUUID(),
    cause = null,
  } = {}
) {
  const error = cause instanceof Error ? cause : new Error(message);
  error.message = message;
  error.statusCode = statusCode;
  error.code = code;
  error.traceId = traceId;
  error.details = details;
  if (cause) {
    error.cause = cause;
  }
  return error;
}

function normalizeApiError(error) {
  if (error?.statusCode && error?.code && error?.traceId) {
    return error;
  }

  return createApiError(
    error?.message || 'Erro interno do servidor.',
    {
      statusCode: error?.statusCode || 500,
      code: error?.code || 'ADMIN_API_ERROR',
      details: error?.details || null,
      traceId: error?.traceId || randomUUID(),
      cause: error instanceof Error ? error : null,
    }
  );
}

async function resolveRequester(token, { requireAdminRole = false, requiredPermission = null } = {}) {
  const { supabaseUrl, supabaseAnonKey } = getConfig();
  const authClient = createClient(supabaseUrl, supabaseAnonKey);

  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData?.user?.email) {
    const error = new Error('Sessao invalida ou expirada.');
    error.statusCode = 401;
    throw error;
  }

  const serviceClient = createServiceRoleClient();
  const authTenantId = normalizeTenantId(
    userData.user.app_metadata?.tenant_id,
    userData.user.user_metadata?.tenant_id,
  );

  const { data: profileRows, error: profileError } = await fetchUserProfilesByEmail(
    serviceClient,
    userData.user.email,
    authTenantId,
    2,
  );

  if (profileError) {
    const error = new Error('Nao foi possivel validar o perfil do operador.');
    error.statusCode = 500;
    throw error;
  }

  if ((profileRows?.length || 0) > 1) {
    const error = new Error('Mais de um perfil foi encontrado para este e-mail.');
    error.statusCode = 409;
    throw error;
  }

  const profile = profileRows?.[0] || null;

  if (requireAdminRole && (!profile?.profile_type || !ALLOWED_ADMIN_ROLES.includes(profile.profile_type))) {
    const error = new Error('Voce nao tem permissao para executar operacoes administrativas.');
    error.statusCode = 403;
    throw error;
  }

  if (requiredPermission && !hasPermission(profile?.profile_type, requiredPermission)) {
    const error = new Error('Voce nao tem permissao para executar esta operacao.');
    error.statusCode = 403;
    throw error;
  }

  if (profile?.status && !['ativo', 'pendente'].includes(profile.status)) {
    const error = new Error(
      requireAdminRole
        ? 'Seu perfil nao esta habilitado para operacoes administrativas.'
        : 'Seu perfil nao esta habilitado para registrar eventos auditaveis.'
    );
    error.statusCode = 403;
    throw error;
  }

  return {
    user: userData.user,
    profile,
    tenantId: normalizeTenantId(
      profile?.tenant_id,
      userData.user.app_metadata?.tenant_id,
      userData.user.user_metadata?.tenant_id,
    ),
  };
}

function adminHeaders(serviceRoleKey) {
  return {
    'Content-Type': 'application/json',
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };
}

async function adminFetch(path, options = {}) {
  const { supabaseUrl, serviceRoleKey } = getConfig();
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      ...adminHeaders(serviceRoleKey),
      ...(options.headers || {}),
    },
  });

  const raw = await response.text();
  let payload = null;

  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(
      payload?.msg || payload?.message || 'Falha na API administrativa do Supabase.'
    );
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}

export async function requireAdminRequest(req) {
  const token = getBearerToken(req);
  if (!token) {
    const error = new Error('Token de autenticacao ausente.');
    error.statusCode = 401;
    throw error;
  }

  return resolveRequester(token, { requireAdminRole: true });
}

export async function requireAuthenticatedRequest(req) {
  const token = getBearerToken(req);
  if (!token) {
    const error = new Error('Token de autenticacao ausente.');
    error.statusCode = 401;
    throw error;
  }

  return resolveRequester(token, { requireAdminRole: false });
}

export async function requirePermissionRequest(req, permission) {
  const token = getBearerToken(req);
  if (!token) {
    const error = new Error('Token de autenticacao ausente.');
    error.statusCode = 401;
    throw error;
  }

  return resolveRequester(token, { requiredPermission: permission });
}

export async function requireAnyPermissionRequest(req, permissions = []) {
  const token = getBearerToken(req);
  if (!token) {
    const error = new Error('Token de autenticacao ausente.');
    error.statusCode = 401;
    throw error;
  }

  const requester = await resolveRequester(token);
  const profileType = requester?.profile?.profile_type || null;
  const allowed = Array.isArray(permissions) && permissions.some((permission) => hasPermission(profileType, permission));

  if (!allowed) {
    const error = new Error('Voce nao tem permissao para executar esta operacao.');
    error.statusCode = 403;
    throw error;
  }

  return requester;
}

export async function findAuthUserByEmail(email, { tenantId = null } = {}) {
  const payload = await adminFetch(`/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    method: 'GET',
  });

  const users = payload?.users ?? [];
  return users.find((user) => (
    user.email === email
    && isTenantMatch(tenantId, extractAuthUserTenantId(user))
  )) ?? null;
}

export async function findAuthUserById(userId, { tenantId = null } = {}) {
  const serviceClient = createServiceRoleClient();
  const { data, error } = await serviceClient.auth.admin.getUserById(userId);

  if (error) {
    const err = new Error(error.message || 'Falha ao localizar usuario de autenticacao.');
    err.statusCode = error.status || 500;
    throw err;
  }

  const user = data?.user ?? null;
  if (!user) {
    return null;
  }

  return isTenantMatch(tenantId, extractAuthUserTenantId(user)) ? user : null;
}

export async function createAuthUserAdmin(email, password, { tenantId = null } = {}) {
  const serviceClient = createServiceRoleClient();
  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: tenantId ? { tenant_id: tenantId } : undefined,
    user_metadata: tenantId ? { tenant_id: tenantId } : undefined,
  });

  if (error || !data?.user) {
    const err = new Error(error?.message || 'Falha ao criar usuario de autenticacao.');
    err.statusCode = error?.status || 500;
    throw err;
  }

  return { id: data.user.id, email: data.user.email };
}

export async function insertManualAuditLog({ actor = null, action, entityTable, recordId, previousRecord = null, newRecord = null, metadata = {} }) {
  const serviceClient = createServiceRoleClient();
  const entry = buildAuditLogEntry({
    action,
    entityTable,
    recordId,
    actor,
    previousRecord,
    newRecord,
    metadata,
  });

  const { error } = await serviceClient
    .from('audit_logs')
    .insert(entry);

  if (error) {
    const err = new Error(error.message || 'Falha ao registrar auditoria.');
    err.statusCode = 500;
    throw err;
  }

  return { success: true };
}

export async function insertAuditEventLog({
  actor = null,
  eventType,
  recordId = null,
  previousRecord = null,
  newRecord = null,
  metadata = {},
}) {
  const serviceClient = createServiceRoleClient();
  const entry = buildAuditEventLogEntry({
    actor,
    eventType,
    recordId,
    previousRecord,
    newRecord,
    metadata,
  });

  const { error } = await serviceClient
    .from('audit_logs')
    .insert(entry);

  if (error) {
    const err = new Error(error.message || 'Falha ao registrar evento de auditoria.');
    err.statusCode = 500;
    throw err;
  }

  return { success: true };
}

function isObservabilityTableUnavailable(error) {
  return (
    error?.code === '42P01'
    || error?.code === 'PGRST205'
    || /observability_logs/i.test(error?.message || '')
  );
}

export async function insertObservabilityLog({
  actor = null,
  eventType,
  traceId = null,
  channel = null,
  level = null,
  message,
  operation = null,
  source = null,
  route = null,
  context = {},
}) {
  const serviceClient = createServiceRoleClient(actor);
  const entry = buildObservabilityLogEntry({
    actor,
    eventType,
    traceId,
    channel,
    level,
    message,
    operation,
    source,
    route,
    context,
  });

  const { error } = await serviceClient
    .from(OBSERVABILITY_TABLE_NAME)
    .insert(entry);

  if (error) {
    if (isObservabilityTableUnavailable(error)) {
      return {
        success: false,
        unavailable: true,
      };
    }

    const err = new Error(error.message || 'Falha ao registrar observabilidade.');
    err.statusCode = 500;
    err.code = 'OBSERVABILITY_LOG_INSERT_FAILED';
    throw err;
  }

  return { success: true };
}

export async function deleteStorageFiles(paths = [], { bucket = DEFAULT_STORAGE_BUCKET } = {}) {
  const normalizedPaths = [...new Set(
    (Array.isArray(paths) ? paths : [])
      .filter((path) => typeof path === 'string')
      .map((path) => path.trim())
      .filter(Boolean)
  )];

  if (normalizedPaths.length === 0) {
    return { success: true, deletedCount: 0 };
  }

  const serviceClient = createServiceRoleClient();
  const { error } = await serviceClient.storage.from(bucket).remove(normalizedPaths);

  if (error) {
    throw createApiError(
      error.message || 'Falha ao remover arquivos do storage.',
      {
        statusCode: 500,
        code: 'STORAGE_CLEANUP_FAILED',
        details: {
          bucket,
          paths: normalizedPaths,
        },
      }
    );
  }

  return {
    success: true,
    deletedCount: normalizedPaths.length,
  };
}

export async function resetAuthUserPassword(userId, password, { tenantId = null } = {}) {
  const authUser = await findAuthUserById(userId, { tenantId });
  if (!authUser?.id) {
    const error = new Error('Usuario informado nao foi encontrado.');
    error.statusCode = 404;
    throw error;
  }

  const payload = await adminFetch(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    body: JSON.stringify({ password }),
  });

  return payload;
}

export async function deleteAuthUserAdmin(userId, { tenantId = null } = {}) {
  const authUser = await findAuthUserById(userId, { tenantId });
  if (!authUser?.id) {
    const error = new Error('Usuario informado nao foi encontrado.');
    error.statusCode = 404;
    throw error;
  }

  const serviceClient = createServiceRoleClient();
  const { error } = await serviceClient.auth.admin.deleteUser(userId);
  if (error) {
    const err = new Error(error.message || 'Falha ao excluir usuario de autenticacao.');
    err.statusCode = error.status || 500;
    throw err;
  }

  return { success: true };
}

export async function findUserProfileAdmin({ profileId = null, email = null, tenantId = null }) {
  if (!profileId && !email) {
    const error = new Error('profileId ou email e obrigatorio para localizar o perfil.');
    error.statusCode = 400;
    throw error;
  }

  const serviceClient = createServiceRoleClient();
  const { data, error } = await fetchUserProfileAdmin(serviceClient, {
    profileId,
    email,
    tenantId,
  });
  if (error) {
    const err = new Error(error.message || 'Falha ao localizar perfil do usuario.');
    err.statusCode = 500;
    throw err;
  }

  return data ?? null;
}

export async function deleteUserProfileAdmin({ profileId = null, email = null, auditActor = null, tenantId = null }) {
  const profile = await findUserProfileAdmin({ profileId, email, tenantId });

  if (!profile) {
    return { success: false, profileDeleted: false, profile: null };
  }

  if (profileId && email && profile.user_email !== email) {
    const error = new Error('email e profileId referenciam usuarios diferentes.');
    error.statusCode = 409;
    throw error;
  }

  const serviceClient = createServiceRoleClient(auditActor);
  const { error } = await serviceClient.from('user_profiles').delete().eq('id', profile.id);

  if (error) {
    const err = new Error(error.message || 'Falha ao excluir perfil do usuario.');
    err.statusCode = 500;
    throw err;
  }

  return { success: true, profileDeleted: true, profile };
}

export function handleApiError(res, error, _context) {
  const normalizedError = normalizeApiError(error);

  console.error(
    `[admin-api][${normalizedError.code}][${normalizedError.traceId}] ${normalizedError.message}`,
    normalizedError.cause || normalizedError
  );

  return createJson(res, normalizedError.statusCode, {
    error: normalizedError.message || 'Erro interno do servidor.',
    code: normalizedError.code,
    traceId: normalizedError.traceId,
  });
}

export function sendJson(res, statusCode, payload) {
  return createJson(res, statusCode, payload);
}

export { getAuditActorFromRequester };
