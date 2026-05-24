import {
  createApiError,
  getAuditActorFromRequester,
  handleApiError,
  requireAuthenticatedRequest,
  sendJson,
} from '../../../../database/supabaseAdminServer.js';
import { enforceRequestSecurity } from '../../../../middlewares/requestSecurity.js';
import { parseRequestSchema, chatCallSignalSchema } from '../../../../middlewares/requestSchemas.js';
import { CHAT_CALL_STATUSES } from '../../../../../../shared/src/contracts/chat.js';
import { resolveCallAccess } from '../../../../services/chatServer.js';

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
      routeKey: 'api/chat/calls/signals',
      action: 'write',
      metadata: { entity: 'chat_call_signals' },
    });

    const payload = parseRequestSchema(chatCallSignalSchema, req.body || {}, {
      code: 'CHAT_CALL_SIGNAL_INVALID',
      message: 'Payload de sinalizacao invalido.',
    });

    const callId = req.query.callId;
    const { serviceClient, callSession, participantEmails } = await resolveCallAccess({
      requester,
      callId,
      requiredStatuses: [CHAT_CALL_STATUSES.RINGING, CHAT_CALL_STATUSES.ACTIVE],
      actor: getAuditActorFromRequester(requester),
      route: 'api/chat/calls/signals',
    });

    if (!participantEmails.includes(payload.recipientEmail)) {
      throw createApiError('Destino da sinalizacao nao participa da chamada.', {
        statusCode: 403,
        code: 'CHAT_CALL_SIGNAL_RECIPIENT_FORBIDDEN',
      });
    }

    const { data, error } = await serviceClient
      .from('chat_call_signals')
      .insert({
        call_session_id: callId,
        conversation_id: callSession.conversation_id,
        sender_email: requester.user.email,
        recipient_email: payload.recipientEmail,
        signal_type: payload.signalType,
        payload: payload.payload,
      })
      .select('*')
      .single();

    if (error || !data?.id) {
      throw createApiError(error?.message || 'Falha ao registrar sinal da chamada.', {
        statusCode: 500,
        code: 'CHAT_CALL_SIGNAL_CREATE_FAILED',
        cause: error || null,
      });
    }

    return sendJson(res, 201, { signal: data });
  } catch (error) {
    if (error?.statusCode === 405) {
      res.setHeader('Allow', 'POST');
    }

    return handleApiError(res, error, { req });
  }
}
