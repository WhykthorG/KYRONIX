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
  normalizeTccPayload,
  buildTccMutationInput,
  canDefenseTcc,
} from '../../../../shared/src/contracts/tcc.js';

export default async function handler(req, res) {
  const traceId = randomUUID();
  try {
    const requester = await requirePermissionRequest(req, PERMISSIONS.TCC_READ);
    await enforceRequestSecurity({
      req,
      requester,
      routeKey: 'api/admin/tcc-projects',
      action: req.method === 'GET' ? 'read' : 'write',
      metadata: { entity: 'tcc_projects' },
    });

    const serviceClient = createServiceRoleClient(getAuditActorFromRequester(requester));

    if (req.method === 'GET') {
      const { status, advisor_id, class_id } = req.query || {};

      let query = serviceClient
        .from('tcc_projects')
        .select(`
          *,
          advisor:teachers!tcc_projects_advisor_id_fkey(id, name),
          co_advisor:teachers!tcc_projects_co_advisor_id_fkey(id, name),
          members:tcc_members(*, student:students(id, name, email))
        `)
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);
      if (advisor_id) query = query.eq('advisor_id', advisor_id);
      if (class_id) query = query.eq('class_id', class_id);

      const { data, error } = await query;

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'TCC_FETCH_FAILED',
        });
      }

      return sendJson(res, 200, { tccProjects: data, traceId });
    }

    if (req.method === 'POST') {
      const requesterWithWrite = await requirePermissionRequest(req, PERMISSIONS.TCC_WRITE);

      const input = buildTccMutationInput(req.body || {});

      const { data, error } = await serviceClient
        .from('tcc_projects')
        .insert({
          title: input.title,
          theme: input.theme,
          description: input.description,
          advisor_id: input.advisor_id,
          co_advisor_id: input.co_advisor_id,
          class_id: input.class_id,
          subject_id: input.subject_id,
          start_date: input.start_date,
          expected_end_date: input.expected_end_date,
          status: input.status,
          phase: input.phase,
          keywords: input.keywords,
          objectives: input.objectives,
          methodology: input.methodology,
          attachment_urls: input.attachment_urls,
        })
        .select()
        .single();

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'TCC_CREATE_FAILED',
        });
      }

      if (input.student_ids && input.student_ids.length > 0) {
        const members = input.student_ids.map((studentId, index) => ({
          tcc_id: data.id,
          student_id: studentId,
          role: index === 0 ? 'lider' : 'membro',
        }));

        await serviceClient.from('tcc_members').insert(members);
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requesterWithWrite),
        action: AUDIT_ACTIONS.CREATE,
        entityTable: 'tcc_projects',
        recordId: data.id,
        newRecord: data,
        metadata: { source: 'api/admin/tcc-projects', trace_id: traceId },
      });

      return sendJson(res, 201, { tccProject: data, traceId });
    }

    if (req.method === 'PUT') {
      const requesterWithWrite = await requirePermissionRequest(req, PERMISSIONS.TCC_WRITE);

      const id = req.query?.id || req.body?.id;
      if (!id) {
        throw createApiError('ID do TCC é obrigatório.', {
          statusCode: 400,
          code: 'TCC_ID_REQUIRED',
        });
      }

      const input = normalizeTccPayload(req.body || {});

      const { data: existing } = await serviceClient
        .from('tcc_projects')
        .select('status')
        .eq('id', id)
        .single();

      if (input.status && existing) {
        const profileType = requester?.profile?.profile_type;
        if (input.status === 'em_avaliacao' && !canDefenseTcc(existing, profileType)) {
          throw createApiError('Não é possível enviar este TCC para avaliação.', {
            statusCode: 403,
            code: 'TCC_DEFENSE_DENIED',
          });
        }
      }

      const { data, error } = await serviceClient
        .from('tcc_projects')
        .update({
          title: input.title,
          theme: input.theme,
          description: input.description,
          advisor_id: input.advisor_id,
          co_advisor_id: input.co_advisor_id,
          class_id: input.class_id,
          subject_id: input.subject_id,
          start_date: input.start_date,
          expected_end_date: input.expected_end_date,
          defense_date: input.defense_date,
          status: input.status,
          phase: input.phase,
          final_grade: input.final_grade,
          advisor_notes: input.advisor_notes,
          keywords: input.keywords,
          objectives: input.objectives,
          methodology: input.methodology,
          results: input.results,
          conclusion: input.conclusion,
          attachment_urls: input.attachment_urls,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'TCC_UPDATE_FAILED',
        });
      }

      if (input.student_ids) {
        await serviceClient.from('tcc_members').delete().eq('tcc_id', id);
        if (input.student_ids.length > 0) {
          const members = input.student_ids.map((studentId, index) => ({
            tcc_id: id,
            student_id: studentId,
            role: index === 0 ? 'lider' : 'membro',
          }));
          await serviceClient.from('tcc_members').insert(members);
        }
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requesterWithWrite),
        action: AUDIT_ACTIONS.UPDATE,
        entityTable: 'tcc_projects',
        recordId: id,
        newRecord: data,
        metadata: { source: 'api/admin/tcc-projects', trace_id: traceId },
      });

      return sendJson(res, 200, { tccProject: data, traceId });
    }

    if (req.method === 'DELETE') {
      const requesterWithWrite = await requirePermissionRequest(req, PERMISSIONS.TCC_WRITE);

      const id = req.query?.id;
      if (!id) {
        throw createApiError('ID do TCC é obrigatório.', {
          statusCode: 400,
          code: 'TCC_ID_REQUIRED',
        });
      }

      const { error } = await serviceClient
        .from('tcc_projects')
        .delete()
        .eq('id', id);

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'TCC_DELETE_FAILED',
        });
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requesterWithWrite),
        action: AUDIT_ACTIONS.DELETE,
        entityTable: 'tcc_projects',
        recordId: id,
        metadata: { source: 'api/admin/tcc-projects', trace_id: traceId },
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
