// ðƒÐÇð¥ðÁð║Ðé ð┐ð¥ð╗ð¢ð¥ÐüÐéÐîÐÄ ÐÇð░ðÀÐÇð░ð▒ð¥Ðéð░ð¢ ðúð©ð║Ðéð¥ÐÇð¥ð╝ ðôðíðÆ.
import { createApiError, createServiceRoleClient } from '../database/supabaseAdminServer.js';
import { createAvailabilityMatrix, DEFAULT_OPTIMIZATION_WEIGHTS, SCHEDULE_FORM_STATUS } from '../../../shared/src/contracts/schedulePlanner.js';

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function isMissingEnterpriseTableError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42P01'
    || code === 'PGRST205'
    || message.includes('does not exist')
    || message.includes('could not find the table')
    || message.includes('relation') && message.includes('does not exist');
}

async function runOptionalQuery(queryPromise, fallbackValue, warnings, warningCode) {
  try {
    const { data, error } = await queryPromise;

    if (error) {
      warnings?.push({
        code: warningCode || 'SCHEDULE_PLANNER_OPTIONAL_QUERY_FAILED',
        message: error.message || 'Falha ao carregar um bloco opcional do planejamento.',
      });

      return {
        data: fallbackValue,
        error: null,
      };
    }

    return { data, error: null };
  } catch (error) {
    warnings?.push({
      code: warningCode || 'SCHEDULE_PLANNER_OPTIONAL_QUERY_FAILED',
      message: error?.message || 'Falha inesperada ao carregar um bloco opcional do planejamento.',
    });

    return {
      data: fallbackValue,
      error: null,
    };
  }
}

export async function loadSchedulePlanningContext({
  settingId,
  actor = null,
}) {
  const client = createServiceRoleClient(actor);
  const warnings = [];
  const formIdsResult = await runOptionalQuery(
    client.from('teacher_availability_forms').select('id').eq('setting_id', settingId),
    [],
    warnings,
    'SCHEDULE_PLANNER_FORM_IDS_LOAD_FAILED',
  );
  const formIds = formIdsResult.data?.map((item) => item.id) || [];
  const safeFormIds = formIds.length > 0
    ? formIds
    : ['00000000-0000-0000-0000-000000000000'];

  const [
    settingResult,
    shiftsResult,
    environmentsResult,
    curriculumResult,
    formsResult,
    slotsResult,
    preferencesResult,
    classesResult,
    subjectsResult,
    teachersResult,
    optimizationResult,
  ] = await Promise.all([
    runOptionalQuery(client.from('school_schedule_settings').select('*').eq('id', settingId).maybeSingle(), null, warnings, 'SCHEDULE_PLANNER_SETTING_LOAD_FAILED'),
    runOptionalQuery(client.from('school_shifts').select('*').eq('setting_id', settingId).order('start_time'), [], warnings, 'SCHEDULE_PLANNER_SHIFTS_LOAD_FAILED'),
    runOptionalQuery(client.from('school_environments').select('*').eq('setting_id', settingId).order('name'), [], warnings, 'SCHEDULE_PLANNER_ENVIRONMENTS_LOAD_FAILED'),
    runOptionalQuery(client.from('curriculum_matrix').select('*').eq('setting_id', settingId).order('distribution_priority', { ascending: false }), [], warnings, 'SCHEDULE_PLANNER_CURRICULUM_LOAD_FAILED'),
    runOptionalQuery(client.from('teacher_availability_forms').select('*').eq('setting_id', settingId), [], warnings, 'SCHEDULE_PLANNER_FORMS_LOAD_FAILED'),
    runOptionalQuery(client.from('teacher_availability_slots').select('*').in('form_id', safeFormIds), [], warnings, 'SCHEDULE_PLANNER_SLOTS_LOAD_FAILED'),
    runOptionalQuery(client.from('teacher_preferences').select('*').in('form_id', safeFormIds), [], warnings, 'SCHEDULE_PLANNER_PREFERENCES_LOAD_FAILED'),
    runOptionalQuery(client.from('classes').select('*').order('name'), [], warnings, 'SCHEDULE_PLANNER_CLASSES_LOAD_FAILED'),
    runOptionalQuery(client.from('subjects').select('*').order('name'), [], warnings, 'SCHEDULE_PLANNER_SUBJECTS_LOAD_FAILED'),
    runOptionalQuery(client.from('teachers').select('*').order('full_name'), [], warnings, 'SCHEDULE_PLANNER_TEACHERS_LOAD_FAILED'),
    runOptionalQuery(client.from('optimization_settings').select('*').eq('setting_id', settingId).maybeSingle(), null, warnings, 'SCHEDULE_PLANNER_OPTIMIZATION_LOAD_FAILED'),
  ]);

  const forms = formsResult.data || [];
  const slots = slotsResult.data || [];
  const preferences = preferencesResult.data || [];
  const { data: slotLocksData, error: slotLocksError } = await client
    .from('schedule_slot_locks')
    .select('*')
    .eq('setting_id', settingId);

  if (slotLocksError && !isMissingEnterpriseTableError(slotLocksError)) {
    throw createApiError(
      slotLocksError.message || 'Falha ao carregar bloqueios de slot.',
      {
        statusCode: 500,
        code: 'SCHEDULE_PLANNER_SLOT_LOCKS_LOAD_FAILED',
        cause: slotLocksError,
      }
    );
  }

  const slotLocks = slotLocksData || [];

  let ruleSets = [];
  let ruleWeights = [];

  const { data: ruleSetsData, error: ruleSetsError } = await client
    .from('schedule_rule_sets')
    .select('*')
    .eq('setting_id', settingId);

  if (ruleSetsError) {
    if (!isMissingEnterpriseTableError(ruleSetsError)) {
      throw createApiError(
        ruleSetsError.message || 'Falha ao carregar regras do planejamento.',
        {
          statusCode: 500,
          code: 'SCHEDULE_PLANNER_RULE_SETS_LOAD_FAILED',
          cause: ruleSetsError,
        }
      );
    }
  } else {
    ruleSets = ruleSetsData || [];
    const ruleSetIds = ruleSets.map((ruleSet) => ruleSet.id);

    if (ruleSetIds.length > 0) {
      const { data: ruleWeightsData, error: ruleWeightsError } = await client
        .from('schedule_rule_weights')
        .select('*')
        .in('rule_set_id', ruleSetIds);

      if (ruleWeightsError) {
        if (!isMissingEnterpriseTableError(ruleWeightsError)) {
          throw createApiError(
            ruleWeightsError.message || 'Falha ao carregar pesos de regra.',
            {
              statusCode: 500,
              code: 'SCHEDULE_PLANNER_RULE_WEIGHTS_LOAD_FAILED',
              cause: ruleWeightsError,
            }
          );
        }
      } else {
        ruleWeights = ruleWeightsData || [];
      }
    }
  }

  const availabilityMap = new Map(
    forms.map((form) => [
      form.teacher_id,
      createAvailabilityMatrix(
        shiftsResult.data || [],
        slots.filter((slot) => slot.teacher_id === form.teacher_id),
      ),
    ])
  );

  return {
    setting: settingResult.data || null,
    shifts: shiftsResult.data || [],
    environments: environmentsResult.data || [],
    curriculum: curriculumResult.data || [],
    forms,
    slots,
    preferences,
    slotLocks,
    ruleSets,
    ruleWeights,
    classes: classesResult.data || [],
    subjects: subjectsResult.data || [],
    teachers: teachersResult.data || [],
    availabilityMap,
    warnings,
    optimizationWeights: optimizationResult.data
      ? {
          reduceTeacherGaps: Number(optimizationResult.data.reduce_teacher_gaps || DEFAULT_OPTIMIZATION_WEIGHTS.reduceTeacherGaps),
          avoidSingleLessonDays: Number(optimizationResult.data.avoid_single_lesson_days || DEFAULT_OPTIMIZATION_WEIGHTS.avoidSingleLessonDays),
          clusterPedagogicalBlocks: Number(optimizationResult.data.cluster_pedagogical_blocks || DEFAULT_OPTIMIZATION_WEIGHTS.clusterPedagogicalBlocks),
          spreadAcrossWeek: Number(optimizationResult.data.spread_across_week || DEFAULT_OPTIMIZATION_WEIGHTS.spreadAcrossWeek),
          avoidDailyOverload: Number(optimizationResult.data.avoid_daily_overload || DEFAULT_OPTIMIZATION_WEIGHTS.avoidDailyOverload),
          optimizeSpecialEnvironments: Number(optimizationResult.data.optimize_special_environments || DEFAULT_OPTIMIZATION_WEIGHTS.optimizeSpecialEnvironments),
          minimizeIntercampusTravel: Number(optimizationResult.data.minimize_intercampus_travel || DEFAULT_OPTIMIZATION_WEIGHTS.minimizeIntercampusTravel),
        }
      : { ...DEFAULT_OPTIMIZATION_WEIGHTS },
  };
}

export async function ensureAvailabilityForms({
  settingId,
  teacherIds,
  requestedBy = null,
  dueAt = null,
  note = null,
  actor = null,
}) {
  const client = createServiceRoleClient(actor);
  const normalizedTeacherIds = normalizeArray(teacherIds);

  if (normalizedTeacherIds.length === 0) {
    throw createApiError('Nenhum professor foi informado para envio do questionário.', {
      statusCode: 400,
      code: 'SCHEDULE_FORMS_TEACHERS_REQUIRED',
    });
  }

  const { data: existingForms, error: existingFormsError } = await client
    .from('teacher_availability_forms')
    .select('*')
    .eq('setting_id', settingId)
    .in('teacher_id', normalizedTeacherIds);

  if (existingFormsError) {
    throw createApiError(existingFormsError.message || 'Falha ao localizar formulários existentes.', {
      statusCode: 500,
      code: 'SCHEDULE_FORMS_LOAD_FAILED',
      cause: existingFormsError,
    });
  }

  const formsByTeacher = new Map((existingForms || []).map((form) => [form.teacher_id, form]));
  const now = new Date().toISOString();
  const savedForms = [];

  for (const teacherId of normalizedTeacherIds) {
    const existingForm = formsByTeacher.get(teacherId) || null;
    const formPayload = {
      setting_id: settingId,
      teacher_id: teacherId,
      requested_by: requestedBy,
      due_at: dueAt,
      notes: note,
      status: SCHEDULE_FORM_STATUS.SENT,
      sent_at: now,
    };

    const query = existingForm?.id
      ? client.from('teacher_availability_forms').update(formPayload).eq('id', existingForm.id).select('*').single()
      : client.from('teacher_availability_forms').insert(formPayload).select('*').single();

    const { data, error } = await query;

    if (error) {
      throw createApiError(error.message || 'Falha ao registrar formulários de disponibilidade.', {
        statusCode: 500,
        code: 'SCHEDULE_FORMS_SAVE_FAILED',
        cause: error,
      });
    }

    if (data) {
      savedForms.push(data);
    }
  }

  return savedForms;
}
