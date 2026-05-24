import {
  createApiError,
  getAuditActorFromRequester,
  handleApiError,
  insertObservabilityLog,
  requireAuthenticatedRequest,
  sendJson,
} from '../../database/supabaseAdminServer.js';
import { enforceRequestSecurity } from '../../middlewares/requestSecurity.js';
import {
  resolveClientObservabilityEventRequest,
} from '../../../../shared/src/contracts/observability.js';
import { observabilityEventSchema, parseRequestSchema } from '../../middlewares/requestSchemas.js';

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
      routeKey: 'api/observability/events',
      action: 'write',
      metadata: {
        entity: 'observability_events',
      },
    });
    const body = parseRequestSchema(observabilityEventSchema, req.body || {}, {
      code: 'OBSERVABILITY_EVENT_INVALID',
      message: 'Payload de observabilidade invalido.',
    });
    const observabilityEvent = resolveClientObservabilityEventRequest({
      eventType: body.eventType,
      requester,
      message: body.message,
      route: body.route,
      metadata: body.metadata,
      traceId: body.traceId,
    });

    await insertObservabilityLog({
      actor: getAuditActorFromRequester(requester),
      eventType: observabilityEvent.eventType,
      traceId: observabilityEvent.traceId,
      channel: observabilityEvent.channel,
      level: observabilityEvent.level,
      message: observabilityEvent.message,
      operation: observabilityEvent.operation,
      source: observabilityEvent.source,
      route: observabilityEvent.route,
      context: observabilityEvent.context,
    });

    return sendJson(res, 201, {
      success: true,
      eventType: observabilityEvent.eventType,
      traceId: observabilityEvent.traceId,
      route: observabilityEvent.route,
    });
  } catch (error) {
    if (error?.statusCode === 405) {
      res.setHeader('Allow', 'POST');
    }

    return handleApiError(res, error, {
      req,
      skipObservability: true,
    });
  }
}
