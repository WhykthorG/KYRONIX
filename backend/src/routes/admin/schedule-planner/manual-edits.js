import { randomUUID } from 'node:crypto';
import { createApiError, createServiceRoleClient, getAuditActorFromRequester, handleApiError, requirePermissionRequest, sendJson } from '../../../database/supabaseAdminServer.js';
import { PERMISSIONS } from '../../../../../shared/src/contracts/access.js';
import { logScheduleChange } from '../../../services/schedule-planner/service.js';

export default async function handler(req, res) {
  const traceId = randomUUID();

  try {
    const requester = await requirePermissionRequest(req, PERMISSIONS.SCHEDULES_MANAGE);

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { error: 'Metodo nao permitido.' });
    }

    const entryId = req.body?.entryId;
    const settingId = req.body?.settingId;
    const generationId = req.body?.generationId || null;
    const nextState = req.body?.nextState || {};
    const reason = req.body?.reason || 'Edição manual';

    if (!entryId || !settingId) {
      throw createApiError('entryId e settingId são obrigatórios.', {
        statusCode: 400,
        code: 'SCHEDULE_MANUAL_EDIT_INVALID',
        traceId,
      });
    }

    const actor = getAuditActorFromRequester(requester);
    const client = createServiceRoleClient(actor);
    const { data: currentEntry, error: loadError } = await client.from('schedule_entries').select('*').eq('id', entryId).maybeSingle();
    if (loadError) {
      throw createApiError(loadError.message || 'Falha ao localizar aula.', {
        statusCode: 500,
        code: 'SCHEDULE_MANUAL_EDIT_LOAD_FAILED',
        traceId,
        cause: loadError,
      });
    }
    if (!currentEntry?.id) {
      throw createApiError('Aula não encontrada.', {
        statusCode: 404,
        code: 'SCHEDULE_MANUAL_EDIT_ENTRY_NOT_FOUND',
        traceId,
      });
    }

    const beforeState = currentEntry;
    const patch = {
      shift_id: nextState.shift_id ?? currentEntry.shift_id,
      day_of_week: nextState.day_of_week ?? currentEntry.day_of_week,
      lesson_index: nextState.lesson_index ?? currentEntry.lesson_index,
      environment_id: nextState.environment_id ?? currentEntry.environment_id,
      is_locked: Boolean(nextState.is_locked ?? currentEntry.is_locked),
      source: 'manual',
      status: 'ajustada',
    };

    const { error: updateError } = await client.from('schedule_entries').update(patch).eq('id', entryId);
    if (updateError) {
      throw createApiError(updateError.message || 'Falha ao salvar edição manual.', {
        statusCode: 500,
        code: 'SCHEDULE_MANUAL_EDIT_SAVE_FAILED',
        traceId,
        cause: updateError,
      });
    }

    await client.from('schedule_manual_edits').insert({
      setting_id: settingId,
      generation_id: generationId,
      version_id: req.body?.versionId || null,
      entry_id: entryId,
      from_state: beforeState,
      to_state: patch,
      edit_reason: reason,
      edited_by: requester.user.id,
    });

    await logScheduleChange(client, {
      setting_id: settingId,
      generation_id: generationId,
      version_id: req.body?.versionId || null,
      entity_table: 'schedule_entries',
      entity_id: entryId,
      action: 'manual_edit',
      before_state: beforeState,
      after_state: patch,
      reason,
      created_by: requester.user.id,
    });

    return sendJson(res, 200, {
      success: true,
      data: { entryId, patch },
      traceId,
    });
  } catch (error) {
    return handleApiError(res, error);
  }
}
