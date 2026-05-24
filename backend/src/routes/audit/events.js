import {
  createApiError,
  getAuditActorFromRequester,
  handleApiError,
  insertAuditEventLog,
  requireAuthenticatedRequest,
  sendJson,
} from '../../database/supabaseAdminServer.js';
import { enforceRequestSecurity } from '../../middlewares/requestSecurity.js';
import {
  resolveClientAuditEventRequest,
} from '../../../../shared/src/auditLog.js';
import { auditEventSchema, parseRequestSchema } from '../../middlewares/requestSchemas.js';

function normalizeRecordId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
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
      routeKey: 'api/audit/events',
      action: 'write',
      metadata: {
        entity: 'audit_events',
      },
    });

    const body = parseRequestSchema(auditEventSchema, req.body || {}, {
      code: 'AUDIT_EVENT_INVALID',
      message: 'Payload de auditoria invalido.',
    });
    const eventType = normalizeRecordId(body.eventType);

    const auditActor = getAuditActorFromRequester(requester);
    const { definition, recordId, metadata } = resolveClientAuditEventRequest({
      eventType,
      requester,
      metadata: body.metadata,
    });

    await insertAuditEventLog({
      actor: auditActor,
      eventType,
      recordId,
      newRecord: {
        event_type: eventType,
        record_id: recordId,
      },
      metadata: {
        ...metadata,
        source: metadata?.source || 'api/audit/events',
      },
    });

    return sendJson(res, 201, {
      success: true,
      eventType,
      entityTable: definition.entityTable,
      recordId,
    });
  } catch (error) {
    if (error?.statusCode === 405) {
      res.setHeader('Allow', 'POST');
    }

    return handleApiError(res, error);
  }
}
