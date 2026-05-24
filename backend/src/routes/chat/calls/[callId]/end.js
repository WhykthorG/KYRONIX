import {
  createApiError,
  getAuditActorFromRequester,
  handleApiError,
  requireAuthenticatedRequest,
  sendJson,
} from '../../../../database/supabaseAdminServer.js';
import { enforceRequestSecurity } from '../../../../middlewares/requestSecurity.js';
import { chatCallEndSchema, parseRequestSchema } from '../../../../middlewares/requestSchemas.js';
import { CHAT_CALL_STATUSES } from '../../../../../../shared/src/contracts/chat.js';
import { markCallStatus, resolveCallAccess } from '../../../../services/chatServer.js';

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
      routeKey: 'api/chat/calls/end',
      action: 'write',
      metadata: { entity: 'chat_call_sessions' },
    });

    const callId = req.query.callId;
    const payload = parseRequestSchema(chatCallEndSchema, req.body || {}, {
      code: 'CHAT_CALL_END_INVALID',
      message: 'Payload de encerramento de chamada invalido.',
    });
    const { serviceClient } = await resolveCallAccess({
      requester,
      callId,
      requiredStatuses: [CHAT_CALL_STATUSES.RINGING, CHAT_CALL_STATUSES.ACTIVE],
      actor: getAuditActorFromRequester(requester),
      route: 'api/chat/calls/end',
    });

    const updatedCall = await markCallStatus({
      serviceClient,
      callId,
      status: payload.status || CHAT_CALL_STATUSES.ENDED,
      endedAt: new Date().toISOString(),
    });

    return sendJson(res, 200, { call: updatedCall });
  } catch (error) {
    if (error?.statusCode === 405) {
      res.setHeader('Allow', 'POST');
    }

    return handleApiError(res, error, { req });
  }
}
