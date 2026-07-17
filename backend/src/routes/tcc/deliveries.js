import { randomUUID } from 'node:crypto';
import {
  createApiError,
  createServiceRoleClient,
  getAuditActorFromRequester,
  handleApiError,
  insertManualAuditLog,
  requirePermissionRequest,
  sendJson,
} from '../../database/supabaseAdminServer.js';
import { enforceRequestSecurity } from '../../middlewares/requestSecurity.js';
import { AUDIT_ACTIONS } from '../../../../shared/src/auditLog.js';
import { PERMISSIONS } from '../../../../shared/src/contracts/access.js';
import { normalizeDeliveryPayload, buildDeliveryMutationInput } from '../../../../shared/src/contracts/tcc.js';

export default async function handler(req, res) {
  const traceId = randomUUID();
  try {
    const requester = await requirePermissionRequest(req, PERMISSIONS.TCC_READ);
    await enforceRequestSecurity({
      req,
      requester,
      routeKey: 'api/tcc/deliveries',
      action: req.method === 'GET' ? 'read' : 'write',
      metadata: { entity: 'tcc_deliveries' },
    });

    const serviceClient = createServiceRoleClient(getAuditActorFromRequester(requester));

    if (req.method === 'GET') {
      const { tcc_id } = req.query || {};

      let query = serviceClient
        .from('tcc_deliveries')
        .select('*')
        .order('due_date', { ascending: false });

      if (tcc_id) query = query.eq('tcc_id', tcc_id);

      const { data, error } = await query;

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'DELIVERIES_FETCH_FAILED',
        });
      }

      return sendJson(res, 200, { deliveries: data, traceId });
    }

    if (req.method === 'POST') {
      const input = buildDeliveryMutationInput(req.body || {});

      const { data, error } = await serviceClient
        .from('tcc_deliveries')
        .insert(input)
        .select()
        .single();

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'DELIVERY_CREATE_FAILED',
        });
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requester),
        action: AUDIT_ACTIONS.CREATE,
        entityTable: 'tcc_deliveries',
        recordId: data.id,
        newRecord: data,
        metadata: { source: 'api/tcc/deliveries', trace_id: traceId },
      });

      return sendJson(res, 201, { delivery: data, traceId });
    }

    if (req.method === 'PUT') {
      const id = req.query?.id || req.body?.id;
      if (!id) {
        throw createApiError('ID da entrega é obrigatório.', {
          statusCode: 400,
          code: 'DELIVERY_ID_REQUIRED',
        });
      }

      const input = normalizeDeliveryPayload(req.body || {});

      const { data, error } = await serviceClient
        .from('tcc_deliveries')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'DELIVERY_UPDATE_FAILED',
        });
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requester),
        action: AUDIT_ACTIONS.UPDATE,
        entityTable: 'tcc_deliveries',
        recordId: id,
        newRecord: data,
        metadata: { source: 'api/tcc/deliveries', trace_id: traceId },
      });

      return sendJson(res, 200, { delivery: data, traceId });
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id;
      if (!id) {
        throw createApiError('ID da entrega é obrigatório.', {
          statusCode: 400,
          code: 'DELIVERY_ID_REQUIRED',
        });
      }

      const { error } = await serviceClient
        .from('tcc_deliveries')
        .delete()
        .eq('id', id);

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'DELIVERY_DELETE_FAILED',
        });
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requester),
        action: AUDIT_ACTIONS.DELETE,
        entityTable: 'tcc_deliveries',
        recordId: id,
        metadata: { source: 'api/tcc/deliveries', trace_id: traceId },
      });

      return sendJson(res, 200, { deleted: true, traceId });
    }

    res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return sendJson(res, 405, { error: 'Metodo nao permitido.' });
  } catch (error) {
    if (error?.statusCode === 405) {
      res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    }
    return handleApiError(res, error);
  }
}
