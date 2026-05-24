import { randomUUID } from 'node:crypto';
import {
  buildScheduleSettingPayload,
} from '../../../../../shared/src/contracts/schedulePlanner.js';
import {
  createApiError,
  createServiceRoleClient,
  getAuditActorFromRequester,
  handleApiError,
  requirePermissionRequest,
  sendJson,
} from '../../../database/supabaseAdminServer.js';
import { PERMISSIONS } from '../../../../../shared/src/contracts/access.js';
import { DEFAULT_OPTIMIZATION_WEIGHTS } from '../../../../../shared/src/contracts/schedulePlanner.js';

export default async function handler(req, res) {
  const traceId = randomUUID();

  try {
    const requester = await requirePermissionRequest(req, PERMISSIONS.SCHEDULES_MANAGE);

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { error: 'Metodo nao permitido.' });
    }

    const payload = buildScheduleSettingPayload(req.body || {});
    const actor = getAuditActorFromRequester(requester);
    const client = createServiceRoleClient(actor);

    const { data, error } = await client
      .from('school_schedule_settings')
      .insert({
        ...payload,
        created_by: requester.user.id,
      })
      .select('*')
      .single();

    if (error || !data?.id) {
      throw createApiError(
        error?.message || 'Falha ao criar planejamento de horários.',
        {
          statusCode: 500,
          code: 'SCHEDULE_SETTINGS_CREATE_FAILED',
          traceId,
          cause: error,
        }
      );
    }

    await client.from('optimization_settings').upsert({
      setting_id: data.id,
      ...Object.entries(DEFAULT_OPTIMIZATION_WEIGHTS).reduce((acc, [key, value]) => {
        const column = key
          .replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`)
          .replace(/^_/, '');
        acc[column] = value;
        return acc;
      }, {}),
    }, { onConflict: 'setting_id' });

    const { data: ruleSet, error: ruleSetError } = await client
      .from('schedule_rule_sets')
      .upsert({
        setting_id: data.id,
        name: 'Padrão',
        description: 'Regras base do planejamento de horários.',
        status: 'ativo',
        is_default: true,
        created_by: requester.user.id,
        updated_by: requester.user.id,
      }, { onConflict: 'setting_id,name' })
      .select('*')
      .single();

    if (!ruleSetError && ruleSet?.id) {
      const weights = [
        ['teacher_unavailable', 'HARD', 100],
        ['teacher_overlap', 'HARD', 100],
        ['class_overlap', 'HARD', 100],
        ['environment_overlap', 'HARD', 100],
        ['daily_limit', 'HARD', 100],
        ['avoid_windows', 'SOFT', 8],
        ['prefer_double_lessons', 'SOFT', 6],
        ['balance_workload', 'SOFT', 7],
        ['spread_across_week', 'SOFT', 7],
      ].map(([rule_key, rule_type, weight]) => ({
        rule_set_id: ruleSet.id,
        rule_key,
        rule_type,
        weight,
        enabled: true,
        description: rule_key.replace(/_/g, ' '),
        created_by: requester.user.id,
        updated_by: requester.user.id,
      }));

      await client.from('schedule_rule_weights').upsert(weights, { onConflict: 'rule_set_id,rule_key' });
    }

    return sendJson(res, 201, {
      success: true,
      data,
      traceId,
    });
  } catch (error) {
    return handleApiError(res, error);
  }
}
