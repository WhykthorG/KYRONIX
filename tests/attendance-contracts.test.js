import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ATTENDANCE_LESSON_WINDOW_STATES,
  ATTENDANCE_STATUSES,
  buildLessonAttendancePayload,
  getAttendanceDayOfWeek,
  getAttendanceLessonWindowState,
} from '../shared/src/contracts/attendance.js';

test('getAttendanceDayOfWeek resolves Sunday-based day index from date key', () => {
  assert.equal(getAttendanceDayOfWeek('2026-05-04'), 1);
});

test('getAttendanceLessonWindowState returns late when current time is after lesson end', () => {
  const state = getAttendanceLessonWindowState({
    date: '2026-05-03',
    startTime: '07:00:00',
    endTime: '07:50:00',
    now: new Date('2026-05-03T08:10:00'),
  });

  assert.equal(state, ATTENDANCE_LESSON_WINDOW_STATES.LATE);
});

test('buildLessonAttendancePayload normalizes entries and trims optional fields', () => {
  const payload = buildLessonAttendancePayload({
    attendanceState: {
      'student-1': ATTENDANCE_STATUSES.ABSENT,
      'student-2': 'valor-invalido',
    },
    classId: '550e8400-e29b-41d4-a716-446655440031',
    subjectId: '550e8400-e29b-41d4-a716-446655440021',
    date: '2026-05-03',
    lessonNumber: 2,
    justification: '  ajuste tardio  ',
    notes: '  observacao  ',
  });

  assert.deepEqual(payload, {
    classId: '550e8400-e29b-41d4-a716-446655440031',
    subjectId: '550e8400-e29b-41d4-a716-446655440021',
    date: '2026-05-03',
    lessonNumber: 2,
    justification: 'ajuste tardio',
    notes: 'observacao',
    entries: [
      { studentId: 'student-1', status: ATTENDANCE_STATUSES.ABSENT },
      { studentId: 'student-2', status: ATTENDANCE_STATUSES.PRESENT },
    ],
  });
});
