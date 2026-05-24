import {
  createRequestScopedClient,
  createApiError,
  handleApiError,
  requireAuthenticatedRequest,
  sendJson,
} from '../../database/supabaseAdminServer.js';
import { enforceRequestSecurity } from '../../middlewares/requestSecurity.js';
import {
  listNotificationsForRecipient,
  markAllNotificationsAsRead,
} from '../../services/notificationsServer.js';
import {
  notificationActionSchema,
  notificationsQuerySchema,
  parseRequestSchema,
} from '../../middlewares/requestSchemas.js';

export default async function handler(req, res) {
  try {
    const requester = await requireAuthenticatedRequest(req);
    const notificationClient = createRequestScopedClient(req);
    await enforceRequestSecurity({
      req,
      requester,
      routeKey: 'api/notifications',
      action: req.method === 'GET' ? 'read' : 'write',
      metadata: {
        entity: 'notifications',
      },
    });

    if (req.method === 'GET') {
      const { limit, dismissed } = parseRequestSchema(notificationsQuerySchema, {
        limit: typeof req.query?.limit === 'string' ? req.query.limit : undefined,
        dismissed: typeof req.query?.dismissed === 'string' ? req.query.dismissed : undefined,
      }, {
        code: 'NOTIFICATION_QUERY_INVALID',
        message: 'Parametros de notificacao invalidos.',
      });

      const notifications = await listNotificationsForRecipient({
        recipientEmail: requester.user.email,
        limit,
        includeDismissed: dismissed === 'true',
        client: notificationClient,
        tenantId: requester.tenantId || null,
      });

      return sendJson(res, 200, {
        data: notifications,
      });
    }

    if (req.method === 'PATCH') {
      parseRequestSchema(notificationActionSchema, req.body || {}, {
        code: 'NOTIFICATION_ACTION_INVALID',
        message: 'Acao de notificacao invalida.',
      });

      const result = await markAllNotificationsAsRead({
        recipientEmail: requester.user.email,
        client: notificationClient,
        tenantId: requester.tenantId || null,
      });

      return sendJson(res, 200, result);
    }

    throw createApiError('Metodo nao permitido.', {
      statusCode: 405,
      code: 'METHOD_NOT_ALLOWED',
    });
  } catch (error) {
    if (error?.statusCode === 405) {
      res.setHeader('Allow', 'GET, PATCH');
    }

    return handleApiError(res, error, { req });
  }
}
