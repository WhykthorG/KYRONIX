import { randomUUID } from 'node:crypto';
import { createApiError, getAuditActorFromRequester, handleApiError, requirePermissionRequest, sendJson } from '../../../../database/supabaseAdminServer.js';
import { PERMISSIONS } from '../../../../../../shared/src/contracts/access.js';
import { SCHEDULE_VERSION_ORIGINS } from '../../../../../../shared/src/contracts/schedulePlanner.js';
import { activateVersion, createPlannerClient, createVersionSnapshot, deactivateOtherVersions, getNextVersionNumber, logScheduleChange, restoreVersionSnapshot } from '../../../../services/schedule-planner/service.js';

export default async function handler(req, res) {
  const traceId = randomUUID();

  try {
    const requester = await requirePermissionRequest(req, PERMISSIONS.SCHEDULES_MANAGE);

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { error: 'Metodo nao permitido.' });
    }

    const versionId = req.params?.id || req.query?.id;
    const action = typeof req.body?.action === 'string' ? req.body.action : '';
    if (!versionId) {
      throw createApiError('id da versão é obrigatório.', {
        statusCode: 400,
        code: 'SCHEDULE_VERSION_ID_REQUIRED',
        traceId,
      });
    }

    if (!['restore', 'publish'].includes(action)) {
      throw createApiError('Ação inválida para versão.', {
        statusCode: 400,
        code: 'SCHEDULE_VERSION_ACTION_INVALID',
        traceId,
      });
    }

    const actor = getAuditActorFromRequester(requester);
    const client = createPlannerClient(actor);
    const version = await restoreVersionSnapshot(client, versionId, req.body?.settingId || null);

    if (action === 'publish') {
      const { error: publicationError } = await client.from('schedule_publications').insert({
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

      if (publicationError) {
        throw createApiError(publicationError.message || 'Falha ao publicar versão.', {
          statusCode: 500,
          code: 'SCHEDULE_VERSION_PUBLISH_FAILED',
          traceId,
          cause: publicationError,
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

      return sendJson(res, 200, { success: true, action: 'published', versionId: version.id, traceId });
    }

    const { data: generation, error: generationError } = await client
      .from('schedule_generations')
      .insert({
        setting_id: version.setting_id,
        status: 'concluida',
        requested_by: requester.user.id,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        generation_mode: 'manual',
        validation_report: version.snapshot?.validation || {},
        summary: version.summary || {},
        quality_score: Number(version.score?.quality_score || 0),
      })
      .select('*')
      .single();

    if (generationError) {
      throw createApiError(generationError.message || 'Falha ao criar geração restaurada.', {
        statusCode: 500,
        code: 'SCHEDULE_VERSION_RESTORE_GENERATION_FAILED',
        traceId,
        cause: generationError,
      });
    }

    const entries = Array.isArray(version.snapshot?.entries) ? version.snapshot.entries : [];
    const conflicts = Array.isArray(version.snapshot?.conflicts) ? version.snapshot.conflicts : [];
    const suggestions = Array.isArray(version.snapshot?.suggestions) ? version.snapshot.suggestions : [];

    if (entries.length) {
      const { error } = await client.from('schedule_entries').insert(entries.map((entry) => ({ ...entry, generation_id: generation.id })));
      if (error) throw error;
    }
    if (conflicts.length) {
      const { error } = await client.from('schedule_conflicts').insert(conflicts.map((item) => ({ ...item, generation_id: generation.id })));
      if (error) throw error;
    }
    if (suggestions.length) {
      const { error } = await client.from('schedule_suggestions').insert(suggestions.map((item) => ({ ...item, generation_id: generation.id })));
      if (error) throw error;
    }

    const nextVersionNumber = await getNextVersionNumber(client, version.setting_id);
    const restoredVersion = await createVersionSnapshot({
      client,
      actor,
      settingId: version.setting_id,
      generationId: generation.id,
      versionNumber: nextVersionNumber,
      origin: SCHEDULE_VERSION_ORIGINS.RESTAURADA,
      title: `${version.title} - restaurada`,
      summary: version.summary,
      score: version.score,
      metadata: { restored_from: version.id, traceId },
      snapshot: version.snapshot,
      isActive: true,
      restoredFromVersionId: version.id,
    });

    await deactivateOtherVersions(client, version.setting_id, restoredVersion.id);
    await activateVersion(client, restoredVersion.id, version.setting_id);

    await logScheduleChange(client, {
      setting_id: version.setting_id,
      generation_id: generation.id,
      version_id: restoredVersion.id,
      entity_table: 'schedule_versions',
      entity_id: restoredVersion.id,
      action: 'restore',
      before_state: version,
      after_state: restoredVersion,
      reason: req.body?.reason || 'Restauração de versão',
      created_by: requester.user.id,
    });

    return sendJson(res, 200, {
      success: true,
      action: 'restored',
      versionId: restoredVersion.id,
      generationId: generation.id,
      traceId,
    });
  } catch (error) {
    return handleApiError(res, error);
  }
}
