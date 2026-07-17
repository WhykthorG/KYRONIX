// Bu proje tamamen Whykthor GSV taraf─▒ndan yap─▒lm─▒┼ƒt─▒r.
import { ATTENDANCE_STATUSES, mapAttendanceRecordsByStudent, normalizeAttendanceStatus } from './attendance.js';
import { buildStudentReportCardRows, normalizeGradeStatus } from './grades.js';


export const DEFAULT_PDF_LAYOUT_OPTIONS = Object.freeze({
  headerTitle: 'KYRONIX S.E.N.O',
  headerSubtitle: 'Relatorios escolares',
  footerLeft: 'Gerado automaticamente pelo KYRONIX S.E.N.O',
  footerRight: '',
});

export function normalizePdfLayoutOptions(options = {}) {
  return {
    headerTitle: String(options.headerTitle ?? DEFAULT_PDF_LAYOUT_OPTIONS.headerTitle).trim() || DEFAULT_PDF_LAYOUT_OPTIONS.headerTitle,
    headerSubtitle: String(options.headerSubtitle ?? DEFAULT_PDF_LAYOUT_OPTIONS.headerSubtitle).trim() || DEFAULT_PDF_LAYOUT_OPTIONS.headerSubtitle,
    footerLeft: String(options.footerLeft ?? DEFAULT_PDF_LAYOUT_OPTIONS.footerLeft).trim() || DEFAULT_PDF_LAYOUT_OPTIONS.footerLeft,
    footerRight: String(options.footerRight ?? DEFAULT_PDF_LAYOUT_OPTIONS.footerRight).trim(),
  };
}

export function getAttendanceStatusLabel(status) {
  switch (normalizeAttendanceStatus(status)) {
    case ATTENDANCE_STATUSES.ABSENT:
      return 'Ausente';
    case ATTENDANCE_STATUSES.JUSTIFIED:
      return 'Justificado';
    case ATTENDANCE_STATUSES.LATE:
      return 'Atrasado';
    case ATTENDANCE_STATUSES.PRESENT:
      return 'Presente';
    default:
      return 'Nao registrado';
  }
}

export function buildAttendanceSummary(attendance = []) {
  const statuses = attendance.map((item) => normalizeAttendanceStatus(item?.status));
  const total = statuses.length;
  const present = statuses.filter((status) => [ATTENDANCE_STATUSES.PRESENT, ATTENDANCE_STATUSES.LATE].includes(status)).length;
  const absent = statuses.filter((status) => status === ATTENDANCE_STATUSES.ABSENT).length;
  const justified = statuses.filter((status) => status === ATTENDANCE_STATUSES.JUSTIFIED).length;
  const late = statuses.filter((status) => status === ATTENDANCE_STATUSES.LATE).length;

  return {
    total,
    present,
    absent,
    justified,
    late,
    rate: total > 0 ? Math.round((present / total) * 100) : 0,
  };
}

export function buildStudentReportCardPdfModel({
  student,
  grades = [],
  attendance = [],
  subjects = [],
  className = '',
}) {
  const rows = buildStudentReportCardRows({
    grades,
    studentId: student?.id,
    subjects,
  }).map((row) => ({
    subjectName: row.subjectName,
    b1: row.b1 === null ? '-' : Number(row.b1).toFixed(1),
    b2: row.b2 === null ? '-' : Number(row.b2).toFixed(1),
    b3: row.b3 === null ? '-' : Number(row.b3).toFixed(1),
    b4: row.b4 === null ? '-' : Number(row.b4).toFixed(1),
    average: row.annualAverage === null ? '-' : Number(row.annualAverage).toFixed(1),
    situation:
      row.situation === 'aprovado' ? 'Aprovado'
      : row.situation === 'recuperacao' ? 'Recuperacao'
      : row.situation === 'reprovado' ? 'Reprovado'
      : 'Em lancamento',
  }));

  const rowsWithAverage = rows.filter((row) => row.average !== '-');
  const overallAverage = rowsWithAverage.length > 0
    ? (
      rowsWithAverage.reduce((sum, row) => sum + Number(row.average), 0)
      / rowsWithAverage.length
    ).toFixed(1)
    : '-';

  return {
    studentName: student?.full_name || 'Aluno',
    registrationNumber: student?.registration_number || '-',
    className: className || '-',
    overallAverage,
    attendanceSummary: buildAttendanceSummary(attendance),
    rows,
  };
}

export function buildAttendanceListRows({ students = [], attendanceRecords = [] }) {
  const recordsByStudent = mapAttendanceRecordsByStudent(attendanceRecords);

  return students.map((student, index) => {
    const record = recordsByStudent[student.id];
    const status = record?.status || null;

    return {
      index: index + 1,
      studentName: student.full_name || 'Aluno',
      registrationNumber: student.registration_number || '-',
      status: status || 'nao_registrado',
      statusLabel: record ? getAttendanceStatusLabel(status) : 'Nao registrado',
    };
  });
}

export function sanitizePdfFilename(value, fallback = 'relatorio') {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
}

function formatGuardianReportDate(value) {
  if (value == null || value === '') return '-';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('pt-BR');
  } catch {
    return String(value);
  }
}

function normalizeGuardianMonthlyOccurrences(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const dateVal = item?.date || item?.occurred_at || item?.created_at;
    return {
      date: dateVal ? formatGuardianReportDate(dateVal) : '-',
      title: String(item?.title || item?.type || `Ocorrencia ${index + 1}`),
      detail: String(item?.description || item?.detail || item?.notes || '-').slice(0, 500),
    };
  });
}

function capitalizeSentence(value) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getMonthKey(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}$/.test(value)) {
    return value;
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value.slice(0, 7);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(monthKey) {
  if (!monthKey) return '-';
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey;
  return capitalizeSentence(
    new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    }),
  );
}

function formatGradeStatusLabel(status) {
  switch (normalizeGradeStatus(status)) {
    case 'publicado':
      return 'Publicado';
    case 'revisado':
      return 'Revisado';
    default:
      return 'Em lançamento';
  }
}

function formatOccurrenceLabel(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '-';
  return capitalizeSentence(normalized);
}

function formatClassName(reportData, student) {
  if (reportData.className) return reportData.className;
  if (reportData.classRecord?.name) {
    return [
      reportData.classRecord.name,
      reportData.classRecord.year,
    ].filter(Boolean).join(' - ');
  }
  if (reportData.class?.name) return reportData.class.name;
  if (student.class_name) return student.class_name;
  return '-';
}

function formatScoreLabel(score, maxScore) {
  const numericScore = Number(score);
  const numericMaxScore = Number(maxScore ?? 10);
  if (!Number.isFinite(numericScore)) return '-';
  return `${numericScore.toFixed(1)} / ${Number.isFinite(numericMaxScore) ? numericMaxScore.toFixed(1) : '10.0'}`;
}

function formatBimesterLabel(bimester) {
  return bimester ? `${bimester}B` : '-';
}

/**
 * Normaliza o payload de GET /api/guardian/monthly-report para o gerador de PDF.
 */
export function buildGuardianMonthlyStudentReportPdfModel(reportData = {}) {
  const student = reportData.student && typeof reportData.student === 'object' ? reportData.student : {};
  const monthKey = getMonthKey(reportData.month || reportData.referenceMonth || '');
  const grades = Array.isArray(reportData.grades) ? reportData.grades : [];
  const attendance = Array.isArray(reportData.attendance)
    ? reportData.attendance
    : Array.isArray(reportData.attendanceRecords)
      ? reportData.attendanceRecords
      : [];
  const subjects = Array.isArray(reportData.subjects) ? reportData.subjects : [];
  const className = formatClassName(reportData, student);

  const studentId = student.id || reportData.studentId || null;
  const subjectsById = Object.fromEntries(subjects.map((subject) => [subject.id, subject]));
  const monthlyGrades = grades.filter((grade) => (
    getMonthKey(grade?.evaluation_date || grade?.created_at || grade?.updated_at) === monthKey
      && ['publicado', 'revisado'].includes(normalizeGradeStatus(grade?.status))
  ));
  const monthlyAttendance = attendance.filter((record) => (
    getMonthKey(record?.date || record?.created_at || record?.updated_at) === monthKey
  ));
  const monthlyOccurrencesRaw = Array.isArray(reportData.occurrences)
    ? reportData.occurrences
    : Array.isArray(reportData.events)
      ? reportData.events
      : [];
  const monthlyOccurrences = monthlyOccurrencesRaw.filter((item) => (
    getMonthKey(item?.date || item?.occurred_at || item?.created_at) === monthKey
  ));

  const rows = buildStudentReportCardRows({
    grades,
    studentId,
    subjects,
  }).map((row) => ({
    subjectName: row.subjectName,
    b1: row.b1 === null ? '-' : Number(row.b1).toFixed(1),
    b2: row.b2 === null ? '-' : Number(row.b2).toFixed(1),
    b3: row.b3 === null ? '-' : Number(row.b3).toFixed(1),
    b4: row.b4 === null ? '-' : Number(row.b4).toFixed(1),
    average: row.annualAverage === null ? '-' : Number(row.annualAverage).toFixed(1),
    situation:
      row.situation === 'aprovado' ? 'Aprovado'
      : row.situation === 'recuperacao' ? 'Recuperacao'
      : row.situation === 'reprovado' ? 'Reprovado'
      : 'Em lancamento',
  }));

  const rowsWithAverage = rows.filter((row) => row.average !== '-');
  const overallAverage = rowsWithAverage.length > 0
    ? (
      rowsWithAverage.reduce((sum, row) => sum + Number(row.average), 0)
      / rowsWithAverage.length
    ).toFixed(1)
    : '-';
  const monthLabel = formatMonthLabel(monthKey);

  const gradeRows = monthlyGrades
    .sort((left, right) => String(left?.evaluation_date || '').localeCompare(String(right?.evaluation_date || '')))
    .map((grade) => ({
      date: formatGuardianReportDate(grade?.evaluation_date || grade?.created_at),
      subjectName: subjectsById[grade?.subject_id]?.name || 'Disciplina',
      evaluationName: String(grade?.evaluation_name || 'Avaliação'),
      bimesterLabel: formatBimesterLabel(grade?.bimester),
      scoreLabel: formatScoreLabel(grade?.score, grade?.max_score),
      statusLabel: formatGradeStatusLabel(grade?.status),
    }));

  const gradeSummaryScores = monthlyGrades
    .map((grade) => Number(grade?.score))
    .filter((score) => Number.isFinite(score));

  const gradeSummary = {
    total: gradeRows.length,
    average: gradeSummaryScores.length
      ? (gradeSummaryScores.reduce((sum, value) => sum + value, 0) / gradeSummaryScores.length).toFixed(1)
      : '-',
    highest: gradeSummaryScores.length ? Math.max(...gradeSummaryScores).toFixed(1) : '-',
    lowest: gradeSummaryScores.length ? Math.min(...gradeSummaryScores).toFixed(1) : '-',
  };

  const attendanceRows = monthlyAttendance
    .filter((record) => normalizeAttendanceStatus(record?.status) !== ATTENDANCE_STATUSES.PRESENT)
    .sort((left, right) => String(left?.date || '').localeCompare(String(right?.date || '')))
    .map((record) => ({
      date: formatGuardianReportDate(record?.date || record?.created_at),
      subjectName: subjectsById[record?.subject_id]?.name || 'Disciplina',
      statusLabel: getAttendanceStatusLabel(record?.status),
      justification: String(record?.justification || '-'),
    }));

  const normalizedOccurrences = normalizeGuardianMonthlyOccurrences(monthlyOccurrences);
  const occurrenceRows = monthlyOccurrences
    .sort((left, right) => String(left?.date || '').localeCompare(String(right?.date || '')))
    .map((item) => ({
      date: formatGuardianReportDate(item?.date || item?.created_at),
      typeLabel: formatOccurrenceLabel(item?.type),
      severityLabel: formatOccurrenceLabel(item?.severity),
      title: String(item?.title || '-'),
      statusLabel: formatOccurrenceLabel(item?.status),
    }));
  const occurrenceSummary = {
    total: occurrenceRows.length,
    open: monthlyOccurrences.filter((item) => String(item?.status || '').toLowerCase() === 'aberta').length,
    resolved: monthlyOccurrences.filter((item) => String(item?.status || '').toLowerCase() === 'resolvida').length,
    critical: monthlyOccurrences.filter((item) => String(item?.severity || '').toLowerCase() === 'critica').length,
  };

  return {
    studentName: student.full_name || reportData.studentName || 'Aluno',
    registrationNumber: student.registration_number || reportData.registrationNumber || '-',
    className,
    monthKey,
    monthLabel,
    overallAverage,
    gradeSummary,
    attendanceSummary: buildAttendanceSummary(monthlyAttendance),
    occurrenceSummary,
    rows,
    gradeRows,
    attendanceRows,
    occurrenceRows,
    occurrences: normalizedOccurrences,
  };
}
