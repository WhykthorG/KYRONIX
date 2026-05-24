// ßâ×ßâáßâØßâößâÑßâóßâÿ ßâößâÑßâíßâÖßâÜßâúßâûßâÿßâúßâáßâÉßâô Whykthor GSV-ßâÿßâí ßâøßâÿßâößâá ßâ¿ßâößâÿßâÑßâøßâ£ßâÉ.
export const GRADE_STATUSES = Object.freeze({
  DRAFT: 'rascunho',
  PUBLISHED: 'publicado',
  REVIEWED: 'revisado',
});

export const GRADE_STATUS_ALIASES = Object.freeze({
  publicada: GRADE_STATUSES.PUBLISHED,
});

export const GRADE_SLOTS = Object.freeze([
  'atividade_1',
  'atividade_2',
  'atividade_3',
  'atividade_4',
  'recuperacao',
]);

export const REGULAR_GRADE_SLOTS = Object.freeze(GRADE_SLOTS.slice(0, 4));
export const RECOVERY_GRADE_SLOT = 'recuperacao';
export const MIN_REGULAR_GRADES = 3;
export const PASSING_GRADE = 7;
export const RECOVERY_GRADE = 5;

export const GRADE_SLOT_LABELS = Object.freeze({
  atividade_1: 'Atividade 1',
  atividade_2: 'Atividade 2',
  atividade_3: 'Atividade 3',
  atividade_4: 'Atividade 4',
  recuperacao: 'Recuperação',
});

export const GRADE_SITUATIONS = Object.freeze({
  INCOMPLETE: 'incompleta',
  APPROVED: 'aprovado',
  RECOVERY: 'recuperacao',
  FAILED: 'reprovado',
});

export function normalizeGradeStatus(status) {
  if (!status) return GRADE_STATUSES.DRAFT;
  return GRADE_STATUS_ALIASES[status] ?? status;
}

export function isGradePublished(grade) {
  return normalizeGradeStatus(grade?.status) === GRADE_STATUSES.PUBLISHED;
}

export function filterGradesVisibleToStudent(grades = [], studentId) {
  return grades.filter((grade) => (
    grade?.student_id === studentId && isGradePublished(grade)
  ));
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function toNumericScore(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function average(values = []) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function normalizeGradeSlot(input) {
  if (!input) return null;

  if (typeof input === 'string') {
    return GRADE_SLOTS.includes(input) ? input : null;
  }

  if (GRADE_SLOTS.includes(input.grade_slot)) {
    return input.grade_slot;
  }

  const normalizedType = normalizeText(input.evaluation_type);
  if (normalizedType === RECOVERY_GRADE_SLOT || normalizedType === 'recuperacao') {
    return RECOVERY_GRADE_SLOT;
  }

  const normalizedName = normalizeText(input.evaluation_name);
  if (normalizedName.includes('recuper')) {
    return RECOVERY_GRADE_SLOT;
  }

  const activityMatch = normalizedName.match(/atividade\s*([1-4])/);
  if (activityMatch) {
    return `atividade_${activityMatch[1]}`;
  }

  const evaluationMatch = normalizedName.match(/avaliac[aã]o\s*([1-4])/);
  if (evaluationMatch) {
    return `atividade_${evaluationMatch[1]}`;
  }

  return null;
}

function selectNewestGrade(currentGrade, nextGrade) {
  if (!currentGrade) return nextGrade;

  const currentTime = new Date(
    currentGrade.updated_at
    || currentGrade.created_at
    || currentGrade.evaluation_date
    || 0
  ).getTime();

  const nextTime = new Date(
    nextGrade.updated_at
    || nextGrade.created_at
    || nextGrade.evaluation_date
    || 0
  ).getTime();

  return nextTime >= currentTime ? nextGrade : currentGrade;
}

export function buildBimesterGradeSummary(grades = []) {
  const slotGrades = REGULAR_GRADE_SLOTS.reduce((accumulator, slot) => ({
    ...accumulator,
    [slot]: null,
  }), {
    [RECOVERY_GRADE_SLOT]: null,
  });
  const legacyGrades = [];

  grades.forEach((grade) => {
    const slot = normalizeGradeSlot(grade);
    if (slot) {
      slotGrades[slot] = selectNewestGrade(slotGrades[slot], grade);
      return;
    }

    legacyGrades.push(grade);
  });

  const regularScores = REGULAR_GRADE_SLOTS
    .map((slot) => toNumericScore(slotGrades[slot]?.score))
    .filter((score) => score !== null);

  const legacyScores = legacyGrades
    .map((grade) => toNumericScore(grade?.score))
    .filter((score) => score !== null);

  const hasLegacyAverage = legacyScores.length > 0 && regularScores.length === 0;
  const enteredRegularCount = hasLegacyAverage ? legacyScores.length : regularScores.length;
  const minimumActivitiesMet = hasLegacyAverage || enteredRegularCount >= MIN_REGULAR_GRADES;
  const partialAverage = average(regularScores);
  const legacyAverage = average(legacyScores);
  const baseAverage = enteredRegularCount > 0
    ? (minimumActivitiesMet ? partialAverage : null)
    : legacyAverage;
  const resolvedBaseAverage = hasLegacyAverage ? legacyAverage : baseAverage;
  const recoveryScore = toNumericScore(slotGrades[RECOVERY_GRADE_SLOT]?.score);

  let finalAverage = resolvedBaseAverage;
  let usedRecovery = false;

  if (resolvedBaseAverage !== null && recoveryScore !== null && resolvedBaseAverage < PASSING_GRADE) {
    finalAverage = Math.max(resolvedBaseAverage, (resolvedBaseAverage + recoveryScore) / 2);
    usedRecovery = true;
  }

  let situation = GRADE_SITUATIONS.INCOMPLETE;
  if (finalAverage !== null) {
    if (finalAverage >= PASSING_GRADE) {
      situation = GRADE_SITUATIONS.APPROVED;
    } else if (finalAverage >= RECOVERY_GRADE) {
      situation = GRADE_SITUATIONS.RECOVERY;
    } else {
      situation = GRADE_SITUATIONS.FAILED;
    }
  }

  return {
    slots: slotGrades,
    legacyGrades,
    enteredRegularCount,
    minimumActivitiesMet,
    partialAverage,
    baseAverage: resolvedBaseAverage,
    recoveryScore,
    finalAverage,
    usedRecovery,
    missingRegularCount: minimumActivitiesMet ? 0 : Math.max(0, MIN_REGULAR_GRADES - enteredRegularCount),
    situation,
  };
}

export function getGradeSituationLabel(situation) {
  switch (situation) {
    case GRADE_SITUATIONS.APPROVED:
      return 'Aprovado';
    case GRADE_SITUATIONS.RECOVERY:
      return 'Recuperação';
    case GRADE_SITUATIONS.FAILED:
      return 'Reprovado';
    default:
      return 'Em lançamento';
  }
}

export function getGradeSituationBadgeClassName(situation) {
  switch (situation) {
    case GRADE_SITUATIONS.APPROVED:
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case GRADE_SITUATIONS.RECOVERY:
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case GRADE_SITUATIONS.FAILED:
      return 'bg-rose-100 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export function buildTermKey({
  studentId,
  subjectId,
  classId,
  bimester,
  year,
}) {
  return [
    studentId || '',
    subjectId || '',
    classId || '',
    bimester || '',
    year || '',
  ].join('::');
}

export function buildGradebookSummaryMap(grades = []) {
  const map = new Map();

  grades.forEach((grade) => {
    const key = buildTermKey({
      studentId: grade.student_id,
      subjectId: grade.subject_id,
      classId: grade.class_id,
      bimester: grade.bimester,
      year: grade.year,
    });

    if (!map.has(key)) {
      map.set(key, []);
    }

    map.get(key).push(grade);
  });

  return new Map(
    [...map.entries()].map(([key, gradeList]) => [key, buildBimesterGradeSummary(gradeList)])
  );
}

export function getTermSummary(summaryMap, {
  studentId,
  subjectId,
  classId,
  bimester,
  year,
}) {
  return summaryMap.get(buildTermKey({
    studentId,
    subjectId,
    classId,
    bimester,
    year,
  })) || buildBimesterGradeSummary([]);
}

export function buildStudentReportCardRows({
  grades = [],
  studentId,
  subjects = [],
}) {
  const visibleGrades = filterGradesVisibleToStudent(grades, studentId);
  const summaryMap = buildGradebookSummaryMap(visibleGrades);
  const subjectIds = [...new Set(visibleGrades.map((grade) => grade.subject_id).filter(Boolean))];

  return subjectIds
    .sort((leftId, rightId) => {
      const leftName = subjects.find((subject) => subject.id === leftId)?.name || '';
      const rightName = subjects.find((subject) => subject.id === rightId)?.name || '';
      return leftName.localeCompare(rightName, 'pt-BR');
    })
    .map((subjectId) => {
      const subjectGrades = visibleGrades.filter((grade) => grade.subject_id === subjectId);
      const classId = subjectGrades[0]?.class_id || null;
      const year = subjectGrades[0]?.year || null;

      const bimesterSummaries = {
        1: getTermSummary(summaryMap, { studentId, subjectId, classId, bimester: 1, year }),
        2: getTermSummary(summaryMap, { studentId, subjectId, classId, bimester: 2, year }),
        3: getTermSummary(summaryMap, { studentId, subjectId, classId, bimester: 3, year }),
        4: getTermSummary(summaryMap, { studentId, subjectId, classId, bimester: 4, year }),
      };

      const bimesterAverages = Object.values(bimesterSummaries)
        .map((summary) => summary.finalAverage)
        .filter((value) => value !== null);

      const annualAverage = average(bimesterAverages);
      const finalSituation = annualAverage === null
        ? GRADE_SITUATIONS.INCOMPLETE
        : annualAverage >= PASSING_GRADE
          ? GRADE_SITUATIONS.APPROVED
          : annualAverage >= RECOVERY_GRADE
            ? GRADE_SITUATIONS.RECOVERY
            : GRADE_SITUATIONS.FAILED;

      return {
        subjectId,
        subjectName: subjects.find((subject) => subject.id === subjectId)?.name || 'Disciplina',
        b1: bimesterSummaries[1].finalAverage,
        b2: bimesterSummaries[2].finalAverage,
        b3: bimesterSummaries[3].finalAverage,
        b4: bimesterSummaries[4].finalAverage,
        annualAverage,
        situation: finalSituation,
      };
    });
}

export function buildGradePayload({
  existingGrade = null,
  studentId,
  classId,
  subjectId,
  teacherId = null,
  bimester,
  year,
  slot,
  score,
  assignment = null,
  status = GRADE_STATUSES.PUBLISHED,
}) {
  const resolvedScore = toNumericScore(score);

  return {
    ...(existingGrade?.id ? { id: existingGrade.id } : {}),
    student_id: studentId,
    class_id: classId,
    subject_id: subjectId,
    teacher_id: teacherId,
    assignment_id: assignment?.id || null,
    grade_slot: slot,
    bimester,
    year,
    score: resolvedScore,
    max_score: assignment?.max_score ?? existingGrade?.max_score ?? 10,
    weight: assignment?.weight ?? existingGrade?.weight ?? 1,
    evaluation_type: slot === RECOVERY_GRADE_SLOT ? 'recuperacao' : 'atividade',
    evaluation_name: assignment?.title || GRADE_SLOT_LABELS[slot] || existingGrade?.evaluation_name || 'Avaliação',
    evaluation_date: existingGrade?.evaluation_date || new Date().toISOString().slice(0, 10),
    status,
  };
}
