import { randomUUID } from 'node:crypto';
import { createApiError, createServiceRoleClient, getAuditActorFromRequester, handleApiError, requirePermissionRequest, sendJson } from '../../../database/supabaseAdminServer.js';
import { PERMISSIONS } from '../../../../../shared/src/contracts/access.js';

function normalizeRows(rows = [], settingId, fields = []) {
  return rows.map((row) => {
    const payload = { setting_id: settingId };
    fields.forEach((field) => {
      if (field in row) {
        payload[field] = row[field];
      }
    });
    return payload;
  });
}

function findMissingFields(row, requiredFields) {
  return requiredFields.filter((field) => {
    const value = row?.[field];
    return value === undefined || value === null || value === '';
  });
}

export default async function handler(req, res) {
  const traceId = randomUUID();

  try {
    const requester = await requirePermissionRequest(req, PERMISSIONS.SCHEDULES_MANAGE);

    const settingId = req.body?.settingId;
    const querySettingId = req.query?.settingId || req.body?.settingId;
    const effectiveSettingId = typeof querySettingId === 'string' ? querySettingId : settingId;

    if (!effectiveSettingId) {
      throw createApiError('settingId é obrigatório para atualizar a estrutura.', {
        statusCode: 400,
        code: 'SCHEDULE_STRUCTURES_SETTING_REQUIRED',
        traceId,
      });
    }

    const actor = getAuditActorFromRequester(requester);
    const client = createServiceRoleClient(actor);
    const results = {};

    if (req.method === 'GET') {
      const [
        shiftsResult,
        environmentsResult,
        curriculumResult,
      ] = await Promise.all([
        client.from('school_shifts').select('*').eq('setting_id', effectiveSettingId).order('start_time'),
        client.from('school_environments').select('*').eq('setting_id', effectiveSettingId).order('name'),
        client.from('curriculum_matrix').select('*').eq('setting_id', effectiveSettingId).order('class_id'),
      ]);

      const failed = [shiftsResult, environmentsResult, curriculumResult].find((response) => response.error);
      if (failed?.error) {
        throw createApiError(failed.error.message || 'Falha ao carregar estrutura.', {
          statusCode: 500,
          code: 'SCHEDULE_STRUCTURES_LOAD_FAILED',
          traceId,
          cause: failed.error,
        });
      }

      return sendJson(res, 200, {
        success: true,
        data: {
          shifts: shiftsResult.data || [],
          environments: environmentsResult.data || [],
          curriculum: curriculumResult.data || [],
        },
        traceId,
      });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return sendJson(res, 405, { error: 'Metodo nao permitido.' });
    }

    if (Array.isArray(req.body?.shifts) && req.body.shifts.length > 0) {
      const missing = req.body.shifts.flatMap((row, index) => (
        findMissingFields(row, ['code', 'name', 'start_time', 'end_time']).map((field) => `shifts[${index}].${field}`)
      ));
      if (missing.length > 0) {
        throw createApiError('Preencha código, nome, início e fim antes de salvar um turno.', {
          statusCode: 400,
          code: 'SCHEDULE_SHIFTS_REQUIRED_FIELDS',
          traceId,
          details: { missingFields: missing },
        });
      }

      const payload = normalizeRows(req.body.shifts, effectiveSettingId, ['id', 'code', 'name', 'start_time', 'end_time', 'lesson_count', 'active_days', 'notes']);
      const { data, error } = await client.from('school_shifts').upsert(payload, { onConflict: 'setting_id,code' }).select('*');
      if (error) throw createApiError(error.message || 'Falha ao salvar turnos.', { statusCode: 500, code: 'SCHEDULE_SHIFTS_SAVE_FAILED', traceId, cause: error });
      results.shifts = data || [];
    }

    if (Array.isArray(req.body?.environments) && req.body.environments.length > 0) {
      const missing = req.body.environments.flatMap((row, index) => (
        findMissingFields(row, ['code', 'name']).map((field) => `environments[${index}].${field}`)
      ));
      if (missing.length > 0) {
        throw createApiError('Preencha código e nome antes de salvar um ambiente.', {
          statusCode: 400,
          code: 'SCHEDULE_ENVIRONMENTS_REQUIRED_FIELDS',
          traceId,
          details: { missingFields: missing },
        });
      }

      const payload = normalizeRows(req.body.environments, effectiveSettingId, ['id', 'code', 'name', 'environment_type', 'capacity', 'is_special', 'exclusive_per_slot', 'status', 'notes']);
      const { data, error } = await client.from('school_environments').upsert(payload, { onConflict: 'setting_id,code' }).select('*');
      if (error) throw createApiError(error.message || 'Falha ao salvar ambientes.', { statusCode: 500, code: 'SCHEDULE_ENVIRONMENTS_SAVE_FAILED', traceId, cause: error });
      results.environments = data || [];
    }

    if (Array.isArray(req.body?.curriculum) && req.body.curriculum.length > 0) {
      const missing = req.body.curriculum.flatMap((row, index) => (
        findMissingFields(row, ['class_id', 'subject_id', 'teacher_id']).map((field) => `curriculum[${index}].${field}`)
      ));
      if (missing.length > 0) {
        throw createApiError('Preencha turma, disciplina e professor antes de salvar a matriz curricular.', {
          statusCode: 400,
          code: 'SCHEDULE_CURRICULUM_REQUIRED_FIELDS',
          traceId,
          details: { missingFields: missing },
        });
      }

      const payload = normalizeRows(req.body.curriculum, effectiveSettingId, ['id', 'class_id', 'subject_id', 'teacher_id', 'shift_id', 'preferred_environment_id', 'weekly_lessons', 'requires_special_environment', 'double_lesson_preference', 'max_lessons_per_day', 'distribution_priority', 'notes']);
      const { data, error } = await client.from('curriculum_matrix').upsert(payload, { onConflict: 'setting_id,class_id,subject_id,teacher_id' }).select('*');
      if (error) throw createApiError(error.message || 'Falha ao salvar matriz curricular.', { statusCode: 500, code: 'SCHEDULE_CURRICULUM_SAVE_FAILED', traceId, cause: error });
      results.curriculum = data || [];
    }

    return sendJson(res, 200, { success: true, data: results, traceId });
  } catch (error) {
    return handleApiError(res, error);
  }
}
