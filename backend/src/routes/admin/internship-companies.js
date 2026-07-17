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
  normalizeCompanyPayload,
  buildCompanyMutationInput,
} from '../../../../shared/src/contracts/internship.js';

export default async function handler(req, res) {
  const traceId = randomUUID();
  try {
    const requester = await requirePermissionRequest(req, PERMISSIONS.INTERNSHIP_COMPANIES_READ);
    await enforceRequestSecurity({
      req,
      requester,
      routeKey: 'api/admin/internship-companies',
      action: req.method === 'GET' ? 'read' : 'write',
      metadata: { entity: 'internship_companies' },
    });

    const serviceClient = createServiceRoleClient(getAuditActorFromRequester(requester));

    if (req.method === 'GET') {
      const { data, error } = await serviceClient
        .from('internship_companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'COMPANIES_FETCH_FAILED',
        });
      }

      return sendJson(res, 200, { companies: data, traceId });
    }

    if (req.method === 'POST') {
      const requesterWithWrite = await requirePermissionRequest(req, PERMISSIONS.INTERNSHIP_COMPANIES_WRITE);

      const input = buildCompanyMutationInput(req.body || {});

      const { data, error } = await serviceClient
        .from('internship_companies')
        .insert(input)
        .select()
        .single();

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'COMPANY_CREATE_FAILED',
        });
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requesterWithWrite),
        action: AUDIT_ACTIONS.CREATE,
        entityTable: 'internship_companies',
        recordId: data.id,
        newRecord: data,
        metadata: { source: 'api/admin/internship-companies', trace_id: traceId },
      });

      return sendJson(res, 201, { company: data, traceId });
    }

    if (req.method === 'PUT') {
      const requesterWithWrite = await requirePermissionRequest(req, PERMISSIONS.INTERNSHIP_COMPANIES_WRITE);

      const id = req.query?.id || req.body?.id;
      if (!id) {
        throw createApiError('ID da empresa é obrigatório.', {
          statusCode: 400,
          code: 'COMPANY_ID_REQUIRED',
        });
      }

      const input = normalizeCompanyPayload(req.body || {});

      const { data, error } = await serviceClient
        .from('internship_companies')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'COMPANY_UPDATE_FAILED',
        });
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requesterWithWrite),
        action: AUDIT_ACTIONS.UPDATE,
        entityTable: 'internship_companies',
        recordId: id,
        newRecord: data,
        metadata: { source: 'api/admin/internship-companies', trace_id: traceId },
      });

      return sendJson(res, 200, { company: data, traceId });
    }

    if (req.method === 'DELETE') {
      const requesterWithWrite = await requirePermissionRequest(req, PERMISSIONS.INTERNSHIP_COMPANIES_WRITE);

      const id = req.query?.id;
      if (!id) {
        throw createApiError('ID da empresa é obrigatório.', {
          statusCode: 400,
          code: 'COMPANY_ID_REQUIRED',
        });
      }

      const { error } = await serviceClient
        .from('internship_companies')
        .delete()
        .eq('id', id);

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'COMPANY_DELETE_FAILED',
        });
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requesterWithWrite),
        action: AUDIT_ACTIONS.DELETE,
        entityTable: 'internship_companies',
        recordId: id,
        metadata: { source: 'api/admin/internship-companies', trace_id: traceId },
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
