import {
  createApiError,
  handleApiError,
  requireAuthenticatedRequest,
  sendJson,
} from '../../../../database/supabaseAdminServer.js';
import { enforceRequestSecurity } from '../../../../middlewares/requestSecurity.js';
import { parseRequestSchema, chatRecordingSchema } from '../../../../middlewares/requestSchemas.js';
import { CHAT_CALL_STATUSES } from '../../../../../../shared/src/contracts/chat.js';
import {
  buildChatRecordingPath,
  markCallStatus,
  resolveCallAccess,
} from '../../../../services/chatServer.js';

export default async function handler(req, res) {
  try {
    const requester = await requireAuthenticatedRequest(req);
    const callId = req.query.callId;

    if (req.method === 'GET') {
      await enforceRequestSecurity({
        req,
        requester,
        routeKey: 'api/chat/calls/recordings',
        action: 'read',
        metadata: { entity: 'chat_call_recordings' },
      });

      const { serviceClient } = await resolveCallAccess({ requester, callId });
      const { data, error } = await serviceClient
        .from('chat_call_recordings')
        .select('*')
        .eq('call_session_id', callId)
        .order('created_at', { ascending: false });

      if (error) {
        throw createApiError(error.message || 'Falha ao listar gravacoes da chamada.', {
          statusCode: 500,
          code: 'CHAT_CALL_RECORDINGS_LIST_FAILED',
          cause: error,
        });
      }

      return sendJson(res, 200, { recordings: data || [] });
    }

    if (req.method === 'POST') {
      await enforceRequestSecurity({
        req,
        requester,
        routeKey: 'api/chat/calls/recordings',
        action: 'write',
        metadata: { entity: 'chat_call_recordings' },
      });

      const payload = parseRequestSchema(chatRecordingSchema, req.body || {}, {
        code: 'CHAT_CALL_RECORDING_INVALID',
        message: 'Payload da gravacao invalido.',
      });

      const { serviceClient } = await resolveCallAccess({
        requester,
        callId,
        requiredStatuses: [CHAT_CALL_STATUSES.ACTIVE, CHAT_CALL_STATUSES.ENDED],
      });

      const normalizedPath = payload.path.trim() || buildChatRecordingPath({
        callId,
        fileName: 'call-recording.webm',
      });

      const { data, error } = await serviceClient
        .from('chat_call_recordings')
        .insert({
          call_session_id: callId,
          bucket: payload.bucket,
          file_path: normalizedPath,
          created_by_email: requester.user.email,
          duration_seconds: payload.durationSeconds ?? null,
        })
        .select('*')
        .single();

      if (error || !data?.id) {
        throw createApiError(error?.message || 'Falha ao registrar a gravacao da chamada.', {
          statusCode: 500,
          code: 'CHAT_CALL_RECORDING_CREATE_FAILED',
          cause: error || null,
        });
      }

      await markCallStatus({
        serviceClient,
        callId,
        status: CHAT_CALL_STATUSES.ENDED,
      }).catch(() => null);

      return sendJson(res, 201, { recording: data });
    }

    throw createApiError('Metodo nao permitido.', {
      statusCode: 405,
      code: 'METHOD_NOT_ALLOWED',
    });
  } catch (error) {
    if (error?.statusCode === 405) {
      res.setHeader('Allow', 'GET, POST');
    }

    return handleApiError(res, error, { req });
  }
}
