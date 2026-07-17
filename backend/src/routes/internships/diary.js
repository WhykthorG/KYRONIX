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
import { normalizeDiaryPayload } from '../../../../shared/src/contracts/internship.js';

export default async function handler(req, res) {
  const traceId = randomUUID();
  try {
    const requester = await requirePermissionRequest(req, PERMISSIONS.INTERNSHIPS_READ);
    await enforceRequestSecurity({
      req,
      requester,
      routeKey: 'api/internships/diary',
      action: req.method === 'GET' ? 'read' : 'write',
      metadata: { entity: 'internship_diary' },
    });

    const serviceClient = createServiceRoleClient(getAuditActorFromRequester(requester));

    if (req.method === 'GET') {
      const { internship_id } = req.query || {};

      let query = serviceClient
        .from('internship_diary')
        .select('*')
        .order('date', { ascending: false });

      if (internship_id) query = query.eq('internship_id', internship_id);

      const { data, error } = await query;

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'DIARY_FETCH_FAILED',
        });
      }

      return sendJson(res, 200, { diaryEntries: data, traceId });
    }

    if (req.method === 'POST') {
      const input = normalizeDiaryPayload(req.body || {});

      if (!input.internship_id) {
        throw createApiError('internship_id é obrigatório.', {
          statusCode: 400,
          code: 'DIARY_INTERNSHIP_ID_REQUIRED',
        });
      }

      if (!input.activities_performed) {
        throw createApiError('activities_performed é obrigatório.', {
          statusCode: 400,
          code: 'DIARY_ACTIVITIES_REQUIRED',
        });
      }

      const { data, error } = await serviceClient
        .from('internship_diary')
        .insert(input)
        .select()
        .single();

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'DIARY_CREATE_FAILED',
        });
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requester),
        action: AUDIT_ACTIONS.CREATE,
        entityTable: 'internship_diary',
        recordId: data.id,
        newRecord: data,
        metadata: { source: 'api/internships/diary', trace_id: traceId },
      });

      return sendJson(res, 201, { diaryEntry: data, traceId });
    }

    if (req.method === 'PUT') {
      const id = req.query?.id || req.body?.id;
      if (!id) {
        throw createApiError('ID da entrada é obrigatório.', {
          statusCode: 400,
          code: 'DIARY_ID_REQUIRED',
        });
      }

      const input = normalizeDiaryPayload(req.body || {});

      const { data, error } = await serviceClient
        .from('internship_diary')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'DIARY_UPDATE_FAILED',
        });
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requester),
        action: AUDIT_ACTIONS.UPDATE,
        entityTable: 'internship_diary',
        recordId: id,
        newRecord: data,
        metadata: { source: 'api/internships/diary', trace_id: traceId },
      });

      return sendJson(res, 200, { diaryEntry: data, traceId });
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id;
      if (!id) {
        throw createApiError('ID da entrada é obrigatório.', {
          statusCode: 400,
          code: 'DIARY_ID_REQUIRED',
        });
      }

      const { error } = await serviceClient
        .from('internship_diary')
        .delete()
        .eq('id', id);

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'DIARY_DELETE_FAILED',
        });
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requester),
        action: AUDIT_ACTIONS.DELETE,
        entityTable: 'internship_diary',
        recordId: id,
        metadata: { source: 'api/internships/diary', trace_id: traceId },
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
