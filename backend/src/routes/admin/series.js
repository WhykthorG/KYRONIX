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
  normalizeSeriesPayload,
  buildSeriesMutationInput,
} from '../../../../shared/src/contracts/course.js';

export default async function handler(req, res) {
  const traceId = randomUUID();
  try {
    const requester = await requirePermissionRequest(req, PERMISSIONS.COURSES_READ);
    await enforceRequestSecurity({
      req,
      requester,
      routeKey: 'api/admin/series',
      action: req.method === 'GET' ? 'read' : 'write',
      metadata: { entity: 'series' },
    });

    const serviceClient = createServiceRoleClient(getAuditActorFromRequester(requester));

    if (req.method === 'GET') {
      const { course_id, status } = req.query || {};

      let query = serviceClient
        .from('series')
        .select('*, course:courses(id, name, code)')
        .order('order_index');

      if (course_id) query = query.eq('course_id', course_id);
      if (status) query = query.eq('status', status);

      const { data, error } = await query;

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'SERIES_FETCH_FAILED',
        });
      }

      return sendJson(res, 200, { series: data, traceId });
    }

    if (req.method === 'POST') {
      const requesterWithWrite = await requirePermissionRequest(req, PERMISSIONS.COURSES_WRITE);

      const input = buildSeriesMutationInput(req.body || {});

      const { data, error } = await serviceClient
        .from('series')
        .insert(input)
        .select()
        .single();

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'SERIES_CREATE_FAILED',
        });
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requesterWithWrite),
        action: AUDIT_ACTIONS.CREATE,
        entityTable: 'series',
        recordId: data.id,
        newRecord: data,
        metadata: { source: 'api/admin/series', trace_id: traceId },
      });

      return sendJson(res, 201, { series: data, traceId });
    }

    if (req.method === 'PUT') {
      const requesterWithWrite = await requirePermissionRequest(req, PERMISSIONS.COURSES_WRITE);

      const id = req.query?.id || req.body?.id;
      if (!id) {
        throw createApiError('ID da série é obrigatório.', {
          statusCode: 400,
          code: 'SERIES_ID_REQUIRED',
        });
      }

      const input = normalizeSeriesPayload(req.body || {});

      const { data, error } = await serviceClient
        .from('series')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'SERIES_UPDATE_FAILED',
        });
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requesterWithWrite),
        action: AUDIT_ACTIONS.UPDATE,
        entityTable: 'series',
        recordId: id,
        newRecord: data,
        metadata: { source: 'api/admin/series', trace_id: traceId },
      });

      return sendJson(res, 200, { series: data, traceId });
    }

    if (req.method === 'DELETE') {
      const requesterWithWrite = await requirePermissionRequest(req, PERMISSIONS.COURSES_WRITE);

      const id = req.query?.id;
      if (!id) {
        throw createApiError('ID da série é obrigatório.', {
          statusCode: 400,
          code: 'SERIES_ID_REQUIRED',
        });
      }

      const { error } = await serviceClient
        .from('series')
        .delete()
        .eq('id', id);

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'SERIES_DELETE_FAILED',
        });
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requesterWithWrite),
        action: AUDIT_ACTIONS.DELETE,
        entityTable: 'series',
        recordId: id,
        metadata: { source: 'api/admin/series', trace_id: traceId },
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
