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
  normalizeCoursePayload,
  buildCourseMutationInput,
} from '../../../../shared/src/contracts/course.js';

export default async function handler(req, res) {
  const traceId = randomUUID();
  try {
    const requester = await requirePermissionRequest(req, PERMISSIONS.COURSES_READ);
    await enforceRequestSecurity({
      req,
      requester,
      routeKey: 'api/admin/courses',
      action: req.method === 'GET' ? 'read' : 'write',
      metadata: { entity: 'courses' },
    });

    const serviceClient = createServiceRoleClient(getAuditActorFromRequester(requester));

    if (req.method === 'GET') {
      const { status, include_series } = req.query || {};

      let query = serviceClient
        .from('courses')
        .select(include_series === 'true' ? '*, series(*)' : '*')
        .order('name');

      if (status) query = query.eq('status', status);

      const { data, error } = await query;

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'COURSES_FETCH_FAILED',
        });
      }

      return sendJson(res, 200, { courses: data, traceId });
    }

    if (req.method === 'POST') {
      const requesterWithWrite = await requirePermissionRequest(req, PERMISSIONS.COURSES_WRITE);

      const input = buildCourseMutationInput(req.body || {});

      const { data, error } = await serviceClient
        .from('courses')
        .insert(input)
        .select()
        .single();

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'COURSE_CREATE_FAILED',
        });
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requesterWithWrite),
        action: AUDIT_ACTIONS.CREATE,
        entityTable: 'courses',
        recordId: data.id,
        newRecord: data,
        metadata: { source: 'api/admin/courses', trace_id: traceId },
      });

      return sendJson(res, 201, { course: data, traceId });
    }

    if (req.method === 'PUT') {
      const requesterWithWrite = await requirePermissionRequest(req, PERMISSIONS.COURSES_WRITE);

      const id = req.query?.id || req.body?.id;
      if (!id) {
        throw createApiError('ID do curso é obrigatório.', {
          statusCode: 400,
          code: 'COURSE_ID_REQUIRED',
        });
      }

      const input = normalizeCoursePayload(req.body || {});

      const { data, error } = await serviceClient
        .from('courses')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'COURSE_UPDATE_FAILED',
        });
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requesterWithWrite),
        action: AUDIT_ACTIONS.UPDATE,
        entityTable: 'courses',
        recordId: id,
        newRecord: data,
        metadata: { source: 'api/admin/courses', trace_id: traceId },
      });

      return sendJson(res, 200, { course: data, traceId });
    }

    if (req.method === 'DELETE') {
      const requesterWithWrite = await requirePermissionRequest(req, PERMISSIONS.COURSES_WRITE);

      const id = req.query?.id;
      if (!id) {
        throw createApiError('ID do curso é obrigatório.', {
          statusCode: 400,
          code: 'COURSE_ID_REQUIRED',
        });
      }

      const { error } = await serviceClient
        .from('courses')
        .delete()
        .eq('id', id);

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'COURSE_DELETE_FAILED',
        });
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requesterWithWrite),
        action: AUDIT_ACTIONS.DELETE,
        entityTable: 'courses',
        recordId: id,
        metadata: { source: 'api/admin/courses', trace_id: traceId },
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
