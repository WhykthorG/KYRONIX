// P├Âr├Âjek ╔øm╔ø cua lat k╔ø╔øliw ╔ø Whykthor GSV.
export const SCHEDULE_PLANNER_TABLES = Object.freeze({
  SETTINGS: 'school_schedule_settings',
  SHIFTS: 'school_shifts',
  ENVIRONMENTS: 'school_environments',
  CURRICULUM: 'curriculum_matrix',
  AVAILABILITY_FORMS: 'teacher_availability_forms',
  AVAILABILITY_SLOTS: 'teacher_availability_slots',
  PREFERENCES: 'teacher_preferences',
  GENERATIONS: 'schedule_generations',
  ENTRIES: 'schedule_entries',
  CONFLICTS: 'schedule_conflicts',
  SUGGESTIONS: 'schedule_suggestions',
  OPTIMIZATION: 'optimization_settings',
  VERSIONS: 'schedule_versions',
  CHANGE_LOG: 'schedule_change_log',
  PUBLICATIONS: 'schedule_publications',
  MANUAL_EDITS: 'schedule_manual_edits',
  RULE_SETS: 'schedule_rule_sets',
  RULE_WEIGHTS: 'schedule_rule_weights',
  RUNS: 'schedule_generation_runs',
  RUN_METRICS: 'schedule_run_metrics',
  SLOT_LOCKS: 'schedule_slot_locks',
  TEACHER_WORKLOAD: 'teacher_workload_summary',
  ENVIRONMENT_USAGE: 'environment_usage_summary',
});

export const SCHEDULE_FORM_STATUS = Object.freeze({
  DRAFT: 'nao_enviado',
  SENT: 'enviado',
  ANSWERED: 'respondido',
  LATE: 'atrasado',
});

export const SCHEDULE_GENERATION_STATUS = Object.freeze({
  DRAFT: 'rascunho',
  PROCESSING: 'processando',
  COMPLETED: 'concluida',
  COMPLETED_WITH_CONFLICTS: 'concluida_com_pendencias',
  PARTIALLY_COMPLETED: 'parcialmente_concluida',
  FAILED_VALIDATION: 'falhou_validacao',
  FAILED_GENERATION: 'falhou_geracao',
  FAILED: 'falhou',
});

export const SCHEDULE_CONFLICT_STATUS = Object.freeze({
  OPEN: 'aberto',
  ACCEPTED: 'aceito',
  RESOLVED: 'resolvido',
  IGNORED: 'ignorado',
});

export const SCHEDULE_SUGGESTION_STATUS = Object.freeze({
  PENDING: 'pendente',
  APPLIED: 'aplicada',
  REJECTED: 'rejeitada',
});

export const SCHEDULE_CONFLICT_TYPES = Object.freeze({
  MISSING_DATA: 'missing_data',
  TEACHER_UNAVAILABLE: 'teacher_unavailable',
  TEACHER_OVERLAP: 'teacher_overlap',
  CLASS_OVERLAP: 'class_overlap',
  ENVIRONMENT_OVERLAP: 'environment_overlap',
  DAILY_LIMIT: 'daily_limit',
  UNSCHEDULED_LESSON: 'unscheduled_lesson',
});

export const SCHEDULE_SUGGESTION_TYPES = Object.freeze({
  MOVE_ENTRY: 'move_entry',
  SWAP_ENTRIES: 'swap_entries',
  SPLIT_DOUBLE_LESSON: 'split_double_lesson',
  REGROUP_DOUBLE_LESSON: 'regroup_double_lesson',
  REBALANCE_DAY: 'rebalance_day',
  LOCK_SLOT: 'lock_slot',
  ADJUST_WEIGHT: 'adjust_weight',
});

export const SCHEDULE_VERSION_ORIGINS = Object.freeze({
  AUTOMATICA: 'automatica',
  MANUAL: 'manual',
  RESTAURADA: 'restaurada',
  PUBLICADA: 'publicada',
});

export const SCHEDULE_RULE_TYPES = Object.freeze({
  HARD: 'HARD',
  SOFT: 'SOFT',
});

export const SCHEDULE_RULE_SEVERITIES = Object.freeze({
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
});

export const WEEK_DAYS = Object.freeze([
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
]);

export const DEFAULT_OPTIMIZATION_WEIGHTS = Object.freeze({
  reduceTeacherGaps: 8,
  avoidSingleLessonDays: 9,
  clusterPedagogicalBlocks: 6,
  spreadAcrossWeek: 7,
  avoidDailyOverload: 8,
  optimizeSpecialEnvironments: 5,
  minimizeIntercampusTravel: 4,
});

function normalizeString(value, fallback = null) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizePositiveNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function buildScheduleSettingPayload(data = {}) {
  return {
    name: normalizeString(data.name, 'Planejamento principal'),
    academic_year: normalizePositiveNumber(data.academic_year, new Date().getFullYear()),
    term_label: normalizeString(data.term_label, 'Ano letivo'),
    status: normalizeString(data.status, 'planejamento'),
    default_max_lessons_per_day: normalizePositiveNumber(data.default_max_lessons_per_day, 6),
    allow_windows: Boolean(data.allow_windows),
    notes: normalizeString(data.notes),
  };
}

export function buildShiftPayload(data = {}, settingId) {
  return {
    setting_id: settingId,
    code: normalizeString(data.code, null),
    name: normalizeString(data.name, null),
    start_time: normalizeString(data.start_time, null),
    end_time: normalizeString(data.end_time, null),
    lesson_count: normalizePositiveNumber(data.lesson_count, 5),
    active_days: Array.isArray(data.active_days) && data.active_days.length > 0
      ? data.active_days.map(Number).filter(Boolean)
      : [1, 2, 3, 4, 5],
    notes: normalizeString(data.notes),
  };
}

export function buildEnvironmentPayload(data = {}, settingId) {
  return {
    setting_id: settingId,
    code: normalizeString(data.code, null),
    name: normalizeString(data.name, null),
    environment_type: normalizeString(data.environment_type, 'sala'),
    capacity: normalizePositiveNumber(data.capacity, 1),
    is_special: Boolean(data.is_special),
    exclusive_per_slot: Boolean(data.exclusive_per_slot ?? true),
    status: normalizeString(data.status, 'ativo'),
    notes: normalizeString(data.notes),
  };
}

export function buildCurriculumMatrixPayload(data = {}, settingId) {
  return {
    setting_id: settingId,
    class_id: normalizeString(data.class_id, null),
    subject_id: normalizeString(data.subject_id, null),
    teacher_id: normalizeString(data.teacher_id, null),
    shift_id: normalizeString(data.shift_id, null),
    preferred_environment_id: normalizeString(data.preferred_environment_id, null),
    weekly_lessons: normalizePositiveNumber(data.weekly_lessons, 1),
    requires_special_environment: Boolean(data.requires_special_environment),
    double_lesson_preference: normalizeString(data.double_lesson_preference, 'flexivel'),
    max_lessons_per_day: normalizePositiveNumber(data.max_lessons_per_day, 2),
    distribution_priority: normalizePositiveNumber(data.distribution_priority, 5),
    notes: normalizeString(data.notes),
  };
}

export function buildTeacherPreferencePayload(data = {}, formId, teacherId) {
  return {
    form_id: formId,
    teacher_id: teacherId,
    prefers_double_lessons: Boolean(data.prefers_double_lessons),
    prefers_separate_lessons: Boolean(data.prefers_separate_lessons),
    accepts_gaps: Boolean(data.accepts_gaps),
    avoid_single_lesson_days: Boolean(data.avoid_single_lesson_days),
    max_lessons_per_day: normalizePositiveNumber(data.max_lessons_per_day, 5),
    preferred_days: Array.isArray(data.preferred_days)
      ? data.preferred_days.map(Number).filter(Boolean)
      : [],
    notes: normalizeString(data.notes),
  };
}

export function buildTeacherAvailabilitySlotPayload({
  formId,
  teacherId,
  shiftId,
  dayOfWeek,
  lessonIndex,
  isAvailable,
}) {
  return {
    form_id: formId,
    teacher_id: teacherId,
    shift_id: shiftId,
    day_of_week: Number(dayOfWeek),
    lesson_index: Number(lessonIndex),
    is_available: Boolean(isAvailable),
  };
}

export function mergeOptimizationWeights(record = {}) {
  return {
    ...DEFAULT_OPTIMIZATION_WEIGHTS,
    ...(record || {}),
  };
}

export function getWeekDayLabel(dayOfWeek) {
  return WEEK_DAYS.find((item) => item.value === Number(dayOfWeek))?.label || `Dia ${dayOfWeek}`;
}

export function buildScheduleSlotKey({ classId, teacherId, environmentId, shiftId, dayOfWeek, lessonIndex }) {
  return [
    classId || 'class:none',
    teacherId || 'teacher:none',
    environmentId || 'env:none',
    shiftId || 'shift:none',
    `d${dayOfWeek}`,
    `l${lessonIndex}`,
  ].join('|');
}

export function createAvailabilityMatrix(shifts = [], slots = []) {
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

export function summarizeGeneration({ entries = [], conflicts = [], qualityScore = 0 }) {
  return {
    allocatedLessons: entries.length,
    openConflicts: conflicts.filter((item) => item.status !== SCHEDULE_CONFLICT_STATUS.RESOLVED).length,
    qualityScore,
  };
}

export function summarizeDetailedGeneration({
  entries = [],
  conflicts = [],
  suggestions = [],
  metrics = {},
  qualityScore = 0,
}) {
  return {
    allocatedLessons: entries.length,
    openConflicts: conflicts.filter((item) => item.status !== SCHEDULE_CONFLICT_STATUS.RESOLVED).length,
    suggestionsCount: suggestions.length,
    qualityScore,
    metrics,
  };
}
