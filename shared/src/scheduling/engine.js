import {
  DEFAULT_OPTIMIZATION_WEIGHTS,
  SCHEDULE_CONFLICT_STATUS,
  SCHEDULE_CONFLICT_TYPES,
  SCHEDULE_GENERATION_STATUS,
  SCHEDULE_SUGGESTION_STATUS,
  SCHEDULE_SUGGESTION_TYPES,
  summarizeDetailedGeneration,
  summarizeGeneration,
} from '../contracts/schedulePlanner.js';

function normalizeWeights(input = {}) {
  return {
    ...DEFAULT_OPTIMIZATION_WEIGHTS,
    ...(input || {}),
  };
}

function createSlotId({ shiftId, dayOfWeek, lessonIndex }) {
  return `${shiftId}:${dayOfWeek}:${lessonIndex}`;
}

function buildOccupancyIndexes(entries = []) {
  const teacher = new Map();
  const classes = new Map();
  const environments = new Map();

  entries.forEach((entry) => {
    const slotId = createSlotId(entry);
    teacher.set(`${entry.teacher_id}:${slotId}`, entry.id || slotId);
    classes.set(`${entry.class_id}:${slotId}`, entry.id || slotId);
    if (entry.environment_id) {
      environments.set(`${entry.environment_id}:${slotId}`, entry.id || slotId);
    }
  });

  return { teacher, classes, environments };
}

function getTeacherDailyCount(entries = [], teacherId, dayOfWeek) {
  return entries.filter((entry) => entry.teacher_id === teacherId && entry.day_of_week === dayOfWeek).length;
}

function getClassDailyCount(entries = [], classId, dayOfWeek) {
  return entries.filter((entry) => entry.class_id === classId && entry.day_of_week === dayOfWeek).length;
}

function getTeacherGaps(entries = [], teacherId, dayOfWeek, shiftId) {
  const lessons = entries
    .filter((entry) => entry.teacher_id === teacherId && entry.day_of_week === dayOfWeek && entry.shift_id === shiftId)
    .map((entry) => entry.lesson_index)
    .sort((left, right) => left - right);

  if (lessons.length <= 1) return 0;

  let gaps = 0;
  for (let index = 1; index < lessons.length; index += 1) {
    gaps += Math.max(0, lessons[index] - lessons[index - 1] - 1);
  }

  return gaps;
}

function buildAvailabilityMatrix(shifts = [], slots = []) {
  const matrix = new Map();
  shifts.forEach((shift) => {
    const activeDays = Array.isArray(shift.active_days) && shift.active_days.length > 0
      ? shift.active_days
      : [1, 2, 3, 4, 5];
    activeDays.forEach((dayOfWeek) => {
      for (let lessonIndex = 1; lessonIndex <= Number(shift.lesson_count || 0); lessonIndex += 1) {
        matrix.set(`${shift.id}:${dayOfWeek}:${lessonIndex}`, false);
      }
    });
  });
  slots.forEach((slot) => {
    matrix.set(`${slot.shift_id}:${slot.day_of_week}:${slot.lesson_index}`, Boolean(slot.is_available));
  });
  return matrix;
}

function normalizeContext(context = {}) {
  const shifts = context.shifts || [];
  const availabilityMap = context.availabilityMap instanceof Map
    ? context.availabilityMap
    : new Map(
      (context.forms || []).map((form) => [
        form.teacher_id,
        buildAvailabilityMatrix(shifts, (context.slots || []).filter((slot) => slot.teacher_id === form.teacher_id)),
      ])
    );

  return {
    setting: context.setting || null,
    shifts,
    environments: context.environments || [],
    curriculum: context.curriculum || [],
    forms: context.forms || [],
    slots: context.slots || [],
    preferences: context.preferences || [],
    classes: context.classes || [],
    subjects: context.subjects || [],
    teachers: context.teachers || [],
    availabilityMap,
    optimizationWeights: normalizeWeights(context.optimizationWeights),
    ruleWeights: context.ruleWeights || [],
    slotLocks: context.slotLocks || [],
  };
}

export function validateScheduleInputs(context = {}) {
  const issues = [];
  const curriculum = context.curriculum || [];
  const shifts = context.shifts || [];
  const classes = context.classes || [];
  const teachers = context.teachers || [];

  if (!curriculum.length) issues.push('Nenhum item da matriz curricular foi informado.');
  if (!shifts.length) issues.push('Nenhum turno/estrutura de horário foi cadastrado.');
  if (!classes.length) issues.push('Nenhuma turma foi encontrada para o planejamento.');
  if (!teachers.length) issues.push('Nenhum professor foi encontrado para o planejamento.');

  curriculum.forEach((item, index) => {
    if (!item.class_id || !item.subject_id || !item.teacher_id) {
      issues.push(`Linha ${index + 1} da matriz curricular sem turma, disciplina ou professor.`);
    }
    if (!item.weekly_lessons || item.weekly_lessons < 1) {
      issues.push(`Linha ${index + 1} da matriz curricular sem quantidade semanal válida.`);
    }
  });

  return { valid: issues.length === 0, issues };
}

function enumerateCandidateSlots(curriculumItem, shifts = []) {
  const eligibleShifts = shifts.filter((shift) => !curriculumItem.shift_id || shift.id === curriculumItem.shift_id);
  const candidates = [];

  eligibleShifts.forEach((shift) => {
    const activeDays = Array.isArray(shift.active_days) && shift.active_days.length > 0
      ? shift.active_days
      : [1, 2, 3, 4, 5];

    activeDays.forEach((dayOfWeek) => {
      for (let lessonIndex = 1; lessonIndex <= Number(shift.lesson_count || 0); lessonIndex += 1) {
        candidates.push({
          shiftId: shift.id,
          dayOfWeek,
          lessonIndex,
          slotId: createSlotId({ shiftId: shift.id, dayOfWeek, lessonIndex }),
        });
      }
    });
  });

  return candidates;
}

function isTeacherAvailable(availabilityMap, teacherId, slot) {
  const teacherMatrix = availabilityMap.get(teacherId);
  if (!teacherMatrix) return true;
  return teacherMatrix.get(`${slot.shiftId}:${slot.dayOfWeek}:${slot.lessonIndex}`) === true;
}

function chooseEnvironment(curriculumItem, environments = [], environmentIndexes = new Map(), slot) {
  if (curriculumItem.preferred_environment_id) {
    const slotKey = `${curriculumItem.preferred_environment_id}:${slot.slotId}`;
    if (!environmentIndexes.has(slotKey)) {
      return curriculumItem.preferred_environment_id;
    }
    return null;
  }

  if (!curriculumItem.requires_special_environment) {
    return null;
  }

  const availableEnvironment = environments.find((environment) => (
    environment.is_special
    && environment.status !== 'inativo'
    && !environmentIndexes.has(`${environment.id}:${slot.slotId}`)
  ));

  return availableEnvironment?.id || null;
}

function rankCandidateSlot({
  slot,
  curriculumItem,
  currentEntries,
  optimizationWeights,
  occupancyIndexes,
  availabilityMap,
  slotLocks = [],
}) {
  const weights = normalizeWeights(optimizationWeights);
  let score = 0;

  if (!isTeacherAvailable(availabilityMap, curriculumItem.teacher_id, slot)) {
    return Number.NEGATIVE_INFINITY;
  }

  if (occupancyIndexes.teacher.has(`${curriculumItem.teacher_id}:${slot.slotId}`)) {
    return Number.NEGATIVE_INFINITY;
  }

  if (occupancyIndexes.classes.has(`${curriculumItem.class_id}:${slot.slotId}`)) {
    return Number.NEGATIVE_INFINITY;
  }

  if (slotLocks.some((lock) => (
    lock.shift_id === slot.shiftId
    && lock.day_of_week === slot.dayOfWeek
    && lock.lesson_index === slot.lessonIndex
  ))) {
    return Number.NEGATIVE_INFINITY;
  }

  const teacherDailyLoad = getTeacherDailyCount(currentEntries, curriculumItem.teacher_id, slot.dayOfWeek);
  const classDailyLoad = getClassDailyCount(currentEntries, curriculumItem.class_id, slot.dayOfWeek);
  const teacherExistingDay = currentEntries.filter((entry) => entry.teacher_id === curriculumItem.teacher_id && entry.day_of_week === slot.dayOfWeek);
  const sameClassSubjectDay = currentEntries.filter((entry) => (
    entry.class_id === curriculumItem.class_id
    && entry.subject_id === curriculumItem.subject_id
    && entry.day_of_week === slot.dayOfWeek
  )).length;

  score -= teacherDailyLoad * weights.avoidDailyOverload;
  score -= classDailyLoad * (weights.spreadAcrossWeek / 2);
  score += sameClassSubjectDay > 0 ? weights.clusterPedagogicalBlocks : weights.spreadAcrossWeek;
  score += teacherExistingDay.length === 0 ? -weights.avoidSingleLessonDays : weights.reduceTeacherGaps;

  if (curriculumItem.requires_special_environment) {
    score += weights.optimizeSpecialEnvironments;
  }

  if (curriculumItem.preferred_environment_id) {
    score += weights.optimizeSpecialEnvironments;
  }

  return score;
}

function buildDifficultyScore(curriculumItem, context = {}) {
  const weights = normalizeWeights(context.optimizationWeights);
  const availabilityMap = context.availabilityMap || new Map();
  const shifts = context.shifts || [];
  const slots = enumerateCandidateSlots(curriculumItem, shifts);
  const availableSlots = slots.filter((slot) => isTeacherAvailable(availabilityMap, curriculumItem.teacher_id, slot));

  const scarcity = slots.length === 0 ? 100 : Math.round(((slots.length - availableSlots.length) / Math.max(slots.length, 1)) * 100);
  const needsSpecial = curriculumItem.requires_special_environment ? 20 : 0;
  const priority = Number(curriculumItem.distribution_priority || 0) * 6;
  const weekly = Number(curriculumItem.weekly_lessons || 0) * 3;

  return scarcity + needsSpecial + priority + weekly + weights.avoidSingleLessonDays;
}

function createConflict({
  generationId = null,
  type,
  severity = 'media',
  curriculum = null,
  slot = null,
  reasonCode,
  reasonText,
  impactSummary,
  blockingData = {},
}) {
  return {
    generation_id: generationId,
    conflict_type: type,
    severity,
    class_id: curriculum?.class_id || blockingData.class_id || null,
    subject_id: curriculum?.subject_id || blockingData.subject_id || null,
    teacher_id: curriculum?.teacher_id || blockingData.teacher_id || null,
    environment_id: curriculum?.preferred_environment_id || blockingData.environment_id || null,
    shift_id: slot?.shiftId || curriculum?.shift_id || null,
    day_of_week: slot?.dayOfWeek || null,
    lesson_index: slot?.lessonIndex || null,
    reason_code: reasonCode,
    reason_text: reasonText,
    impact_summary: impactSummary,
    blocking_data: blockingData,
    status: SCHEDULE_CONFLICT_STATUS.OPEN,
  };
}

function createSuggestion({
  generationId = null,
  conflict = null,
  type,
  title,
  description,
  impactScore = 0,
  operationPayload = {},
}) {
  return {
    generation_id: generationId,
    conflict_id: null,
    suggestion_type: type,
    status: SCHEDULE_SUGGESTION_STATUS.PENDING,
    title,
    description,
    impact_score: impactScore,
    before_state: conflict || {},
    after_state: operationPayload.preview || {},
    operation_payload: operationPayload,
  };
}

function detectConflicts(entries = [], context = {}) {
  const conflicts = [];
  const teacherSeen = new Set();
  const classSeen = new Set();
  const environmentSeen = new Set();
  const teacherPreferences = context.preferences || [];

  entries.forEach((entry) => {
    const slotId = createSlotId({
      shiftId: entry.shift_id,
      dayOfWeek: entry.day_of_week,
      lessonIndex: entry.lesson_index,
    });

    const teacherKey = `${entry.teacher_id}:${slotId}`;
    const classKey = `${entry.class_id}:${slotId}`;
    const environmentKey = entry.environment_id ? `${entry.environment_id}:${slotId}` : null;

    if (teacherSeen.has(teacherKey)) {
      conflicts.push(createConflict({
        type: SCHEDULE_CONFLICT_TYPES.TEACHER_OVERLAP,
        severity: 'alta',
        curriculum: entry,
        slot: { shiftId: entry.shift_id, dayOfWeek: entry.day_of_week, lessonIndex: entry.lesson_index },
        reasonCode: 'TEACHER_DUPLICATED_SLOT',
        reasonText: 'Professor alocado em mais de uma aula no mesmo horário.',
        impactSummary: 'Conflito crítico de disponibilidade docente.',
      }));
    }
    teacherSeen.add(teacherKey);

    if (classSeen.has(classKey)) {
      conflicts.push(createConflict({
        type: SCHEDULE_CONFLICT_TYPES.CLASS_OVERLAP,
        severity: 'alta',
        curriculum: entry,
        slot: { shiftId: entry.shift_id, dayOfWeek: entry.day_of_week, lessonIndex: entry.lesson_index },
        reasonCode: 'CLASS_DUPLICATED_SLOT',
        reasonText: 'Turma alocada em mais de uma aula no mesmo horário.',
        impactSummary: 'Conflito crítico da grade da turma.',
      }));
    }
    classSeen.add(classKey);

    if (environmentKey && environmentSeen.has(environmentKey)) {
      conflicts.push(createConflict({
        type: SCHEDULE_CONFLICT_TYPES.ENVIRONMENT_OVERLAP,
        severity: 'alta',
        curriculum: entry,
        slot: { shiftId: entry.shift_id, dayOfWeek: entry.day_of_week, lessonIndex: entry.lesson_index },
        reasonCode: 'ENVIRONMENT_DUPLICATED_SLOT',
        reasonText: 'Ambiente especial usado por mais de uma turma no mesmo horário.',
        impactSummary: 'Conflito de simultaneidade de ambiente.',
      }));
    }
    if (environmentKey) environmentSeen.add(environmentKey);

    const preference = teacherPreferences.find((item) => item.teacher_id === entry.teacher_id);
    if (preference?.max_lessons_per_day) {
      const dailyLoad = getTeacherDailyCount(entries, entry.teacher_id, entry.day_of_week);
      if (dailyLoad > preference.max_lessons_per_day) {
        conflicts.push(createConflict({
          type: SCHEDULE_CONFLICT_TYPES.DAILY_LIMIT,
          severity: 'media',
          curriculum: entry,
          slot: { shiftId: entry.shift_id, dayOfWeek: entry.day_of_week, lessonIndex: entry.lesson_index },
          reasonCode: 'TEACHER_DAILY_LIMIT_EXCEEDED',
          reasonText: 'Professor ultrapassou o limite diário configurado.',
          impactSummary: `Carga diária acima do limite de ${preference.max_lessons_per_day} aulas.`,
        }));
      }
    }
  });

  return conflicts;
}

function findReplacementSlot(entry, entries, context = {}) {
  const occupancyIndexes = buildOccupancyIndexes(entries.filter((item) => item !== entry));
  const curriculumItem = (context.curriculum || []).find((item) => (
    item.class_id === entry.class_id
    && item.subject_id === entry.subject_id
    && item.teacher_id === entry.teacher_id
  )) || entry;

  return enumerateCandidateSlots(curriculumItem, context.shifts || [])
    .find((slot) => (
      slot.dayOfWeek !== entry.day_of_week
      && isTeacherAvailable(context.availabilityMap || new Map(), entry.teacher_id, slot)
      && !occupancyIndexes.teacher.has(`${entry.teacher_id}:${slot.slotId}`)
      && !occupancyIndexes.classes.has(`${entry.class_id}:${slot.slotId}`)
      && (!entry.environment_id || !occupancyIndexes.environments.has(`${entry.environment_id}:${slot.slotId}`))
    )) || null;
}

function buildSuggestions(entries = [], conflicts = [], context = {}) {
  const suggestions = [];

  conflicts.forEach((conflict) => {
    const relatedEntry = entries.find((entry) => (
      entry.class_id === conflict.class_id
      && entry.subject_id === conflict.subject_id
      && entry.teacher_id === conflict.teacher_id
      && (conflict.day_of_week ? entry.day_of_week === conflict.day_of_week : true)
      && (conflict.lesson_index ? entry.lesson_index === conflict.lesson_index : true)
    ));

    if (!relatedEntry) return;

    const replacementSlot = findReplacementSlot(relatedEntry, entries, context);
    if (!replacementSlot) return;

    suggestions.push(createSuggestion({
      conflict,
      type: SCHEDULE_SUGGESTION_TYPES.MOVE_ENTRY,
      title: 'Mover aula para outro encaixe',
      description: `Mover a aula para ${replacementSlot.dayOfWeek}/${replacementSlot.lessonIndex} reduz o conflito detectado.`,
      impactScore: 12,
      operationPayload: {
        type: 'move_entry',
        selector: {
          class_id: relatedEntry.class_id,
          subject_id: relatedEntry.subject_id,
          teacher_id: relatedEntry.teacher_id,
          shift_id: relatedEntry.shift_id,
          day_of_week: relatedEntry.day_of_week,
          lesson_index: relatedEntry.lesson_index,
        },
        target: {
          shift_id: replacementSlot.shiftId,
          day_of_week: replacementSlot.dayOfWeek,
          lesson_index: replacementSlot.lessonIndex,
          environment_id: relatedEntry.environment_id,
        },
        preview: {
          from: {
            shift_id: relatedEntry.shift_id,
            day_of_week: relatedEntry.day_of_week,
            lesson_index: relatedEntry.lesson_index,
          },
          to: {
            shift_id: replacementSlot.shiftId,
            day_of_week: replacementSlot.dayOfWeek,
            lesson_index: replacementSlot.lessonIndex,
          },
        },
      },
    }));
  });

  return suggestions;
}

function runAutoFixPass(entries = [], suggestions = []) {
  let currentEntries = [...entries];
  const applied = [];

  suggestions.slice(0, 5).forEach((suggestion) => {
    const nextEntries = applySuggestionLocally(currentEntries, suggestion);
    if (nextEntries !== currentEntries) {
      currentEntries = nextEntries;
      applied.push(suggestion.id || suggestion.title || suggestion.suggestion_type);
    }
  });

  return { entries: currentEntries, applied };
}

export function computeScheduleMetrics(entries = [], conflicts = [], context = {}) {
  const weights = normalizeWeights(context.optimizationWeights);
  const teachers = [...new Set(entries.map((entry) => entry.teacher_id).filter(Boolean))];
  const classes = [...new Set(entries.map((entry) => entry.class_id).filter(Boolean))];
  const environments = [...new Set(entries.map((entry) => entry.environment_id).filter(Boolean))];

  const conflictScore = Math.max(0, 100 - conflicts.reduce((score, conflict) => score + (conflict.severity === 'alta' ? 20 : conflict.severity === 'media' ? 10 : 5), 0));

  let teacherPreferenceScore = 100;
  let workloadBalanceScore = 100;
  let continuityScore = 100;
  let roomUtilizationScore = 100;

  teachers.forEach((teacherId) => {
    const teacherEntries = entries.filter((entry) => entry.teacher_id === teacherId);
    const dailyBuckets = new Map();
    teacherEntries.forEach((entry) => {
      const key = entry.day_of_week;
      dailyBuckets.set(key, (dailyBuckets.get(key) || 0) + 1);
      continuityScore -= getTeacherGaps(entries, teacherId, entry.day_of_week, entry.shift_id) * weights.reduceTeacherGaps;
    });
    dailyBuckets.forEach((count) => {
      if (count === 1) teacherPreferenceScore -= weights.avoidSingleLessonDays / 2;
      if (count > 6) workloadBalanceScore -= (count - 6) * weights.avoidDailyOverload;
    });
  });

  roomUtilizationScore -= Math.max(0, entries.filter((entry) => entry.environment_id).length - environments.length) * 2;
  workloadBalanceScore -= Math.max(0, classes.length - teachers.length);

  const finalScore = Math.max(
    0,
    Math.round(
      (conflictScore * 0.35)
      + (teacherPreferenceScore * 0.2)
      + (workloadBalanceScore * 0.2)
      + (roomUtilizationScore * 0.1)
      + (continuityScore * 0.15)
    )
  );

  return {
    conflict_score: Math.max(0, Math.round(conflictScore)),
    teacher_preference_score: Math.max(0, Math.round(teacherPreferenceScore)),
    workload_balance_score: Math.max(0, Math.round(workloadBalanceScore)),
    room_utilization_score: Math.max(0, Math.round(roomUtilizationScore)),
    continuity_score: Math.max(0, Math.round(continuityScore)),
    final_score: finalScore,
  };
}

function generateInitialAllocation(context = {}) {
  const {
    curriculum = [],
    shifts = [],
    environments = [],
    availabilityMap = new Map(),
    preferences = [],
    optimizationWeights = DEFAULT_OPTIMIZATION_WEIGHTS,
    slotLocks = [],
  } = context;

  const entries = [];
  const conflicts = [];
  const unallocated = [];
  const orderedCurriculum = [...curriculum]
    .map((item) => ({
      ...item,
      difficultyScore: buildDifficultyScore(item, context),
    }))
    .sort((left, right) => (
      right.difficultyScore - left.difficultyScore
      || Number(right.distribution_priority || 0) - Number(left.distribution_priority || 0)
      || Number(right.weekly_lessons || 0) - Number(left.weekly_lessons || 0)
    ));

  orderedCurriculum.forEach((curriculumItem) => {
    const teacherPreference = preferences.find((item) => item.teacher_id === curriculumItem.teacher_id) || {};
    const requiredLessons = Number(curriculumItem.weekly_lessons || 0);
    let allocatedLessons = 0;

    for (let lessonCounter = 0; lessonCounter < requiredLessons; lessonCounter += 1) {
      const occupancyIndexes = buildOccupancyIndexes(entries);
      const candidates = enumerateCandidateSlots(curriculumItem, shifts)
        .map((slot) => ({
          slot,
          score: rankCandidateSlot({
            slot,
            curriculumItem,
            currentEntries: entries,
            optimizationWeights,
            occupancyIndexes,
            availabilityMap,
            slotLocks,
          }),
        }))
        .filter((candidate) => Number.isFinite(candidate.score))
        .sort((left, right) => right.score - left.score);

      const selected = candidates.find(({ slot }) => {
        const dailyCount = getTeacherDailyCount(entries, curriculumItem.teacher_id, slot.dayOfWeek);
        const maxLessonsPerDay = Number(teacherPreference.max_lessons_per_day || curriculumItem.max_lessons_per_day || 6);
        return dailyCount < maxLessonsPerDay;
      });

      if (!selected) {
        unallocated.push({
          curriculum_id: curriculumItem.id || null,
          class_id: curriculumItem.class_id,
          subject_id: curriculumItem.subject_id,
          teacher_id: curriculumItem.teacher_id,
          remaining_lessons: requiredLessons - allocatedLessons,
          reason: 'NO_VALID_SLOT',
        });
        conflicts.push(createConflict({
          type: SCHEDULE_CONFLICT_TYPES.UNSCHEDULED_LESSON,
          severity: lessonCounter === 0 ? 'alta' : 'media',
          curriculum: curriculumItem,
          reasonCode: 'NO_VALID_SLOT',
          reasonText: 'Nenhum horário livre respeita simultaneamente disponibilidade, turma e professor.',
          impactSummary: `Restou ${requiredLessons - allocatedLessons} aula(s) sem alocação para a disciplina.`,
          blockingData: {
            remaining_lessons: requiredLessons - allocatedLessons,
          },
        }));
        break;
      }

      const environmentId = chooseEnvironment(curriculumItem, environments, occupancyIndexes.environments, selected.slot);
      if (curriculumItem.requires_special_environment && !environmentId) {
        conflicts.push(createConflict({
          type: SCHEDULE_CONFLICT_TYPES.ENVIRONMENT_OVERLAP,
          severity: 'alta',
          curriculum: curriculumItem,
          slot: selected.slot,
          reasonCode: 'SPECIAL_ENVIRONMENT_UNAVAILABLE',
          reasonText: 'A disciplina exige ambiente especial e nenhum espaço estava disponível neste encaixe.',
          impactSummary: 'O uso de ambiente especial ficou bloqueado por simultaneidade.',
          blockingData: {
            requires_special_environment: true,
          },
        }));
        continue;
      }

      entries.push({
        generation_id: null,
        class_id: curriculumItem.class_id,
        subject_id: curriculumItem.subject_id,
        teacher_id: curriculumItem.teacher_id,
        environment_id: environmentId,
        shift_id: selected.slot.shiftId,
        day_of_week: selected.slot.dayOfWeek,
        lesson_index: selected.slot.lessonIndex,
        status: 'alocada',
        source: 'automatico',
        is_locked: false,
        quality_penalty: 0,
        notes: teacherPreference.prefers_double_lessons ? 'Preferência por aulas geminadas considerada.' : null,
      });

      allocatedLessons += 1;
    }
  });

  return { entries, conflicts, unallocated, orderedCurriculum };
}

function computeGenerationStatus({ validation, entries, conflicts, unallocated }) {
  if (!validation.valid) {
    return SCHEDULE_GENERATION_STATUS.FAILED_VALIDATION;
  }

  if (!entries.length && (conflicts.length > 0 || unallocated.length > 0)) {
    return SCHEDULE_GENERATION_STATUS.FAILED_GENERATION;
  }

  if (unallocated.length > 0) {
    return SCHEDULE_GENERATION_STATUS.PARTIALLY_COMPLETED;
  }

  if (conflicts.length > 0) {
    return SCHEDULE_GENERATION_STATUS.COMPLETED_WITH_CONFLICTS;
  }

  return SCHEDULE_GENERATION_STATUS.COMPLETED;
}

export function generateSchoolSchedule(context = {}) {
  const normalized = normalizeContext(context);
  const validation = validateScheduleInputs(normalized);

  if (!validation.valid) {
    const conflicts = validation.issues.map((issue) => createConflict({
      type: SCHEDULE_CONFLICT_TYPES.MISSING_DATA,
      severity: 'alta',
      reasonCode: 'VALIDATION_FAILED',
      reasonText: issue,
      impactSummary: 'A geração automática foi interrompida por falta de dados mínimos.',
    }));

    const metrics = computeScheduleMetrics([], conflicts, normalized);
    return {
      validation,
      context: normalized,
      entries: [],
      conflicts,
      suggestions: [],
      autoFixes: [],
      unallocated: [],
      metrics,
      summary: summarizeDetailedGeneration({
        entries: [],
        conflicts,
        suggestions: [],
        metrics,
        qualityScore: 0,
      }),
      status: SCHEDULE_GENERATION_STATUS.FAILED_VALIDATION,
      qualityScore: 0,
      justification: 'Contexto inválido: faltam dados mínimos para iniciar a geração.',
    };
  }

  const initial = generateInitialAllocation(normalized);
  const detectedConflicts = detectConflicts(initial.entries, normalized);
  const allConflicts = [...initial.conflicts, ...detectedConflicts];
  const suggestions = buildSuggestions(initial.entries, allConflicts, normalized);
  const autoFix = runAutoFixPass(initial.entries, suggestions);
  const optimizedConflicts = detectConflicts(autoFix.entries, normalized);
  const combinedConflicts = [...allConflicts, ...optimizedConflicts];
  const metrics = computeScheduleMetrics(autoFix.entries, combinedConflicts, normalized);
  const status = computeGenerationStatus({
    validation,
    entries: autoFix.entries,
    conflicts: combinedConflicts,
    unallocated: initial.unallocated,
  });

  const detailedSummary = summarizeDetailedGeneration({
    entries: autoFix.entries,
    conflicts: combinedConflicts,
    suggestions,
    metrics,
    qualityScore: metrics.final_score,
  });

  return {
    validation,
    context: normalized,
    entries: autoFix.entries,
    conflicts: combinedConflicts,
    suggestions,
    autoFixes: autoFix.applied,
    unallocated: initial.unallocated,
    metrics,
    summary: {
      ...summarizeGeneration({
        entries: autoFix.entries,
        conflicts: combinedConflicts,
        qualityScore: metrics.final_score,
      }),
      ...detailedSummary,
    },
    status,
    qualityScore: metrics.final_score,
    justification: combinedConflicts.length > 0 || initial.unallocated.length > 0
      ? 'A geração concluiu com restrições residuais ou alocações pendentes e precisa de revisão.'
      : 'A geração concluiu sem conflitos relevantes.',
  };
}

export function applySuggestionLocally(entries = [], suggestion = null) {
  if (!suggestion?.operation_payload?.type) {
    return entries;
  }

  const payload = suggestion.operation_payload;
  if (payload.type === 'move_entry') {
    return entries.map((entry) => {
      const selector = payload.selector || {};
      const matches = (
        entry.class_id === selector.class_id
        && entry.subject_id === selector.subject_id
        && entry.teacher_id === selector.teacher_id
        && entry.shift_id === selector.shift_id
        && entry.day_of_week === selector.day_of_week
        && entry.lesson_index === selector.lesson_index
      );

      if (!matches) return entry;

      return {
        ...entry,
        ...payload.target,
        source: 'sugestao_aplicada',
      };
    });
  }

  return entries;
}
