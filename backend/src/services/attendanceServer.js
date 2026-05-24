import { createApiError, createServiceRoleClient, insertManualAuditLog } from '../database/supabaseAdminServer.js';
import { AUDIT_ACTIONS } from '../../../shared/src/auditLog.js';

function toDateOnlyKey(value) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw createApiError('Data de chamada invalida.', {
      statusCode: 400,
      code: 'ATTENDANCE_DATE_INVALID',
    });
  }

  return value;
}

export function getAttendanceDayOfWeek(value) {
  const dateKey = toDateOnlyKey(value);
  return new Date(`${dateKey}T12:00:00`).getDay();
}

function toDateTime(value, time) {
  if (!value || !time) return null;

  const parsed = new Date(`${value}T${time}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeLessonSlotRows(rows = []) {
  return [...rows]
    .filter((row) => row?.subject_id)
    .sort((left, right) => {
      const leftKey = `${left.start_time || ''}-${left.end_time || ''}-${left.subject_id || ''}`;
      const rightKey = `${right.start_time || ''}-${right.end_time || ''}-${right.subject_id || ''}`;
      return leftKey.localeCompare(rightKey, 'pt-BR');
    })
    .map((row, index) => ({
      ...row,
      lesson_number: index + 1,
    }));
}

export async function listScheduleLessonSlots({
  serviceClient,
  classId,
  date,
}) {
  const dayOfWeek = getAttendanceDayOfWeek(date);
  const { data, error } = await serviceClient
    .from('schedules')
    .select('id, class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room, is_active')
    .eq('class_id', classId)
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true)
    .order('start_time', { ascending: true })
    .order('end_time', { ascending: true });

  if (error) {
    throw createApiError(
      error.message || 'Falha ao carregar a grade da turma para a chamada.',
      {
        statusCode: 500,
        code: 'ATTENDANCE_SCHEDULE_LOAD_FAILED',
        cause: error,
      }
    );
  }

  return normalizeLessonSlotRows(data || []);
}

export function resolveLessonSlot(slots = [], { subjectId, lessonNumber }) {
  return slots.find((slot) => (
    slot.subject_id === subjectId
    && Number(slot.lesson_number) === Number(lessonNumber)
  )) || null;
}

export function isLateAttendanceEdit({
  date,
  lessonSlot = null,
  now = new Date(),
}) {
  const lessonEnd = toDateTime(date, lessonSlot?.end_time || null);
  if (!lessonEnd) {
    return false;
  }

  return now.getTime() > lessonEnd.getTime();
}

export async function findTeacherRecordByEmail(serviceClient, email) {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!normalizedEmail) {
    return null;
  }

  const { data, error } = await serviceClient
    .from('teachers')
    .select('id, email, full_name, subject_ids')
    .ilike('email', normalizedEmail)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw createApiError(
      error.message || 'Falha ao localizar o professor autenticado.',
      {
        statusCode: 500,
        code: 'ATTENDANCE_TEACHER_LOAD_FAILED',
        cause: error,
      }
    );
  }

  return data || null;
}

export async function findClassById(serviceClient, classId) {
  const { data, error } = await serviceClient
    .from('classes')
    .select('id, name, coordinator_id, teacher_ids, subject_ids, shift, status')
    .eq('id', classId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw createApiError(
      error.message || 'Falha ao carregar a turma da chamada.',
      {
        statusCode: 500,
        code: 'ATTENDANCE_CLASS_LOAD_FAILED',
        cause: error,
      }
    );
  }

  return data || null;
}

export function assertAttendanceWriteAuthorization({
  requester,
  classRecord,
  teacherRecord = null,
  lessonSlot = null,
  subjectId,
}) {
  if (!classRecord?.id) {
    throw createApiError('Turma informada nao foi encontrada.', {
      statusCode: 404,
      code: 'ATTENDANCE_CLASS_NOT_FOUND',
    });
  }

  const profileType = requester?.profile?.profile_type || null;
  if (profileType !== 'professor') {
    return;
  }

  if (!teacherRecord?.id) {
    throw createApiError('Professor autenticado sem cadastro vinculado na tabela teachers.', {
      statusCode: 403,
      code: 'ATTENDANCE_TEACHER_LINK_REQUIRED',
    });
  }

  const teacherIds = Array.isArray(classRecord.teacher_ids) ? classRecord.teacher_ids : [];
  const subjectIds = Array.isArray(classRecord.subject_ids) ? classRecord.subject_ids : [];
  const classAllowsTeacher = teacherIds.includes(teacherRecord.id) || classRecord.coordinator_id === teacherRecord.id;
  const lessonAllowsTeacher = !lessonSlot?.teacher_id || lessonSlot.teacher_id === teacherRecord.id;
  const subjectAllowsTeacher = subjectIds.length === 0 || subjectIds.includes(subjectId);

  if (!classAllowsTeacher || !lessonAllowsTeacher || !subjectAllowsTeacher) {
    throw createApiError('Voce nao pode registrar chamada para esta aula.', {
      statusCode: 403,
      code: 'ATTENDANCE_LESSON_FORBIDDEN',
    });
  }
}

export async function listActiveStudentsForClass(serviceClient, classId) {
  const { data, error } = await serviceClient
    .from('students')
    .select('id, full_name, registration_number, current_class_id, enrollment_status')
    .eq('current_class_id', classId)
    .eq('enrollment_status', 'ativo')
    .order('full_name', { ascending: true });

  if (error) {
    throw createApiError(
      error.message || 'Falha ao carregar os alunos ativos da turma.',
      {
        statusCode: 500,
        code: 'ATTENDANCE_STUDENTS_LOAD_FAILED',
        cause: error,
      }
    );
  }

  return data || [];
}

export function assertAttendanceEntriesBelongToClass(entries = [], students = []) {
  const allowedIds = new Set(students.map((student) => student.id));
  const invalidStudentId = entries.find((entry) => !allowedIds.has(entry.studentId))?.studentId || null;

  if (invalidStudentId) {
    throw createApiError('A chamada contem aluno fora da turma selecionada.', {
      statusCode: 400,
      code: 'ATTENDANCE_STUDENT_CLASS_MISMATCH',
      details: {
        studentId: invalidStudentId,
      },
    });
  }
}

export async function listExistingLessonAttendance(serviceClient, {
  classId,
  subjectId,
  date,
  lessonNumber,
  studentIds,
}) {
  let query = serviceClient
    .from('attendance')
    .select('*')
    .eq('class_id', classId)
    .eq('subject_id', subjectId)
    .eq('date', date)
    .eq('lesson_number', lessonNumber)
    .order('updated_at', { ascending: false });

  if (Array.isArray(studentIds) && studentIds.length > 0) {
    query = query.in('student_id', studentIds);
  }

  const { data, error } = await query;

  if (error) {
    throw createApiError(
      error.message || 'Falha ao carregar os registros atuais da chamada.',
      {
        statusCode: 500,
        code: 'ATTENDANCE_CURRENT_LOAD_FAILED',
        cause: error,
      }
    );
  }

  return data || [];
}

function mapLatestAttendanceByStudent(records = []) {
  return records.reduce((accumulator, record) => {
    if (!record?.student_id) return accumulator;

    if (!accumulator[record.student_id]) {
      accumulator[record.student_id] = record;
    }

    return accumulator;
  }, {});
}

export async function upsertLessonAttendance({
  serviceClient,
  classId,
  subjectId,
  date,
  lessonNumber,
  teacherId = null,
  justification = null,
  notes = null,
  entries = [],
}) {
  const existingRecords = await listExistingLessonAttendance(serviceClient, {
    classId,
    subjectId,
    date,
    lessonNumber,
    studentIds: entries.map((entry) => entry.studentId),
  });

  const latestByStudent = mapLatestAttendanceByStudent(existingRecords);
  const savedRecords = [];

  for (const entry of entries) {
    const payload = {
      student_id: entry.studentId,
      class_id: classId,
      subject_id: subjectId,
      teacher_id: teacherId,
      date,
      status: entry.status,
      lesson_number: lessonNumber,
      justification: justification || null,
      notes: notes || null,
    };

    const existing = latestByStudent[entry.studentId];
    const operation = existing?.id
      ? serviceClient.from('attendance').update(payload).eq('id', existing.id)
      : serviceClient.from('attendance').insert(payload);

    const { data, error } = await operation.select('*').single();

    if (error) {
      throw createApiError(
        error.message || 'Falha ao salvar a chamada da aula.',
        {
          statusCode: 500,
          code: 'ATTENDANCE_SAVE_FAILED',
          cause: error,
          details: {
            studentId: entry.studentId,
          },
        }
      );
    }

    savedRecords.push(data);
  }

  return {
    existingRecords,
    savedRecords,
  };
}

export async function insertAttendanceAuditLog({
  requester,
  classRecord,
  subjectId,
  date,
  lessonNumber,
  previousRecords = [],
  savedRecords = [],
  justification = null,
  lateEdit = false,
}) {
  const action = previousRecords.length > 0 ? AUDIT_ACTIONS.UPDATE : AUDIT_ACTIONS.CREATE;
  const recordId = `${classRecord?.id || 'unknown'}:${date}:${subjectId}:${lessonNumber}`;

  const summarize = (records) => ({
    total: records.length,
    present: records.filter((record) => record?.status === 'presente').length,
    absent: records.filter((record) => record?.status === 'ausente').length,
    justified: records.filter((record) => record?.status === 'justificado').length,
    late: records.filter((record) => record?.status === 'atrasado').length,
  });

  await insertManualAuditLog({
    actor: requester,
    action,
    entityTable: 'attendance',
    recordId,
    previousRecord: {
      class_id: classRecord?.id || null,
      class_name: classRecord?.name || null,
      date,
      subject_id: subjectId,
      lesson_number: lessonNumber,
      summary: summarize(previousRecords),
    },
    newRecord: {
      class_id: classRecord?.id || null,
      class_name: classRecord?.name || null,
      date,
      subject_id: subjectId,
      lesson_number: lessonNumber,
      summary: summarize(savedRecords),
    },
    metadata: {
      source: 'api/attendance/lesson',
      late_edit: lateEdit,
      justification: justification || null,
      changed_student_count: savedRecords.length,
    },
  });
}

export async function createAttendanceServiceClient(auditActor = null) {
  return createServiceRoleClient(auditActor);
}
