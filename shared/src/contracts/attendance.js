// Bu proje tamamen Whykthor GSV taraf─▒ndan yap─▒lm─▒┼ƒt─▒r.
export const ATTENDANCE_STATUSES = Object.freeze({
  PRESENT: 'presente',
  ABSENT: 'ausente',
  JUSTIFIED: 'justificado',
  LATE: 'atrasado',
});

export const ATTENDANCE_LESSON_WINDOW_STATES = Object.freeze({
  UNAVAILABLE: 'unavailable',
  UPCOMING: 'upcoming',
  OPEN: 'open',
  LATE: 'late',
});

const VALID_ATTENDANCE_STATUSES = new Set(Object.values(ATTENDANCE_STATUSES));
const ATTENDANCE_DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function getRecordTimestamp(record) {
  return record?.updated_at || record?.created_at || '';
}

export function normalizeAttendanceStatus(status) {
  return VALID_ATTENDANCE_STATUSES.has(status)
    ? status
    : ATTENDANCE_STATUSES.PRESENT;
}

export function isAttendanceDateKey(value) {
  return ATTENDANCE_DATE_KEY_PATTERN.test(String(value || ''));
}

export function getAttendanceDayOfWeek(value) {
  if (!isAttendanceDateKey(value)) {
    return null;
  }

  return new Date(`${value}T12:00:00`).getDay();
}

function toLessonDateTime(date, time) {
  if (!isAttendanceDateKey(date) || typeof time !== 'string' || !time.trim()) {
    return null;
  }

  const parsed = new Date(`${date}T${time}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getAttendanceLessonWindowState({
  date,
  startTime = null,
  endTime = null,
  now = new Date(),
}) {
  const lessonStart = toLessonDateTime(date, startTime);
  const lessonEnd = toLessonDateTime(date, endTime);

  if (!lessonStart || !lessonEnd) {
    return ATTENDANCE_LESSON_WINDOW_STATES.UNAVAILABLE;
  }

  if (now.getTime() < lessonStart.getTime()) {
    return ATTENDANCE_LESSON_WINDOW_STATES.UPCOMING;
  }

  if (now.getTime() <= lessonEnd.getTime()) {
    return ATTENDANCE_LESSON_WINDOW_STATES.OPEN;
  }

  return ATTENDANCE_LESSON_WINDOW_STATES.LATE;
}

export function mapAttendanceRecordsByStudent(records = []) {
  return records.reduce((acc, record) => {
    if (!record?.student_id) return acc;

    const current = acc[record.student_id];
    if (!current || getRecordTimestamp(record) >= getRecordTimestamp(current)) {
      acc[record.student_id] = record;
    }

    return acc;
  }, {});
}

export function buildDailyAttendanceState(students = [], records = []) {
  const initialState = {};

  for (const student of students) {
    if (student?.id) {
      initialState[student.id] = ATTENDANCE_STATUSES.PRESENT;
    }
  }

  const recordsByStudent = mapAttendanceRecordsByStudent(records);

  for (const [studentId, record] of Object.entries(recordsByStudent)) {
    initialState[studentId] = normalizeAttendanceStatus(record?.status);
  }

  return initialState;
}

export function summarizeAttendanceState(attendanceState = {}, students = []) {
  const statuses = Object.values(attendanceState).map(normalizeAttendanceStatus);

  return {
    total: students.length,
    present: statuses.filter((status) => status === ATTENDANCE_STATUSES.PRESENT).length,
    absent: statuses.filter((status) => status === ATTENDANCE_STATUSES.ABSENT).length,
    justified: statuses.filter((status) => status === ATTENDANCE_STATUSES.JUSTIFIED).length,
    late: statuses.filter((status) => status === ATTENDANCE_STATUSES.LATE).length,
  };
}

export function buildDailyAttendancePayloads({
  attendanceState = {},
  classId,
  date,
  teacherId = null,
}) {
  if (!classId) {
    throw new Error('Turma obrigatoria para salvar a chamada.');
  }

  if (!date) {
    throw new Error('Data obrigatoria para salvar a chamada.');
  }

  return Object.entries(attendanceState)
    .filter(([studentId]) => Boolean(studentId))
    .map(([studentId, status]) => ({
      student_id: studentId,
      class_id: classId,
      teacher_id: teacherId || null,
      date,
      status: normalizeAttendanceStatus(status),
      subject_id: null,
      lesson_number: null,
    }));
}

export function buildLessonAttendanceEntries(attendanceState = {}) {
  return Object.entries(attendanceState)
    .filter(([studentId]) => Boolean(studentId))
    .map(([studentId, status]) => ({
      studentId,
      status: normalizeAttendanceStatus(status),
    }));
}

export function buildLessonAttendancePayload({
  attendanceState = {},
  classId,
  subjectId,
  date,
  lessonNumber,
  justification = '',
  notes = '',
}) {
  if (!classId) {
    throw new Error('Turma obrigatoria para salvar a chamada.');
  }

  if (!subjectId) {
    throw new Error('Disciplina obrigatoria para salvar a chamada.');
  }

  if (!isAttendanceDateKey(date)) {
    throw new Error('Data obrigatoria para salvar a chamada.');
  }

  if (!Number.isInteger(lessonNumber) || lessonNumber < 1) {
    throw new Error('Numero da aula obrigatorio para salvar a chamada.');
  }

  return {
    classId,
    subjectId,
    date,
    lessonNumber,
    justification: typeof justification === 'string' ? justification.trim() : '',
    notes: typeof notes === 'string' ? notes.trim() : '',
    entries: buildLessonAttendanceEntries(attendanceState),
  };
}

export function summarizeAttendanceCalendar(records = [], totalStudents = 0) {
  const perDate = {};

  for (const record of records) {
    if (!record?.date || !record?.student_id) continue;

    perDate[record.date] ||= {};

    const current = perDate[record.date][record.student_id];
    if (!current || getRecordTimestamp(record) >= getRecordTimestamp(current)) {
      perDate[record.date][record.student_id] = record;
    }
  }

  return Object.entries(perDate).reduce((acc, [date, recordsByStudent]) => {
    const dayRecords = Object.values(recordsByStudent);
    const statuses = dayRecords.map((record) => normalizeAttendanceStatus(record.status));
    const recordedCount = dayRecords.length;

    acc[date] = {
      recordedCount,
      present: statuses.filter((status) => status === ATTENDANCE_STATUSES.PRESENT).length,
      absent: statuses.filter((status) => status === ATTENDANCE_STATUSES.ABSENT).length,
      justified: statuses.filter((status) => status === ATTENDANCE_STATUSES.JUSTIFIED).length,
      late: statuses.filter((status) => status === ATTENDANCE_STATUSES.LATE).length,
      coverage: recordedCount === 0
        ? 'none'
        : totalStudents > 0 && recordedCount >= totalStudents
          ? 'complete'
          : 'partial',
    };

    return acc;
  }, {});
}
