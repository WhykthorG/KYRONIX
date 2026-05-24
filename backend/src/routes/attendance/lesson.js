import { getAuditActorFromRequester, handleApiError, requirePermissionRequest, sendJson } from '../../database/supabaseAdminServer.js';
import { enforceRequestSecurity } from '../../middlewares/requestSecurity.js';
import {
  assertAttendanceEntriesBelongToClass,
  assertAttendanceWriteAuthorization,
  createAttendanceServiceClient,
  findClassById,
  findTeacherRecordByEmail,
  insertAttendanceAuditLog,
  isLateAttendanceEdit,
  listActiveStudentsForClass,
  listScheduleLessonSlots,
  resolveLessonSlot,
  upsertLessonAttendance,
} from '../../services/attendanceServer.js';
import { PERMISSIONS } from '../../../../shared/src/contracts/access.js';
import { attendanceLessonSaveSchema, parseRequestSchema } from '../../middlewares/requestSchemas.js';
import { createApiError } from '../../database/supabaseAdminServer.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { error: 'Metodo nao permitido.' });
    }

    const requester = await requirePermissionRequest(req, PERMISSIONS.ATTENDANCE_WRITE);
    await enforceRequestSecurity({
      req,
      requester,
      routeKey: 'api/attendance/lesson',
      action: 'write',
      metadata: {
        entity: 'attendance',
        mode: 'lesson',
      },
    });

    const payload = parseRequestSchema(attendanceLessonSaveSchema, req.body || {}, {
      code: 'ATTENDANCE_LESSON_PAYLOAD_INVALID',
      message: 'Payload da chamada por aula invalido.',
    });

    const auditActor = getAuditActorFromRequester(requester);
    const serviceClient = await createAttendanceServiceClient(auditActor);
    const classRecord = await findClassById(serviceClient, payload.classId);
    const scheduleSlots = await listScheduleLessonSlots({
      serviceClient,
      classId: payload.classId,
      date: payload.date,
    });
    const lessonSlot = resolveLessonSlot(scheduleSlots, {
      subjectId: payload.subjectId,
      lessonNumber: payload.lessonNumber,
    });
    const teacherRecord = requester.profile?.profile_type === 'professor'
      ? await findTeacherRecordByEmail(serviceClient, requester.user?.email || null)
      : null;

    assertAttendanceWriteAuthorization({
      requester,
      classRecord,
      teacherRecord,
      lessonSlot,
      subjectId: payload.subjectId,
    });

    if (scheduleSlots.length > 0 && !lessonSlot) {
      throw createApiError('Disciplina ou aula incompatível com a grade da turma para esta data.', {
        statusCode: 400,
        code: 'ATTENDANCE_LESSON_SLOT_INVALID',
      });
    }

    const activeStudents = await listActiveStudentsForClass(serviceClient, payload.classId);
    assertAttendanceEntriesBelongToClass(payload.entries, activeStudents);

    const lateEdit = isLateAttendanceEdit({
      date: payload.date,
      lessonSlot,
    });

    if (lateEdit && !payload.justification?.trim()) {
      throw createApiError('Justificativa obrigatoria para editar a chamada fora do horario da aula.', {
        statusCode: 400,
        code: 'ATTENDANCE_JUSTIFICATION_REQUIRED',
      });
    }

    const { existingRecords, savedRecords } = await upsertLessonAttendance({
      serviceClient,
      classId: payload.classId,
      subjectId: payload.subjectId,
      date: payload.date,
      lessonNumber: payload.lessonNumber,
      teacherId: teacherRecord?.id || lessonSlot?.teacher_id || null,
      justification: payload.justification?.trim() || null,
      notes: payload.notes?.trim() || null,
      entries: payload.entries,
    });

    await insertAttendanceAuditLog({
      requester: auditActor,
      classRecord,
      subjectId: payload.subjectId,
      date: payload.date,
      lessonNumber: payload.lessonNumber,
      previousRecords: existingRecords,
      savedRecords,
      justification: payload.justification?.trim() || null,
      lateEdit,
    });

    return sendJson(res, 200, {
      success: true,
      lateEdit,
      savedCount: savedRecords.length,
      lesson: lessonSlot ? {
        subjectId: lessonSlot.subject_id,
        lessonNumber: lessonSlot.lesson_number,
        startTime: lessonSlot.start_time,
        endTime: lessonSlot.end_time,
      } : {
        subjectId: payload.subjectId,
        lessonNumber: payload.lessonNumber,
        startTime: null,
        endTime: null,
      },
    });
  } catch (error) {
    return handleApiError(res, error);
  }
}
