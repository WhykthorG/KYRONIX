import {
  createApiError,
  createServiceRoleClient,
  getAuditActorFromRequester,
  handleApiError,
  requireAuthenticatedRequest,
  sendJson,
} from '../../database/supabaseAdminServer.js';
import { enforceRequestSecurity } from '../../middlewares/requestSecurity.js';
import * as chatServer from '../../services/chatServer.js';
import { parseRequestSchema, chatMediaUrlSchema } from '../../middlewares/requestSchemas.js';
import { CHAT_BUCKETS } from '../../../../shared/src/contracts/chat.js';

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
      routeKey: 'api/chat/media-url',
      action: 'write',
      metadata: { entity: 'chat_media' },
    });

    const payload = parseRequestSchema(chatMediaUrlSchema, req.body || {}, {
      code: 'CHAT_MEDIA_REQUEST_INVALID',
      message: 'Payload de media do chat invalido.',
    });

    const serviceClient = createServiceRoleClient(getAuditActorFromRequester(requester));

    if (payload.action === 'upload') {
      await chatServer.assertConversationParticipantAccess(
        serviceClient,
        payload.conversationId,
        requester.user.email,
      );
      const filePath = chatServer.buildChatMediaPath({
        conversationId: payload.conversationId,
        fileName: payload.fileName,
        bucket: payload.bucket,
      });

      const { data, error } = await serviceClient.storage
        .from(payload.bucket || CHAT_BUCKETS.VOICE)
        .createSignedUploadUrl(filePath);

      if (error || !data?.token) {
        throw createApiError(error?.message || 'Falha ao gerar URL de upload.', {
          statusCode: 500,
          code: 'CHAT_MEDIA_UPLOAD_URL_FAILED',
          cause: error || null,
        });
      }

      return sendJson(res, 200, {
        bucket: payload.bucket,
        path: filePath,
        token: data.token,
      });
    }

    const conversationId = chatServer.extractConversationIdFromPath(payload.path);
    await chatServer.assertConversationParticipantAccess(
      serviceClient,
      conversationId,
      requester.user.email,
    );

    const { data, error } = await serviceClient.storage
      .from(payload.bucket || CHAT_BUCKETS.VOICE)
      .createSignedUrl(payload.path, 3600);

    if (error || !data?.signedUrl) {
      throw createApiError(error?.message || 'Falha ao gerar URL temporaria.', {
        statusCode: 500,
        code: 'CHAT_MEDIA_DOWNLOAD_URL_FAILED',
        cause: error || null,
      });
    }

    return sendJson(res, 200, {
      bucket: payload.bucket,
      path: payload.path,
      signedUrl: data.signedUrl,
    });
  } catch (error) {
    if (error?.statusCode === 405) {
      res.setHeader('Allow', 'POST');
    }

    return handleApiError(res, error, { req });
  }
}
