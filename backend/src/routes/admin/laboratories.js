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
import {
  normalizeLabPayload,
  buildLabMutationInput,
} from '../../../../shared/src/contracts/laboratory.js';

export default async function handler(req, res) {
  const traceId = randomUUID();
  try {
    const requester = await requirePermissionRequest(req, PERMISSIONS.LABORATORIES_READ);
    await enforceRequestSecurity({
      req,
      requester,
      routeKey: 'api/admin/laboratories',
      action: req.method === 'GET' ? 'read' : 'write',
      metadata: { entity: 'laboratories' },
    });

    const serviceClient = createServiceRoleClient(getAuditActorFromRequester(requester));

    if (req.method === 'GET') {
      const { status } = req.query || {};

      let query = serviceClient
        .from('laboratories')
        .select('*')
        .order('name');

      if (status) query = query.eq('status', status);

      const { data, error } = await query;

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'LABORATORIES_FETCH_FAILED',
        });
      }

      return sendJson(res, 200, { laboratories: data, traceId });
    }

    if (req.method === 'POST') {
      const requesterWithWrite = await requirePermissionRequest(req, PERMISSIONS.LABORATORIES_WRITE);

      const input = buildLabMutationInput(req.body || {});

      const { data, error } = await serviceClient
        .from('laboratories')
        .insert(input)
        .select()
        .single();

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'LABORATORY_CREATE_FAILED',
        });
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requesterWithWrite),
        action: AUDIT_ACTIONS.CREATE,
        entityTable: 'laboratories',
        recordId: data.id,
        newRecord: data,
        metadata: { source: 'api/admin/laboratories', trace_id: traceId },
      });

      return sendJson(res, 201, { laboratory: data, traceId });
    }

    if (req.method === 'PUT') {
      const requesterWithWrite = await requirePermissionRequest(req, PERMISSIONS.LABORATORIES_WRITE);

      const id = req.query?.id || req.body?.id;
      if (!id) {
        throw createApiError('ID do laboratório é obrigatório.', {
          statusCode: 400,
          code: 'LABORATORY_ID_REQUIRED',
        });
      }

      const input = normalizeLabPayload(req.body || {});

      const { data, error } = await serviceClient
        .from('laboratories')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'LABORATORY_UPDATE_FAILED',
        });
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requesterWithWrite),
        action: AUDIT_ACTIONS.UPDATE,
        entityTable: 'laboratories',
        recordId: id,
        newRecord: data,
        metadata: { source: 'api/admin/laboratories', trace_id: traceId },
      });

      return sendJson(res, 200, { laboratory: data, traceId });
    }

    if (req.method === 'DELETE') {
      const requesterWithWrite = await requirePermissionRequest(req, PERMISSIONS.LABORATORIES_WRITE);

      const id = req.query?.id;
      if (!id) {
        throw createApiError('ID do laboratório é obrigatório.', {
          statusCode: 400,
          code: 'LABORATORY_ID_REQUIRED',
        });
      }

      const { error } = await serviceClient
        .from('laboratories')
        .delete()
        .eq('id', id);

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'LABORATORY_DELETE_FAILED',
        });
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requesterWithWrite),
        action: AUDIT_ACTIONS.DELETE,
        entityTable: 'laboratories',
        recordId: id,
        metadata: { source: 'api/admin/laboratories', trace_id: traceId },
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
