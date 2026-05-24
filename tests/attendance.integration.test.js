// Bu proje tamamen Whykthor GSV taraf─▒ndan yap─▒lm─▒┼ƒt─▒r.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ATTENDANCE_STATUSES,
  buildDailyAttendancePayloads,
  buildDailyAttendanceState,
  mapAttendanceRecordsByStudent,
  summarizeAttendanceCalendar,
  summarizeAttendanceState,
} from '../shared/src/contracts/attendance.js';

test('daily attendance state defaults active students to presente and keeps saved statuses', () => {
  const state = buildDailyAttendanceState(
    [{ id: 'student-1' }, { id: 'student-2' }, { id: 'student-3' }],
    [
      { student_id: 'student-2', status: 'ausente' },
      { student_id: 'student-3', status: 'atrasado' },
    ],
  );

  assert.deepEqual(state, {
    'student-1': ATTENDANCE_STATUSES.PRESENT,
    'student-2': ATTENDANCE_STATUSES.ABSENT,
    'student-3': ATTENDANCE_STATUSES.LATE,
  });

  assert.deepEqual(
    summarizeAttendanceState(state, [{ id: 'student-1' }, { id: 'student-2' }, { id: 'student-3' }]),
    {
      total: 3,
      present: 1,
      absent: 1,
      justified: 0,
      late: 1,
    },
  );
});

test('daily attendance payloads keep class and student linkage for the selected day', () => {
  const payloads = buildDailyAttendancePayloads({
    attendanceState: {
      'student-1': 'presente',
      'student-2': 'ausente',
    },
    classId: 'class-1',
    date: '2026-03-31',
    teacherId: 'teacher-1',
  });

  assert.deepEqual(payloads, [
    {
      student_id: 'student-1',
      class_id: 'class-1',
      teacher_id: 'teacher-1',
      date: '2026-03-31',
      status: 'presente',
      subject_id: null,
      lesson_number: null,
    },
    {
      student_id: 'student-2',
      class_id: 'class-1',
      teacher_id: 'teacher-1',
      date: '2026-03-31',
      status: 'ausente',
      subject_id: null,
      lesson_number: null,
    },
  ]);
});

test('attendance calendar summary keeps the latest record per student and marks day coverage', () => {
  const records = [
    {
      student_id: 'student-1',
      date: '2026-03-30',
      status: 'presente',
      updated_at: '2026-03-30T08:00:00Z',
    },
    {
      student_id: 'student-1',
      date: '2026-03-30',
      status: 'ausente',
      updated_at: '2026-03-30T10:00:00Z',
    },
    {
      student_id: 'student-2',
      date: '2026-03-30',
      status: 'presente',
      updated_at: '2026-03-30T09:00:00Z',
    },
    {
      student_id: 'student-1',
      date: '2026-03-31',
      status: 'justificado',
      updated_at: '2026-03-31T09:00:00Z',
    },
  ];

  const latestByStudent = mapAttendanceRecordsByStudent(records.filter((record) => record.date === '2026-03-30'));
  assert.equal(latestByStudent['student-1'].status, 'ausente');

  assert.deepEqual(summarizeAttendanceCalendar(records, 2), {
    '2026-03-30': {
      recordedCount: 2,
      present: 1,
      absent: 1,
      justified: 0,
      late: 0,
      coverage: 'complete',
    },
    '2026-03-31': {
      recordedCount: 1,
      present: 0,
      absent: 0,
      justified: 1,
      late: 0,
      coverage: 'partial',
    },
  });
});
