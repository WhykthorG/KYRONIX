// ðæÐïð╗ ËÖð╣ð▒ðÁÐÇÊÖðÁ ÐéÐâð╗ÐïÊ╗Ðïð¢Ðüð░ Whyktor GSV ð║ð¥ð╝ð┐ð░ð¢ð©ÐÅÊ╗Ðï ðÁÐéðÁÐêÐéðÁÐÇËÖ.
import { randomUUID } from 'node:crypto';
import { computeScheduleMetrics } from '../../../../../../shared/src/scheduling/engine.js';
import { createApiError, createServiceRoleClient, getAuditActorFromRequester, handleApiError, requirePermissionRequest, sendJson } from '../../../../database/supabaseAdminServer.js';
import { PERMISSIONS } from '../../../../../../shared/src/contracts/access.js';
import { loadPlannerContextForSetting, logScheduleChange } from '../../../../services/schedule-planner/service.js';

export default async function handler(req, res) {
  const traceId = randomUUID();

  try {
    const requester = await requirePermissionRequest(req, PERMISSIONS.SCHEDULES_MANAGE);

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { error: 'Metodo nao permitido.' });
    }

    const suggestionId = req.params?.id || req.query?.id;
    if (!suggestionId) {
      throw createApiError('id da sugestão é obrigatório.', {
        statusCode: 400,
        code: 'SCHEDULE_SUGGESTION_ID_REQUIRED',
        traceId,
      });
    }

    const action = typeof req.body?.action === 'string' ? req.body.action : '';
    if (!['apply', 'reject'].includes(action)) {
      throw createApiError('Ação inválida para sugestão.', {
        statusCode: 400,
        code: 'SCHEDULE_SUGGESTION_ACTION_INVALID',
        traceId,
      });
    }

    const actor = getAuditActorFromRequester(requester);
    const client = createServiceRoleClient(actor);

    const { data: suggestion, error: suggestionError } = await client
      .from('schedule_suggestions')
      .select('*')
      .eq('id', suggestionId)
      .maybeSingle();

    if (suggestionError) {
      throw createApiError(suggestionError.message || 'Falha ao localizar sugestão.', {
        statusCode: 500,
        code: 'SCHEDULE_SUGGESTION_LOAD_FAILED',
        traceId,
        cause: suggestionError,
      });
    }

    if (!suggestion?.id) {
      throw createApiError('Sugestão não encontrada.', {
        statusCode: 404,
        code: 'SCHEDULE_SUGGESTION_NOT_FOUND',
        traceId,
      });
    }

    if (action === 'reject') {
      const { error } = await client
        .from('schedule_suggestions')
        .update({ status: 'rejeitada' })
        .eq('id', suggestionId);
      if (error) {
        throw createApiError(error.message || 'Falha ao rejeitar sugestão.', {
          statusCode: 500,
          code: 'SCHEDULE_SUGGESTION_REJECT_FAILED',
          traceId,
          cause: error,
        });
      }

      return sendJson(res, 200, { success: true, action: 'rejected', suggestionId, traceId });
    }

    const selector = suggestion.operation_payload?.selector || {};
    const target = suggestion.operation_payload?.target || {};
    const { data: generation, error: generationError } = await client
      .from('schedule_generations')
      .select('id, setting_id')
      .eq('id', suggestion.generation_id)
      .maybeSingle();

    if (generationError || !generation?.id) {
      throw createApiError(generationError?.message || 'Falha ao localizar geração.', {
        statusCode: 500,
        code: 'SCHEDULE_GENERATION_LOAD_FAILED',
        traceId,
        cause: generationError,
      });
    }

    const { data: entry, error: entryError } = await client
      .from('schedule_entries')
      .select('*')
      .eq('generation_id', generation.id)
      .match(selector)
      .maybeSingle();

    if (entryError) {
      throw createApiError(entryError.message || 'Falha ao localizar aula da sugestão.', {
        statusCode: 500,
        code: 'SCHEDULE_ENTRY_LOAD_FAILED',
        traceId,
        cause: entryError,
      });
    }

    if (!entry?.id) {
      throw createApiError('Não foi possível localizar a aula para aplicar a sugestão.', {
        statusCode: 404,
        code: 'SCHEDULE_ENTRY_NOT_FOUND',
        traceId,
      });
    }

    const updatedEntry = {
      shift_id: target.shift_id || entry.shift_id,
      day_of_week: target.day_of_week || entry.day_of_week,
      lesson_index: target.lesson_index || entry.lesson_index,
      environment_id: target.environment_id ?? entry.environment_id,
      source: 'sugestao_aplicada',
      status: 'ajustada',
    };

    const { data: previousState } = await client
      .from('schedule_entries')
      .select('*')
      .eq('id', entry.id)
      .maybeSingle();

    const { error: updateError } = await client
      .from('schedule_entries')
      .update(updatedEntry)
      .eq('id', entry.id);

    if (updateError) {
      throw createApiError(updateError.message || 'Falha ao aplicar sugestão.', {
        statusCode: 500,
        code: 'SCHEDULE_SUGGESTION_APPLY_FAILED',
        traceId,
        cause: updateError,
      });
    }

    const { error: suggestionUpdateError } = await client
      .from('schedule_suggestions')
      .update({ status: 'aplicada' })
      .eq('id', suggestionId);

    if (suggestionUpdateError) {
      throw createApiError(suggestionUpdateError.message || 'Falha ao marcar sugestão como aplicada.', {
        statusCode: 500,
        code: 'SCHEDULE_SUGGESTION_STATUS_UPDATE_FAILED',
        traceId,
        cause: suggestionUpdateError,
      });
    }

    await logScheduleChange(client, {
      setting_id: generation.setting_id,
      generation_id: generation.id,
      version_id: null,
      entity_table: 'schedule_entries',
      entity_id: entry.id,
      action: 'update',
      before_state: previousState || {},
      after_state: updatedEntry,
      reason: `Sugestão aplicada ${suggestionId}`,
      created_by: requester.user.id,
    });

    const plannerContext = await loadPlannerContextForSetting(generation.setting_id, actor);
    const generationRows = await client.from('schedule_entries').select('*').eq('generation_id', generation.id);
    const conflictRows = await client.from('schedule_conflicts').select('*').eq('generation_id', generation.id);
    const metrics = computeScheduleMetrics(generationRows.data || [], conflictRows.data || [], plannerContext);

    await client
      .from('schedule_generations')
      .update({
        quality_score: metrics.final_score,
        summary: {
          qualityScore: metrics.final_score,
          recalculated_after_suggestion: suggestionId,
          traceId,
        },
      })
      .eq('id', generation.id);

    return sendJson(res, 200, {
      success: true,
      action: 'applied',
      suggestionId,
      metrics,
      traceId,
    });
  } catch (error) {
    return handleApiError(res, error);
  }
}
