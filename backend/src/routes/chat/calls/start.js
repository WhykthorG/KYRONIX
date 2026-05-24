// ð¡ð¢Ðì ð▒Ê»ÐéÐìÐìð│ð┤ÐìÐàÊ»Ê»ð¢ð©ð╣ð│ ð▒Ê»ÐàÐìð╗ð┤ ð¢Ðî Whyktor GSV Ê»ð╣ð╗ð┤ð▓ÐìÐÇð╗Ðìð┤Ðìð│.
import {
  createApiError,
  createServiceRoleClient,
  getAuditActorFromRequester,
  handleApiError,
  requireAuthenticatedRequest,
  sendJson,
} from '../../../database/supabaseAdminServer.js';
import { enforceRequestSecurity } from '../../../middlewares/requestSecurity.js';
import * as chatServer from '../../../services/chatServer.js';
import { parseRequestSchema, chatCallStartSchema } from '../../../middlewares/requestSchemas.js';
import { CHAT_CALL_STATUSES } from '../../../../../shared/src/contracts/chat.js';

function isMissingRelationError(error, relationName) {
  const normalizedRelationName = String(relationName || '').trim();
  const message = String(error?.message || '');

  return (
    error?.code === '42P01'
    || error?.code === 'PGRST205'
    || (normalizedRelationName && new RegExp(normalizedRelationName, 'i').test(message) && /does not exist|Could not find the table/i.test(message))
  );
}

async function findLatestLiveCallForConversation(serviceClient, conversationId, tenantId = null) {
  const normalizedConversationId = String(conversationId || '').trim().toLowerCase();
  if (!normalizedConversationId) {
    return null;
  }

  let query = serviceClient
    .from('chat_call_sessions')
    .select('*')
    .eq('conversation_id', normalizedConversationId)
    .in('status', [CHAT_CALL_STATUSES.RINGING, CHAT_CALL_STATUSES.ACTIVE])
    .order('started_at', { ascending: false })
    .limit(1);

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw createApiError(error.message || 'Falha ao localizar chamada existente.', {
      statusCode: 500,
      code: 'CHAT_CALL_EXISTING_LOOKUP_FAILED',
      cause: error,
    });
  }

  return data || null;
}

async function ensureCallParticipants(serviceClient, callId, participantEmails, requesterEmail) {
  const normalizedRequesterEmail = String(requesterEmail || '').trim().toLowerCase();
  const normalizedParticipants = [...new Set(
    (Array.isArray(participantEmails) ? participantEmails : [])
      .map((email) => String(email || '').trim().toLowerCase())
      .filter(Boolean)
  )];

  if (normalizedParticipants.length === 0) {
    return;
  }

  const { data: existingRows, error: existingError } = await serviceClient
    .from('chat_call_participants')
    .select('participant_email')
    .eq('call_session_id', callId);

  if (existingError) {
    if (isMissingRelationError(existingError, 'chat_call_participants')) {
      return;
    }

    throw createApiError(existingError.message || 'Falha ao sincronizar participantes da chamada.', {
      statusCode: 500,
      code: 'CHAT_CALL_PARTICIPANTS_LOOKUP_FAILED',
      cause: existingError,
    });
  }

  const existingParticipants = new Set(
    (existingRows || [])
      .map((row) => String(row.participant_email || '').trim().toLowerCase())
      .filter(Boolean)
  );

  const missingRows = normalizedParticipants
    .filter((email) => !existingParticipants.has(email))
    .map((email) => ({
      call_session_id: callId,
      participant_email: email,
      joined_at: email === normalizedRequesterEmail ? new Date().toISOString() : null,
      status: email === normalizedRequesterEmail ? 'joined' : 'invited',
    }));

  if (missingRows.length === 0) {
    return;
  }

  const { error: insertError } = await serviceClient
    .from('chat_call_participants')
    .insert(missingRows);

  if (insertError) {
    if (isMissingRelationError(insertError, 'chat_call_participants')) {
      return;
    }

    throw createApiError(insertError.message || 'Falha ao registrar participantes da chamada.', {
      statusCode: 500,
      code: 'CHAT_CALL_PARTICIPANTS_CREATE_FAILED',
      cause: insertError,
    });
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      throw createApiError('Metodo nao permitido.', {
        statusCode: 405,
        code: 'METHOD_NOT_ALLOWED',
      });
    }

    const requester = await requireAuthenticatedRequest(req);
    await enforceRequestSecurity({
      req,
      requester,
      routeKey: 'api/chat/calls/start',
      action: 'write',
      metadata: { entity: 'chat_call_sessions' },
    });

    const payload = parseRequestSchema(chatCallStartSchema, req.body || {}, {
      code: 'CHAT_CALL_START_INVALID',
      message: 'Payload de inicio de chamada invalido.',
    });

    const auditActor = getAuditActorFromRequester(requester);
    const serviceClient = createServiceRoleClient(auditActor);
    await chatServer.expireStaleRingingCalls({
      serviceClient,
      conversationId: payload.conversationId,
      actor: auditActor,
      route: 'api/chat/calls/start',
    });
    await chatServer.assertConversationParticipantAccess(
      serviceClient,
      payload.conversationId,
      requester.user.email,
    );

    const participantEmails = [...new Set(
      [requester.user.email, ...(payload.participantEmails || []), ...(payload.recipientEmail ? [payload.recipientEmail] : [])]
    )];

    if (participantEmails.length !== 2) {
      throw createApiError('Esta versao suporta apenas chamadas diretas 1:1.', {
        statusCode: 422,
        code: 'CHAT_CALL_ONLY_DIRECT_SUPPORTED',
      });
    }

    for (const email of participantEmails) {
      await chatServer.assertConversationParticipantAccess(serviceClient, payload.conversationId, email);
    }

    const liveCall = await findLatestLiveCallForConversation(
      serviceClient,
      payload.conversationId,
      auditActor?.actor_tenant_id || null,
    );

    if (liveCall?.id) {
      await ensureCallParticipants(serviceClient, liveCall.id, participantEmails, requester.user.email);
      return sendJson(res, 200, { call: liveCall, reused: true });
    }

    await chatServer.assertNoLiveCallConflict({
      serviceClient,
      conversationId: payload.conversationId,
      participantEmails,
      actor: auditActor,
      route: 'api/chat/calls/start',
    });

    const { data, error } = await serviceClient
      .from('chat_call_sessions')
      .insert({
        conversation_id: payload.conversationId,
        initiator_email: requester.user.email,
        recipient_email: payload.recipientEmail || participantEmails.find((email) => email !== requester.user.email) || requester.user.email,
        call_type: payload.callType,
        status: CHAT_CALL_STATUSES.RINGING,
        started_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error || !data?.id) {
      throw createApiError(error?.message || 'Falha ao iniciar chamada.', {
        statusCode: 500,
        code: 'CHAT_CALL_START_FAILED',
        cause: error || null,
      });
    }

    await ensureCallParticipants(serviceClient, data.id, participantEmails, requester.user.email);

    return sendJson(res, 201, { call: data });
  } catch (error) {
    if (error?.statusCode === 405) {
      res.setHeader('Allow', 'POST');
    }

    return handleApiError(res, error, { req });
  }
}
