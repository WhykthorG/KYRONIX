// ðƒÐÇð¥ðÁð║Ðé ð┐ð¥ð╗ð¢ð¥ÐüÐéÐîÐÄ ÐÇð░ðÀÐÇð░ð▒ð¥Ðéð░ð¢ ðúð©ð║Ðéð¥ÐÇð¥ð╝ ðôðíðÆ.
import {
  createApiError,
  createServiceRoleClient,
  insertObservabilityLog,
} from '../database/supabaseAdminServer.js';
import {
  CHAT_BUCKETS,
  CHAT_CALL_RINGING_TIMEOUT_MS,
  CHAT_CALL_STATUSES,
} from '../../../shared/src/contracts/chat.js';
import {
  OBSERVABILITY_EVENT_TYPES,
  OBSERVABILITY_LEVELS,
} from '../../../shared/src/contracts/observability.js';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeCallStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function isLiveCallStatus(value) {
  return [CHAT_CALL_STATUSES.RINGING, CHAT_CALL_STATUSES.ACTIVE].includes(normalizeCallStatus(value));
}

export function shouldTimeoutRingingCall(callSession, now = Date.now()) {
  if (normalizeCallStatus(callSession?.status) !== CHAT_CALL_STATUSES.RINGING) {
    return false;
  }

  const startedAt = Date.parse(callSession?.started_at || '');
  if (!Number.isFinite(startedAt)) {
    return false;
  }

  return now - startedAt > CHAT_CALL_RINGING_TIMEOUT_MS;
}

async function reportCallState({
  actor = null,
  level = OBSERVABILITY_LEVELS.WARNING,
  message,
  route = null,
  context = {},
}) {
  try {
    await insertObservabilityLog({
      actor,
      eventType: OBSERVABILITY_EVENT_TYPES.BACKEND_CALL_STATE,
      level,
      message,
      route,
      context,
    });
  } catch {
    // Never block call lifecycle if observability storage is unavailable.
  }
}

function isMissingRelationError(error, relationName) {
  const normalizedRelationName = String(relationName || '').trim();
  const message = String(error?.message || '');

  return (
    error?.code === '42P01'
    || error?.code === 'PGRST205'
    || (normalizedRelationName && new RegExp(normalizedRelationName, 'i').test(message) && /does not exist|Could not find the table/i.test(message))
  );
}

function sanitizePathSegment(value, fallback = 'media') {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._@-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  return normalized || fallback;
}

export function isConversationParticipant(conversationId, email) {
  const normalizedConversationId = String(conversationId || '').trim().toLowerCase();
  const normalizedEmail = normalizeEmail(email);
  return normalizedConversationId.split('__').includes(normalizedEmail);
}

export function getConversationParticipantEmailsFromLegacyId(conversationId) {
  return [...new Set(
    String(conversationId || '')
      .trim()
      .toLowerCase()
      .split('__')
      .map((value) => normalizeEmail(value))
      .filter((value) => value.includes('@'))
  )];
}

export async function isConversationParticipantInDatabase(serviceClient, conversationId, email) {
  const normalizedConversationId = String(conversationId || '').trim().toLowerCase();
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedConversationId || !normalizedEmail) {
    return false;
  }

  const { data, error } = await serviceClient
    .from('chat_conversation_participants')
    .select('participant_email')
    .eq('conversation_id', normalizedConversationId)
    .ilike('participant_email', normalizedEmail)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw createApiError(error.message || 'Falha ao validar participante da conversa.', {
      statusCode: 500,
      code: 'CHAT_CONVERSATION_PARTICIPANT_LOOKUP_FAILED',
      cause: error,
    });
  }

  return Boolean(data?.participant_email);
}

export async function listConversationParticipantEmails(serviceClient, conversationId) {
  const legacyParticipantEmails = getConversationParticipantEmailsFromLegacyId(conversationId);
  if (legacyParticipantEmails.length > 0) {
    return legacyParticipantEmails;
  }

  const normalizedConversationId = String(conversationId || '').trim().toLowerCase();
  if (!normalizedConversationId) {
    return [];
  }

  const { data, error } = await serviceClient
    .from('chat_conversation_participants')
    .select('participant_email')
    .eq('conversation_id', normalizedConversationId);

  if (error) {
    throw createApiError(error.message || 'Falha ao listar participantes da conversa.', {
      statusCode: 500,
      code: 'CHAT_CONVERSATION_PARTICIPANTS_LOOKUP_FAILED',
      cause: error,
    });
  }

  return [...new Set(
    (data || [])
      .map((row) => normalizeEmail(row.participant_email))
      .filter(Boolean)
  )];
}

export function buildChatMediaPath({
  conversationId,
  fileName,
  bucket = CHAT_BUCKETS.VOICE,
}) {
  const extension = String(fileName || '').includes('.')
    ? `.${String(fileName).split('.').pop().replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`
    : '';
  const baseName = extension
    ? String(fileName).slice(0, -(extension.length))
    : String(fileName || 'media');

  return [
    bucket === CHAT_BUCKETS.RECORDINGS ? 'recordings' : 'direct',
    String(conversationId || '').trim().toLowerCase(),
    `${Date.now()}-${sanitizePathSegment(baseName)}${extension}`,
  ].join('/');
}

export function assertConversationParticipant(conversationId, requesterEmail) {
  if (!isConversationParticipant(conversationId, requesterEmail)) {
    throw createApiError('Voce nao participa desta conversa.', {
      statusCode: 403,
      code: 'CHAT_CONVERSATION_FORBIDDEN',
    });
  }
}

export async function assertConversationParticipantAccess(serviceClient, conversationId, requesterEmail) {
  if (isConversationParticipant(conversationId, requesterEmail)) {
    return true;
  }

  const isParticipant = await isConversationParticipantInDatabase(
    serviceClient,
    conversationId,
    requesterEmail,
  );

  if (!isParticipant) {
    throw createApiError('Voce nao participa desta conversa.', {
      statusCode: 403,
      code: 'CHAT_CONVERSATION_FORBIDDEN',
    });
  }

  return true;
}

export async function listCallParticipantEmails(serviceClient, callSession) {
  const { data: participantRows, error: participantError } = await serviceClient
    .from('chat_call_participants')
    .select('participant_email')
    .eq('call_session_id', callSession.id);

  if (participantError && !isMissingRelationError(participantError, 'chat_call_participants')) {
    throw createApiError(participantError.message || 'Falha ao localizar participantes da chamada.', {
      statusCode: 500,
      code: 'CHAT_CALL_PARTICIPANTS_LOOKUP_FAILED',
      cause: participantError,
    });
  }

  if (!participantError) {
    const participantEmails = (participantRows || []).map((row) => normalizeEmail(row.participant_email));
    if (participantEmails.length > 0) {
      return [...new Set(participantEmails)];
    }
  }

  const conversationParticipantEmails = await listConversationParticipantEmails(
    serviceClient,
    callSession.conversation_id,
  ).catch(() => []);

  return [...new Set([
    normalizeEmail(callSession.initiator_email),
    normalizeEmail(callSession.recipient_email),
    ...conversationParticipantEmails,
  ].filter(Boolean))];
}

export async function expireStaleRingingCalls({
  serviceClient,
  conversationId = null,
  actor = null,
  route = null,
}) {
  const staleBeforeIso = new Date(Date.now() - CHAT_CALL_RINGING_TIMEOUT_MS).toISOString();
  let query = serviceClient
    .from('chat_call_sessions')
    .update({
      status: CHAT_CALL_STATUSES.MISSED,
      ended_at: new Date().toISOString(),
    })
    .eq('status', CHAT_CALL_STATUSES.RINGING)
    .lt('started_at', staleBeforeIso)
    .select('id, conversation_id, initiator_email, recipient_email, started_at');

  if (actor?.actor_tenant_id) {
    query = query.eq('tenant_id', actor.actor_tenant_id);
  }

  if (conversationId) {
    query = query.eq('conversation_id', String(conversationId || '').trim().toLowerCase());
  }

  const { data, error } = await query;

  if (error) {
    throw createApiError(error.message || 'Falha ao expirar chamadas antigas.', {
      statusCode: 500,
      code: 'CHAT_CALL_TIMEOUT_FAILED',
      cause: error,
    });
  }

  if (Array.isArray(data) && data.length > 0) {
    await reportCallState({
      actor,
      route,
      message: `${data.length} chamada(s) em ringing foram marcadas como perdidas por timeout.`,
      context: {
        call_ids: data.map((entry) => entry.id),
        conversation_id: conversationId || null,
        timeout_ms: CHAT_CALL_RINGING_TIMEOUT_MS,
      },
    });
  }

  return data || [];
}

async function resolveParticipantScopedLiveCallIds(serviceClient, participantEmails = [], tenantId = null) {
  const normalizedParticipantEmails = [...new Set(
    (Array.isArray(participantEmails) ? participantEmails : [])
      .map((email) => normalizeEmail(email))
      .filter(Boolean)
  )];

  if (normalizedParticipantEmails.length === 0) {
    return [];
  }

  let query = serviceClient
    .from('chat_call_participants')
    .select('call_session_id, participant_email')
    .in('participant_email', normalizedParticipantEmails);

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data, error } = await query;

  if (error && !isMissingRelationError(error, 'chat_call_participants')) {
    throw createApiError(error.message || 'Falha ao localizar participantes ativos de chamadas.', {
      statusCode: 500,
      code: 'CHAT_CALL_PARTICIPANTS_ACTIVE_LOOKUP_FAILED',
      cause: error,
    });
  }

  return [...new Set((data || []).map((row) => row.call_session_id).filter(Boolean))];
}

export async function assertNoLiveCallConflict({
  serviceClient,
  conversationId,
  participantEmails = [],
  excludeCallId = null,
  actor = null,
  route = null,
}) {
  const normalizedConversationId = String(conversationId || '').trim().toLowerCase();
  const normalizedParticipantEmails = [...new Set(
    (Array.isArray(participantEmails) ? participantEmails : [])
      .map((email) => normalizeEmail(email))
      .filter(Boolean)
  )];

  if (!normalizedConversationId || normalizedParticipantEmails.length === 0) {
    return null;
  }

  await expireStaleRingingCalls({
    serviceClient,
    conversationId: normalizedConversationId,
    actor,
    route,
  });

  const callIdsFromParticipants = await resolveParticipantScopedLiveCallIds(
    serviceClient,
    normalizedParticipantEmails,
    actor?.actor_tenant_id || null,
  );

  let query = serviceClient
    .from('chat_call_sessions')
    .select('*')
    .in('status', [CHAT_CALL_STATUSES.RINGING, CHAT_CALL_STATUSES.ACTIVE]);

  if (actor?.actor_tenant_id) {
    query = query.eq('tenant_id', actor.actor_tenant_id);
  }

  const { data, error } = await query;

  if (error) {
    throw createApiError(error.message || 'Falha ao validar conflitos de chamada.', {
      statusCode: 500,
      code: 'CHAT_CALL_CONFLICT_LOOKUP_FAILED',
      cause: error,
    });
  }

  const conflictingCall = (data || []).find((callSession) => {
    if (!callSession?.id || callSession.id === excludeCallId) {
      return false;
    }

    if (!isLiveCallStatus(callSession.status)) {
      return false;
    }

    const sameConversation = String(callSession.conversation_id || '').trim().toLowerCase() === normalizedConversationId;
    const directOverlap = normalizedParticipantEmails.includes(normalizeEmail(callSession.initiator_email))
      || normalizedParticipantEmails.includes(normalizeEmail(callSession.recipient_email));
    const participantTableOverlap = callIdsFromParticipants.includes(callSession.id);

    return sameConversation || directOverlap || participantTableOverlap;
  }) || null;

  if (conflictingCall) {
    const conflictMessage = conflictingCall.conversation_id === normalizedConversationId
      ? 'Ja existe uma chamada ativa ou tocando nesta conversa.'
      : 'Um dos participantes ja esta em outra chamada ativa.';

    await reportCallState({
      actor,
      route,
      message: conflictMessage,
      context: {
        conflict_call_id: conflictingCall.id,
        conflict_conversation_id: conflictingCall.conversation_id,
        requested_conversation_id: normalizedConversationId,
        participant_emails: normalizedParticipantEmails,
        conflict_status: conflictingCall.status,
      },
    });

    throw createApiError(conflictMessage, {
      statusCode: 409,
      code: 'CHAT_CALL_CONFLICT',
      details: {
        callId: conflictingCall.id,
        conversationId: conflictingCall.conversation_id,
        status: conflictingCall.status,
      },
    });
  }

  return null;
}

export function extractConversationIdFromPath(path) {
  const parts = String(path || '').split('/').filter(Boolean);
  return parts.length >= 2 ? parts[1] : null;
}

export function buildChatRecordingPath({
  callId,
  fileName,
}) {
  const extension = String(fileName || '').includes('.')
    ? `.${String(fileName).split('.').pop().replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`
    : '';
  const baseName = extension
    ? String(fileName).slice(0, -(extension.length))
    : String(fileName || 'recording');

  return [
    'recordings',
    String(callId || '').trim().toLowerCase(),
    `${Date.now()}-${sanitizePathSegment(baseName)}${extension}`,
  ].join('/');
}

export function extractCallIdFromRecordingPath(path) {
  const parts = String(path || '').split('/').filter(Boolean);
  return parts.length >= 2 ? parts[1] : null;
}

export async function resolveCallAccess({
  requester,
  callId,
  requiredStatuses = null,
  actor = null,
  route = null,
}) {
  const serviceClient = createServiceRoleClient();
  const requesterEmail = normalizeEmail(requester?.user?.email);

  const { data: callSession, error } = await serviceClient
    .from('chat_call_sessions')
    .select('*')
    .eq('id', callId)
    .maybeSingle();

  if (error) {
    throw createApiError(error.message || 'Falha ao localizar chamada.', {
      statusCode: 500,
      code: 'CHAT_CALL_LOOKUP_FAILED',
      cause: error,
    });
  }

  if (!callSession?.id) {
    throw createApiError('Chamada nao encontrada.', {
      statusCode: 404,
      code: 'CHAT_CALL_NOT_FOUND',
    });
  }

  if (shouldTimeoutRingingCall(callSession)) {
    const updatedCall = await markCallStatus({
      serviceClient,
      callId,
      status: CHAT_CALL_STATUSES.MISSED,
      endedAt: new Date().toISOString(),
    });

    await reportCallState({
      actor,
      route,
      message: 'Chamada ringing expirada automaticamente ao validar acesso.',
      context: {
        call_id: callId,
        conversation_id: updatedCall?.conversation_id || callSession.conversation_id,
        timeout_ms: CHAT_CALL_RINGING_TIMEOUT_MS,
      },
    });

    callSession.status = updatedCall?.status || CHAT_CALL_STATUSES.MISSED;
    callSession.ended_at = updatedCall?.ended_at || new Date().toISOString();
  }

  const participantEmails = await listCallParticipantEmails(serviceClient, callSession);
  const isParticipant = participantEmails.includes(requesterEmail);

  if (!isParticipant) {
    throw createApiError('Voce nao participa desta chamada.', {
      statusCode: 403,
      code: 'CHAT_CALL_FORBIDDEN',
    });
  }

  if (Array.isArray(requiredStatuses) && requiredStatuses.length > 0) {
    const normalizedStatus = String(callSession.status || '').trim().toLowerCase();
    if (!requiredStatuses.includes(normalizedStatus)) {
      throw createApiError('Estado da chamada invalido para esta operacao.', {
        statusCode: 409,
        code: 'CHAT_CALL_STATUS_INVALID',
      });
    }
  }

  return { serviceClient, callSession, participantEmails };
}

export async function markCallStatus({
  serviceClient,
  callId,
  status,
  endedAt = null,
}) {
  const nextPayload = {
    status,
  };

  if (
    [
      CHAT_CALL_STATUSES.ENDED,
      CHAT_CALL_STATUSES.MISSED,
      CHAT_CALL_STATUSES.DECLINED,
      CHAT_CALL_STATUSES.FAILED,
    ].includes(status)
  ) {
    nextPayload.ended_at = endedAt || new Date().toISOString();
  }

  const { data, error } = await serviceClient
    .from('chat_call_sessions')
    .update(nextPayload)
    .eq('id', callId)
    .select('*')
    .single();

  if (error) {
    throw createApiError(error.message || 'Falha ao atualizar a chamada.', {
      statusCode: 500,
      code: 'CHAT_CALL_UPDATE_FAILED',
      cause: error,
    });
  }

  return data;
}
