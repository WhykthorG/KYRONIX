import { randomUUID } from 'node:crypto';
import {
  createServiceRoleClient,
  getAuditActorFromRequester,
  handleApiError,
  requirePermissionRequest,
  sendJson,
} from '../../database/supabaseAdminServer.js';
import { enforceRequestSecurity } from '../../middlewares/requestSecurity.js';
import {
  getSystemExportDataset,
  SYSTEM_EXPORT_FORMATS,
} from '../../../../shared/src/contracts/systemExport.js';
import { buildSystemJobResponseHeaders } from '../../../../shared/src/contracts/systemEvents.js';

import { PERMISSIONS } from '../../../../shared/src/contracts/access.js';
import { buildSystemExportFile } from '../../services/systemExportServer.js';
import { parseRequestSchema, systemExportQuerySchema } from '../../middlewares/requestSchemas.js';

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  try {
    const requester = await requirePermissionRequest(req, PERMISSIONS.SYSTEM_EXPORT);
    await enforceRequestSecurity({
      req,
      requester,
      routeKey: 'api/admin/system-export',
      action: 'critical',
      metadata: {
        entity: 'system_export',
      },
    });

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return sendJson(res, 405, { error: 'Metodo nao permitido.' });
    }

    if (requester.profile?.profile_type !== 'administrador') {
      return sendJson(res, 403, {
        error: 'A exportacao completa do sistema esta restrita a administradores.',
        code: 'SYSTEM_EXPORT_ADMIN_ONLY',
      });
    }

    if (requester.tenantId) {
      return sendJson(res, 403, {
        error: 'Exportacao administrativa completa esta bloqueada em modo multi-tenant ate o escopo tenant cobrir todos os datasets.',
        code: 'SYSTEM_EXPORT_MULTI_TENANT_FORBIDDEN',
      });
    }

    const query = parseRequestSchema(systemExportQuerySchema, {
      format: typeof req.query?.format === 'string'
        ? req.query.format.trim().toLowerCase()
        : SYSTEM_EXPORT_FORMATS.XLSX,
      dataset: typeof req.query?.dataset === 'string'
        ? req.query.dataset.trim()
        : '',
    }, {
      code: 'SYSTEM_EXPORT_QUERY_INVALID',
      message: 'Parametros de exportacao invalidos.',
    });

    const format = query.format;
    const datasetKey = query.dataset || '';

    if (datasetKey && !getSystemExportDataset(datasetKey)) {
      return sendJson(res, 400, { error: 'Dataset de exportacao invalido.' });
    }

    if (format === SYSTEM_EXPORT_FORMATS.CSV && !datasetKey) {
      return sendJson(res, 400, { error: 'Exportacao CSV exige um dataset especifico.' });
    }

    const auditActor = getAuditActorFromRequester(requester);
    const serviceClient = createServiceRoleClient(auditActor);
    const requestId = randomUUID();
    const exportFile = await buildSystemExportFile({
      serviceClient,
      format,
      datasetKey: datasetKey || null,
      requestedBy: requester.user.email || null,
      requestId,
    });

    res.status(200);
    res.setHeader('Content-Type', exportFile.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportFile.filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    for (const [headerName, headerValue] of Object.entries(
      buildSystemJobResponseHeaders(exportFile.job)
    )) {
      res.setHeader(headerName, headerValue);
    }
    res.end(exportFile.body);
  } catch (error) {
    return handleApiError(res, error);
  }
}
