import {
  createRequestScopedClient,
  createApiError,
  handleApiError,
  requireAuthenticatedRequest,
  sendJson,
} from '../../database/supabaseAdminServer.js';
import {
  dismissNotification,
  markNotificationAsRead,
} from '../../services/notificationsServer.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'PATCH') {
      throw createApiError('Metodo nao permitido.', {
        statusCode: 405,
        code: 'METHOD_NOT_ALLOWED',
      });
    }

    const requester = await requireAuthenticatedRequest(req);
    const notificationClient = createRequestScopedClient(req);
    const notificationId = typeof req.query?.notificationId === 'string'
      ? req.query.notificationId
      : '';

    if (!notificationId) {
      throw createApiError('notificationId e obrigatorio.', {
        statusCode: 400,
        code: 'NOTIFICATION_ID_REQUIRED',
      });
    }

    const action = req.body?.action;

    if (action === 'mark_read') {
      const notification = await markNotificationAsRead({
        recipientEmail: requester.user.email,
        notificationId,
        client: notificationClient,
        tenantId: requester.tenantId || null,
      });

      return sendJson(res, 200, {
        success: true,
        notification,
      });
    }

    if (action === 'dismiss') {
      const notification = await dismissNotification({
        recipientEmail: requester.user.email,
        notificationId,
        client: notificationClient,
        tenantId: requester.tenantId || null,
      });

      return sendJson(res, 200, {
        success: true,
        notification,
      });
    }

    throw createApiError('Acao de notificacao invalida.', {
      statusCode: 400,
      code: 'NOTIFICATION_ACTION_INVALID',
    });
  } catch (error) {
    if (error?.statusCode === 405) {
      res.setHeader('Allow', 'PATCH');
    }

    return handleApiError(res, error, { req });
  }
}
