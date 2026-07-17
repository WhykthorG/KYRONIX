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
  normalizeInternshipPayload,
  buildInternshipMutationInput,
  canApproveInternship,
  canCompleteInternship,
} from '../../../../shared/src/contracts/internship.js';

export default async function handler(req, res) {
  const traceId = randomUUID();
  try {
    const requester = await requirePermissionRequest(req, PERMISSIONS.INTERNSHIPS_READ);
    await enforceRequestSecurity({
      req,
      requester,
      routeKey: 'api/admin/internships',
      action: req.method === 'GET' ? 'read' : 'write',
      metadata: { entity: 'internships' },
    });

    const serviceClient = createServiceRoleClient(getAuditActorFromRequester(requester));

    if (req.method === 'GET') {
      const { status, student_id, company_id, class_id } = req.query || {};

      let query = serviceClient
        .from('internships')
        .select(`
          *,
          student:students(id, name, email, enrollment_status),
          company:internship_companies(id, name, status),
          supervisor:internship_supervisors(id, name, email),
          teacher_advisor:teachers(id, name)
        `)
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);
      if (student_id) query = query.eq('student_id', student_id);
      if (company_id) query = query.eq('company_id', company_id);
      if (class_id) query = query.eq('class_id', class_id);

      const { data, error } = await query;

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'INTERNSHIPS_FETCH_FAILED',
        });
      }

      return sendJson(res, 200, { internships: data, traceId });
    }

    if (req.method === 'POST') {
      const requesterWithWrite = await requirePermissionRequest(req, PERMISSIONS.INTERNSHIPS_WRITE);

      const input = buildInternshipMutationInput(req.body || {});

      const { data, error } = await serviceClient
        .from('internships')
        .insert(input)
        .select()
        .single();

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'INTERNSHIP_CREATE_FAILED',
        });
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requesterWithWrite),
        action: AUDIT_ACTIONS.CREATE,
        entityTable: 'internships',
        recordId: data.id,
        newRecord: data,
        metadata: { source: 'api/admin/internships', trace_id: traceId },
      });

      return sendJson(res, 201, { internship: data, traceId });
    }

    if (req.method === 'PUT') {
      const requesterWithWrite = await requirePermissionRequest(req, PERMISSIONS.INTERNSHIPS_WRITE);

      const id = req.query?.id || req.body?.id;
      if (!id) {
        throw createApiError('ID do estágio é obrigatório.', {
          statusCode: 400,
          code: 'INTERNSHIP_ID_REQUIRED',
        });
      }

      const input = normalizeInternshipPayload(req.body || {});

      const { data: existing } = await serviceClient
        .from('internships')
        .select('status')
        .eq('id', id)
        .single();

      if (input.status && existing) {
        const profileType = requester?.profile?.profile_type;
        if (input.status === 'aprovado' && !canApproveInternship(existing, profileType)) {
          throw createApiError('Não é possível aprovar este estágio.', {
            statusCode: 403,
            code: 'INTERNSHIP_APPROVAL_DENIED',
          });
        }
        if (input.status === 'concluido' && !canCompleteInternship(existing, profileType)) {
          throw createApiError('Não é possível concluir este estágio.', {
            statusCode: 403,
            code: 'INTERNSHIP_COMPLETION_DENIED',
          });
        }
      }

      const { data, error } = await serviceClient
        .from('internships')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'INTERNSHIP_UPDATE_FAILED',
        });
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requesterWithWrite),
        action: AUDIT_ACTIONS.UPDATE,
        entityTable: 'internships',
        recordId: id,
        newRecord: data,
        metadata: { source: 'api/admin/internships', trace_id: traceId },
      });

      return sendJson(res, 200, { internship: data, traceId });
    }

    if (req.method === 'DELETE') {
      const requesterWithWrite = await requirePermissionRequest(req, PERMISSIONS.INTERNSHIPS_WRITE);

      const id = req.query?.id;
      if (!id) {
        throw createApiError('ID do estágio é obrigatório.', {
          statusCode: 400,
          code: 'INTERNSHIP_ID_REQUIRED',
        });
      }

      const { error } = await serviceClient
        .from('internships')
        .delete()
        .eq('id', id);

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'INTERNSHIP_DELETE_FAILED',
        });
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requesterWithWrite),
        action: AUDIT_ACTIONS.DELETE,
        entityTable: 'internships',
        recordId: id,
        metadata: { source: 'api/admin/internships', trace_id: traceId },
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
