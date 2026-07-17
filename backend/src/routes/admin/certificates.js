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
  normalizeCertificatePayload,
  buildCertificateMutationInput,
  generateSeriesNumber,
} from '../../../../shared/src/contracts/certificate.js';

export default async function handler(req, res) {
  const traceId = randomUUID();
  try {
    const requester = await requirePermissionRequest(req, PERMISSIONS.CERTIFICATES_READ);
    await enforceRequestSecurity({
      req,
      requester,
      routeKey: 'api/admin/certificates',
      action: req.method === 'GET' ? 'read' : 'write',
      metadata: { entity: 'certificates' },
    });

    const serviceClient = createServiceRoleClient(getAuditActorFromRequester(requester));

    if (req.method === 'GET') {
      const { student_id, type, status } = req.query || {};

      let query = serviceClient
        .from('certificates')
        .select(`
          *,
          student:students(id, name, email),
          issuer:user_profiles(id, full_name)
        `)
        .order('issue_date', { ascending: false });

      if (student_id) query = query.eq('student_id', student_id);
      if (type) query = query.eq('type', type);
      if (status) query = query.eq('status', status);

      const { data, error } = await query;

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'CERTIFICATES_FETCH_FAILED',
        });
      }

      return sendJson(res, 200, { certificates: data, traceId });
    }

    if (req.method === 'POST') {
      const requesterWithWrite = await requirePermissionRequest(req, PERMISSIONS.CERTIFICATES_WRITE);

      const input = buildCertificateMutationInput(req.body || {});

      if (!input.series_number) {
        input.series_number = generateSeriesNumber();
      }

      input.issued_by = requester.profile?.id || null;

      const { data, error } = await serviceClient
        .from('certificates')
        .insert(input)
        .select()
        .single();

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'CERTIFICATE_CREATE_FAILED',
        });
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requesterWithWrite),
        action: AUDIT_ACTIONS.CREATE,
        entityTable: 'certificates',
        recordId: data.id,
        newRecord: data,
        metadata: { source: 'api/admin/certificates', trace_id: traceId },
      });

      return sendJson(res, 201, { certificate: data, traceId });
    }

    if (req.method === 'PUT') {
      const requesterWithWrite = await requirePermissionRequest(req, PERMISSIONS.CERTIFICATES_WRITE);

      const id = req.query?.id || req.body?.id;
      if (!id) {
        throw createApiError('ID do certificado é obrigatório.', {
          statusCode: 400,
          code: 'CERTIFICATE_ID_REQUIRED',
        });
      }

      const input = normalizeCertificatePayload(req.body || {});

      const { data, error } = await serviceClient
        .from('certificates')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'CERTIFICATE_UPDATE_FAILED',
        });
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requesterWithWrite),
        action: AUDIT_ACTIONS.UPDATE,
        entityTable: 'certificates',
        recordId: id,
        newRecord: data,
        metadata: { source: 'api/admin/certificates', trace_id: traceId },
      });

      return sendJson(res, 200, { certificate: data, traceId });
    }

    if (req.method === 'DELETE') {
      const requesterWithWrite = await requirePermissionRequest(req, PERMISSIONS.CERTIFICATES_WRITE);

      const id = req.query?.id;
      if (!id) {
        throw createApiError('ID do certificado é obrigatório.', {
          statusCode: 400,
          code: 'CERTIFICATE_ID_REQUIRED',
        });
      }

      const { error } = await serviceClient
        .from('certificates')
        .delete()
        .eq('id', id);

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'CERTIFICATE_DELETE_FAILED',
        });
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requesterWithWrite),
        action: AUDIT_ACTIONS.DELETE,
        entityTable: 'certificates',
        recordId: id,
        metadata: { source: 'api/admin/certificates', trace_id: traceId },
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
