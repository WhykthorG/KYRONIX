import {
  createApiError,
  getAuditActorFromRequester,
  handleApiError,
  requireAuthenticatedRequest,
  sendJson,
} from '../../../../database/supabaseAdminServer.js';
import { enforceRequestSecurity } from '../../../../middlewares/requestSecurity.js';
import { CHAT_CALL_STATUSES } from '../../../../../../shared/src/contracts/chat.js';
import {
  assertNoLiveCallConflict,
  markCallStatus,
  resolveCallAccess,
} from '../../../../services/chatServer.js';

function isMissingRelationError(error, relationName) {
  const normalizedRelationName = String(relationName || '').trim();
  const message = String(error?.message || '');

  return (
    error?.code === '42P01'
    || error?.code === 'PGRST205'
    || (normalizedRelationName && new RegExp(normalizedRelationName, 'i').test(message) && /does not exist|Could not find the table/i.test(message))
  );
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
      routeKey: 'api/chat/calls/join',
      action: 'write',
      metadata: { entity: 'chat_call_sessions' },
    });

    const callId = req.query.callId;
    const auditActor = getAuditActorFromRequester(requester);
    const { serviceClient, callSession, participantEmails } = await resolveCallAccess({
      requester,
      callId,
      requiredStatuses: [CHAT_CALL_STATUSES.RINGING, CHAT_CALL_STATUSES.ACTIVE],
      actor: auditActor,
      route: 'api/chat/calls/join',
    });

    await assertNoLiveCallConflict({
      serviceClient,
      conversationId: callSession.conversation_id,
      participantEmails,
      excludeCallId: callSession.id,
      actor: auditActor,
      route: 'api/chat/calls/join',
    });

    const { error: participantUpdateError } = await serviceClient
      .from('chat_call_participants')
      .update({
        joined_at: new Date().toISOString(),
        status: 'joined',
      })
      .eq('call_session_id', callId)
      .eq('participant_email', requester.user.email);

    if (participantUpdateError && !isMissingRelationError(participantUpdateError, 'chat_call_participants')) {
      throw createApiError(participantUpdateError.message || 'Falha ao atualizar participante da chamada.', {
        statusCode: 500,
        code: 'CHAT_CALL_PARTICIPANT_UPDATE_FAILED',
        cause: participantUpdateError,
      });
    }

    const updatedCall = await markCallStatus({
      serviceClient,
      callId,
      status: CHAT_CALL_STATUSES.ACTIVE,
    });

    return sendJson(res, 200, { call: updatedCall });
  } catch (error) {
    if (error?.statusCode === 405) {
      res.setHeader('Allow', 'POST');
    }

    return handleApiError(res, error, { req });
  }
}
