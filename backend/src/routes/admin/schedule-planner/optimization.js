import { randomUUID } from 'node:crypto';
import {
  createApiError,
  createServiceRoleClient,
  getAuditActorFromRequester,
  handleApiError,
  requireAnyPermissionRequest,
  requirePermissionRequest,
  sendJson,
} from '../../../database/supabaseAdminServer.js';
import { PERMISSIONS } from '../../../../../shared/src/contracts/access.js';

function buildPayload(settingId, body = {}) {
  return {
    setting_id: settingId,
    reduce_teacher_gaps: body.reduce_teacher_gaps ?? body.reduceTeacherGaps ?? 8,
    avoid_single_lesson_days: body.avoid_single_lesson_days ?? body.avoidSingleLessonDays ?? 9,
    cluster_pedagogical_blocks: body.cluster_pedagogical_blocks ?? body.clusterPedagogicalBlocks ?? 6,
    spread_across_week: body.spread_across_week ?? body.spreadAcrossWeek ?? 7,
    avoid_daily_overload: body.avoid_daily_overload ?? body.avoidDailyOverload ?? 8,
    optimize_special_environments: body.optimize_special_environments ?? body.optimizeSpecialEnvironments ?? 5,
    minimize_intercampus_travel: body.minimize_intercampus_travel ?? body.minimizeIntercampusTravel ?? 4,
  };
}

export default async function handler(req, res) {
  const traceId = randomUUID();

  try {
    if (req.method === 'GET') {
      const requester = await requireAnyPermissionRequest(req, [PERMISSIONS.SCHEDULES_MANAGE, PERMISSIONS.SCHEDULES_RESPOND]);
      const actor = getAuditActorFromRequester(requester);
      const client = createServiceRoleClient(actor);
      const settingId = req.query?.settingId || req.body?.settingId;
      if (!settingId) {
        throw createApiError('settingId é obrigatório.', {
          statusCode: 400,
          code: 'SCHEDULE_OPTIMIZATION_SETTING_REQUIRED',
          traceId,
        });
      }

      const { data, error } = await client
        .from('optimization_settings')
        .select('*')
        .eq('setting_id', settingId)
        .maybeSingle();

      if (error) {
        throw createApiError(error.message || 'Falha ao carregar parâmetros de otimização.', {
          statusCode: 500,
          code: 'SCHEDULE_OPTIMIZATION_LOAD_FAILED',
          traceId,
          cause: error,
        });
      }

      return sendJson(res, 200, { success: true, data: data ? [data] : [], traceId });
    }

    if (req.method !== 'POST' && req.method !== 'PATCH') {
      res.setHeader('Allow', 'GET, POST, PATCH');
      return sendJson(res, 405, { error: 'Metodo nao permitido.' });
    }

    const requester = await requirePermissionRequest(req, PERMISSIONS.SCHEDULES_MANAGE);
    const actor = getAuditActorFromRequester(requester);
    const client = createServiceRoleClient(actor);

    const settingId = req.body?.settingId || req.body?.setting_id;
    if (!settingId) {
      throw createApiError('settingId é obrigatório.', {
        statusCode: 400,
        code: 'SCHEDULE_OPTIMIZATION_SETTING_REQUIRED',
        traceId,
      });
    }

    const payload = buildPayload(settingId, req.body || {});
    const { data, error } = await client
      .from('optimization_settings')
      .upsert(payload, { onConflict: 'setting_id' })
      .select('*')
      .single();

    if (error) {
      throw createApiError(error.message || 'Falha ao salvar parâmetros de otimização.', {
        statusCode: 500,
        code: 'SCHEDULE_OPTIMIZATION_SAVE_FAILED',
        traceId,
        cause: error,
      });
    }

    return sendJson(res, 200, {
      success: true,
      data,
      traceId,
    });
  } catch (error) {
    return handleApiError(res, error);
  }
}
