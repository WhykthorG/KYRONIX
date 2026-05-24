// ┌ñÏ▒┘êÏ»┘ê┘é Ïº┘è┘å Ï»┌ñÏ▒Ï¿┘êÏºÏ¬ Ï│┌ñ┘å┘ê┘ç┌¢ Ïº┘ê┘ä┘è┘ç Whyktor GSV.
import { createServiceRoleClient, createApiError } from '../../database/supabaseAdminServer.js';
import { loadSchedulePlanningContext } from '../schedulePlannerServer.js';
import {
  SCHEDULE_GENERATION_STATUS,
  SCHEDULE_VERSION_ORIGINS,
} from '../../../../shared/src/contracts/schedulePlanner.js';

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

export function isMissingEnterpriseTableError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42P01'
    || code === 'PGRST205'
    || message.includes('does not exist')
    || message.includes('could not find the table')
    || (message.includes('relation') && message.includes('does not exist'));
}

export async function getNextVersionNumber(client, settingId) {
  const { data, error } = await client
    .from('schedule_versions')
    .select('version_number')
    .eq('setting_id', settingId)
    .order('version_number', { ascending: false })
    .limit(1);

  if (error) {
    throw createApiError(error.message || 'Falha ao calcular o próximo número da versão.', {
      statusCode: 500,
      code: 'SCHEDULE_VERSION_NUMBER_FAILED',
      cause: error,
    });
  }

  return Number(data?.[0]?.version_number || 0) + 1;
}

export async function createVersionSnapshot({
  client,
  actor,
  settingId,
  generationId,
  versionNumber,
  origin = SCHEDULE_VERSION_ORIGINS.AUTOMATICA,
  title,
  summary,
  score,
  metadata = {},
  snapshot = {},
  isActive = false,
  publishedAt = null,
  publishedBy = null,
  restoredFromVersionId = null,
}) {
  const { data, error } = await client
    .from('schedule_versions')
    .insert({
      setting_id: settingId,
      generation_id: generationId,
      version_number: versionNumber,
      origin,
      status: isActive ? 'ativa' : 'rascunho',
      title,
      snapshot: cloneJson(snapshot),
      summary: cloneJson(summary),
      score: cloneJson(score),
      metadata: cloneJson(metadata),
      is_active: isActive,
      published_at: publishedAt,
      published_by: publishedBy,
      restored_from_version_id: restoredFromVersionId,
      created_by: actor?.actor_user_id || null,
      updated_by: actor?.actor_user_id || null,
    })
    .select('*')
    .single();

  if (error) {
    if (isMissingEnterpriseTableError(error)) {
      return null;
    }
    throw createApiError(error.message || 'Falha ao criar versão da grade.', {
      statusCode: 500,
      code: 'SCHEDULE_VERSION_CREATE_FAILED',
      cause: error,
    });
  }

  return data;
}

export async function deactivateOtherVersions(client, settingId, currentVersionId) {
  const { error } = await client
    .from('schedule_versions')
    .update({ is_active: false, status: 'arquivada' })
    .eq('setting_id', settingId)
    .neq('id', currentVersionId)
    .is('deleted_at', null);

  if (error) {
    if (isMissingEnterpriseTableError(error)) {
      return;
    }
    throw createApiError(error.message || 'Falha ao desativar versões anteriores.', {
      statusCode: 500,
      code: 'SCHEDULE_VERSION_DEACTIVATE_FAILED',
      cause: error,
    });
  }
}

export async function createGenerationRun({
  client,
  settingId,
  generationId = null,
  requesterId,
  traceId,
}) {
  const { data, error } = await client
    .from('schedule_generation_runs')
    .insert({
      setting_id: settingId,
      generation_id: generationId,
      status: 'RUNNING',
      stage: 'validation',
      progress: 0,
      requested_by: requesterId,
      trace_id: traceId,
      started_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    if (isMissingEnterpriseTableError(error)) {
      return null;
    }
    throw createApiError(error.message || 'Falha ao iniciar run de geração.', {
      statusCode: 500,
      code: 'SCHEDULE_GENERATION_RUN_CREATE_FAILED',
      cause: error,
    });
  }

  return data;
}

export async function updateGenerationRun(client, runId, patch) {
  if (!runId) {
    return;
  }

  const { error } = await client
    .from('schedule_generation_runs')
    .update({
      ...patch,
      ...(patch.status ? { status: String(patch.status).toUpperCase() } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', runId);

  if (error) {
    if (isMissingEnterpriseTableError(error)) {
      return;
    }
    throw createApiError(error.message || 'Falha ao atualizar run de geração.', {
      statusCode: 500,
      code: 'SCHEDULE_GENERATION_RUN_UPDATE_FAILED',
      cause: error,
    });
  }
}

export async function saveRunMetric(client, runId, metricKey, metricValue, payload = {}) {
  if (!runId) {
    return;
  }

  const { error } = await client
    .from('schedule_run_metrics')
    .upsert({
      run_id: runId,
      metric_key: metricKey,
      metric_value: metricValue,
      payload,
    }, { onConflict: 'run_id,metric_key' });

  if (error) {
    if (isMissingEnterpriseTableError(error)) {
      return;
    }
    throw createApiError(error.message || 'Falha ao salvar métrica da geração.', {
      statusCode: 500,
      code: 'SCHEDULE_RUN_METRIC_SAVE_FAILED',
      cause: error,
    });
  }
}

export async function logScheduleChange(client, row) {
  const { error } = await client
    .from('schedule_change_log')
    .insert(row);

  if (error) {
    if (isMissingEnterpriseTableError(error)) {
      return;
    }
    throw createApiError(error.message || 'Falha ao registrar alteração de grade.', {
      statusCode: 500,
      code: 'SCHEDULE_CHANGE_LOG_FAILED',
      cause: error,
    });
  }
}

export async function loadPlannerContextForSetting(settingId, actor = null) {
  return loadSchedulePlanningContext({ settingId, actor });
}

export async function activateVersion(client, versionId, settingId) {
  if (!versionId) {
    return;
  }

  const { error } = await client
    .from('schedule_versions')
    .update({ is_active: true, status: 'ativa', updated_by: null })
    .eq('id', versionId)
    .eq('setting_id', settingId);

  if (error) {
    if (isMissingEnterpriseTableError(error)) {
      return;
    }
    throw createApiError(error.message || 'Falha ao ativar versão.', {
      statusCode: 500,
      code: 'SCHEDULE_VERSION_ACTIVATE_FAILED',
      cause: error,
    });
  }
}

export async function restoreVersionSnapshot(client, versionId, settingId) {
  let query = client
    .from('schedule_versions')
    .select('*')
    .eq('id', versionId);

  if (settingId) {
    query = query.eq('setting_id', settingId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    if (isMissingEnterpriseTableError(error)) {
      return null;
    }
    throw createApiError(error.message || 'Falha ao localizar versão.', {
      statusCode: 500,
      code: 'SCHEDULE_VERSION_LOAD_FAILED',
      cause: error,
    });
  }

  if (!data?.id) {
    throw createApiError('Versão não encontrada.', {
      statusCode: 404,
      code: 'SCHEDULE_VERSION_NOT_FOUND',
    });
  }

  return data;
}

export async function markGenerationStatus(client, generationId, status, summary = {}, qualityScore = 0, validationReport = {}) {
  const dbStatus = (
    status === SCHEDULE_GENERATION_STATUS.PARTIALLY_COMPLETED
      ? 'concluida_com_pendencias'
      : status === SCHEDULE_GENERATION_STATUS.FAILED_VALIDATION || status === SCHEDULE_GENERATION_STATUS.FAILED_GENERATION
        ? 'falhou'
        : status
  );

  const patch = {
    status: dbStatus,
    finished_at: new Date().toISOString(),
    validation_report: validationReport,
    summary,
    quality_score: qualityScore,
  };

  if (status === SCHEDULE_GENERATION_STATUS.PROCESSING) {
    patch.started_at = new Date().toISOString();
    patch.finished_at = null;
  }

  const { error } = await client
    .from('schedule_generations')
    .update(patch)
    .eq('id', generationId);

  if (error) {
    if (isMissingEnterpriseTableError(error)) {
      return;
    }
    throw createApiError(error.message || 'Falha ao atualizar geração.', {
      statusCode: 500,
      code: 'SCHEDULE_GENERATION_UPDATE_FAILED',
      cause: error,
    });
  }
}

export function buildVersionTitle(generation) {
  const label = generation?.generation_mode === 'assistido'
    ? 'Assistida'
    : generation?.generation_mode === 'manual'
      ? 'Manual'
      : 'Automática';

  return `Versão ${generation?.version_number || ''} - ${label}`.trim();
}

export function createPlannerClient(actor) {
  return createServiceRoleClient(actor);
}
