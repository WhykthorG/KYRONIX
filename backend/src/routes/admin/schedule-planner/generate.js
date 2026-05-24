import { randomUUID } from 'node:crypto';
import { generateSchoolSchedule } from '../../../../../shared/src/scheduling/engine.js';
import { createApiError, getAuditActorFromRequester, handleApiError, requirePermissionRequest, sendJson } from '../../../database/supabaseAdminServer.js';
import { enforceRequestSecurity } from '../../../middlewares/requestSecurity.js';
import { PERMISSIONS } from '../../../../../shared/src/contracts/access.js';
import { SCHEDULE_GENERATION_STATUS, SCHEDULE_VERSION_ORIGINS } from '../../../../../shared/src/contracts/schedulePlanner.js';
import { parseRequestSchema, schedulePlannerGenerateSchema } from '../../../middlewares/requestSchemas.js';
import {
  activateVersion,
  buildVersionTitle,
  createGenerationRun,
  createPlannerClient,
  createVersionSnapshot,
  getNextVersionNumber,
  isMissingEnterpriseTableError,
  loadPlannerContextForSetting,
  markGenerationStatus,
  saveRunMetric,
  updateGenerationRun,
} from '../../../services/schedule-planner/service.js';

export default async function handler(req, res) {
  const traceId = randomUUID();

  try {
    const requester = await requirePermissionRequest(req, PERMISSIONS.SCHEDULES_MANAGE);
    await enforceRequestSecurity({
      req,
      requester,
      routeKey: 'api/admin/schedule-planner/generate',
      action: 'critical',
      metadata: {
        entity: 'schedule_generations',
      },
    });

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { error: 'Metodo nao permitido.' });
    }

    const body = parseRequestSchema(schedulePlannerGenerateSchema, req.body || {}, {
      code: 'SCHEDULE_GENERATION_INVALID',
      message: 'settingId é obrigatório para gerar a grade.',
    });
    const settingId = body.settingId;

    const actor = getAuditActorFromRequester(requester);
    const client = createPlannerClient(actor);

    const context = await loadPlannerContextForSetting(settingId, actor);
    const result = generateSchoolSchedule(context);
    let generation = null;
    let run = null;
    let version = null;
    let versionNumber = 1;
    let persisted = false;
    const warnings = [...(context.warnings || [])];

    const { data: generationData, error: generationError } = await client
      .from('schedule_generations')
      .insert({
        setting_id: settingId,
        status: SCHEDULE_GENERATION_STATUS.PROCESSING,
        requested_by: requester.user.id,
        started_at: new Date().toISOString(),
        generation_mode: req.body?.generationMode || 'automatico',
        validation_report: {},
        summary: {},
      })
      .select('*')
      .single();

    if (generationError || !generationData?.id) {
      warnings.push({
        code: 'SCHEDULE_GENERATION_CREATE_FAILED',
        message: generationError?.message || 'Falha ao iniciar a geração do horário.',
      });
    } else {
      generation = generationData;
      run = await createGenerationRun({
        client,
        settingId,
        generationId: generation.id,
        requesterId: requester.user.id,
        traceId,
      });

      try {
        await updateGenerationRun(client, run?.id, { stage: 'context-load', progress: 15 });
      } catch (updateError) {
        warnings.push({
          code: 'SCHEDULE_GENERATION_RUN_UPDATE_FAILED',
          message: updateError?.message || 'Falha ao atualizar o run da geração.',
        });
      }
    }

    const entries = generation ? (result.entries || []).map((entry) => ({
      ...entry,
      generation_id: generation.id,
    })) : [];
    const conflicts = generation ? (result.conflicts || []).map((conflict) => ({
      ...conflict,
      generation_id: generation.id,
    })) : [];
    const suggestions = generation ? (result.suggestions || []).map((suggestion) => ({
      ...suggestion,
      generation_id: generation.id,
    })) : [];

    if (generation?.id) {
      try {
        await updateGenerationRun(client, run?.id, { stage: 'generation', progress: 35 });

        if (entries.length > 0) {
          const { error } = await client.from('schedule_entries').insert(entries);
          if (error) {
            throw createApiError(error.message || 'Falha ao salvar entradas da grade.', {
              statusCode: 500,
              code: 'SCHEDULE_GENERATION_ENTRIES_SAVE_FAILED',
              traceId,
              cause: error,
            });
          }
        }

        if (conflicts.length > 0) {
          const { error } = await client.from('schedule_conflicts').insert(conflicts);
          if (error) {
            throw createApiError(error.message || 'Falha ao salvar pendências da grade.', {
              statusCode: 500,
              code: 'SCHEDULE_GENERATION_CONFLICTS_SAVE_FAILED',
              traceId,
              cause: error,
            });
          }
        }

        if (suggestions.length > 0) {
          const { error } = await client.from('schedule_suggestions').insert(suggestions);
          if (error) {
            throw createApiError(error.message || 'Falha ao salvar sugestões da grade.', {
              statusCode: 500,
              code: 'SCHEDULE_GENERATION_SUGGESTIONS_SAVE_FAILED',
              traceId,
              cause: error,
            });
          }
        }

        await updateGenerationRun(client, run?.id, { stage: 'versioning', progress: 75 });

        try {
          versionNumber = await getNextVersionNumber(client, settingId);
        } catch (versionNumberError) {
          if (!isMissingEnterpriseTableError(versionNumberError)) {
            throw versionNumberError;
          }
        }

        version = await createVersionSnapshot({
          client,
          actor,
          settingId,
          generationId: generation.id,
          versionNumber,
          origin: SCHEDULE_VERSION_ORIGINS.AUTOMATICA,
          title: buildVersionTitle({ ...generation, version_number: versionNumber }),
          summary: result.summary,
          score: {
            quality_score: result.qualityScore,
            metrics: result.metrics,
          },
          metadata: {
            traceId,
            generation_mode: generation.generation_mode,
            autoFixes: result.autoFixes,
            unallocated: result.unallocated,
          },
          snapshot: {
            entries,
            conflicts,
            suggestions,
            validation: result.validation,
            justification: result.justification,
          },
          isActive: true,
        });

        if (version?.id) {
          await activateVersion(client, version.id, settingId);
        }

        await saveRunMetric(client, run?.id, 'final_score', result.metrics.final_score, { metrics: result.metrics });
        await saveRunMetric(client, run?.id, 'allocated_lessons', entries.length, { entries: entries.length });
        await saveRunMetric(client, run?.id, 'open_conflicts', result.summary.openConflicts, { conflicts: conflicts.length });

        await markGenerationStatus(
          client,
          generation.id,
          result.status || SCHEDULE_GENERATION_STATUS.COMPLETED,
          {
            ...result.summary,
            versionId: version.id,
            versionNumber,
            traceId,
          },
          result.qualityScore,
          result.validation,
        );

        await updateGenerationRun(client, run?.id, {
          status: 'COMPLETED',
          stage: 'done',
          progress: 100,
          finished_at: new Date().toISOString(),
        });

        persisted = true;
      } catch (postProcessError) {
        warnings.push({
          code: postProcessError?.code || 'SCHEDULE_GENERATION_POST_PROCESS_FAILED',
          message: postProcessError?.message || 'Falha ao salvar a geração.',
        });
        console.warn('[api/admin/schedule-planner/generate] post-processing failed', {
          traceId,
          settingId,
          generationId: generation.id,
          error: postProcessError?.message || postProcessError,
        });
      }
    } else {
      warnings.push({
        code: 'SCHEDULE_GENERATION_PERSISTENCE_SKIPPED',
        message: 'A geração foi calculada, mas não foi persistida no banco.',
      });
    }

    return sendJson(res, 200, {
      success: true,
      generationId: generation?.id || null,
      versionId: version?.id || null,
      persisted,
      warnings,
      result,
      traceId,
    });
  } catch (error) {
    return handleApiError(res, error);
  }
}
