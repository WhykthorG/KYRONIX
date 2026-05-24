// Bu proje tamamen Whykthor GSV taraf─▒ndan yap─▒lm─▒┼ƒt─▒r.
import { randomUUID } from 'node:crypto';
import { createApiError, handleApiError, requirePermissionRequest, sendJson } from '../../../database/supabaseAdminServer.js';
import { PERMISSIONS } from '../../../../../shared/src/contracts/access.js';
import { createPlannerClient, restoreVersionSnapshot, deactivateOtherVersions, activateVersion, logScheduleChange } from '../../../services/schedule-planner/service.js';
import { getAuditActorFromRequester } from '../../../database/supabaseAdminServer.js';

export default async function handler(req, res) {
  const traceId = randomUUID();

  try {
    const requester = await requirePermissionRequest(req, PERMISSIONS.SCHEDULES_PUBLISH);

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { error: 'Metodo nao permitido.' });
    }

    const versionId = req.body?.versionId;
    if (!versionId) {
      throw createApiError('versionId é obrigatório para publicar.', {
        statusCode: 400,
        code: 'SCHEDULE_PUBLISH_VERSION_REQUIRED',
        traceId,
      });
    }

    const actor = getAuditActorFromRequester(requester);
    const client = createPlannerClient(actor);
    const version = await restoreVersionSnapshot(client, versionId, req.body?.settingId || null);

    const { error } = await client.from('schedule_publications').insert({
      setting_id: version.setting_id,
      version_id: version.id,
      generation_id: version.generation_id,
      status: 'publicada',
      notes: req.body?.notes || null,
      published_at: new Date().toISOString(),
      published_by: requester.user.id,
      created_by: requester.user.id,
      updated_by: requester.user.id,
    });

    if (error) {
      throw createApiError(error.message || 'Falha ao publicar versão.', {
        statusCode: 500,
        code: 'SCHEDULE_PUBLICATION_FAILED',
        traceId,
        cause: error,
      });
    }

    await deactivateOtherVersions(client, version.setting_id, version.id);
    await activateVersion(client, version.id, version.setting_id);

    await client
      .from('schedule_versions')
      .update({
        status: 'publicada',
        is_active: true,
        published_at: new Date().toISOString(),
        published_by: requester.user.id,
      })
      .eq('id', version.id);

    await logScheduleChange(client, {
      setting_id: version.setting_id,
      generation_id: version.generation_id,
      version_id: version.id,
      entity_table: 'schedule_versions',
      entity_id: version.id,
      action: 'publish',
      before_state: version,
      after_state: { ...version, status: 'publicada', is_active: true },
      reason: req.body?.reason || 'Publicação de versão',
      created_by: requester.user.id,
    });

    return sendJson(res, 200, { success: true, versionId: version.id, traceId });
  } catch (error) {
    return handleApiError(res, error);
  }
}
