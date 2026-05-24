// ßâ×ßâáßâØßâößâÑßâóßâÿ ßâößâÑßâíßâÖßâÜßâúßâûßâÿßâúßâáßâÉßâô Whykthor GSV-ßâÿßâí ßâøßâÿßâößâá ßâ¿ßâößâÿßâÑßâøßâ£ßâÉ.
import {
  createApiError,
  createRequestScopedClient,
  handleApiError,
  requireAuthenticatedRequest,
  sendJson,
} from '../../database/supabaseAdminServer.js';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function getMonthRange(month) {
  if (!MONTH_PATTERN.test(String(month || ''))) {
    return null;
  }

  const start = new Date(`${month}-01T00:00:00`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { start, end };
}

function normalizeDate(value) {
  if (!value) return null;

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00`);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isWithinMonth(value, month) {
  const range = getMonthRange(month);
  const date = normalizeDate(value);
  if (!range || !date) return false;
  return date >= range.start && date < range.end;
}

export default async function handler(req, res) {
  try {
    const requester = await requireAuthenticatedRequest(req);

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return sendJson(res, 405, { error: 'Metodo nao permitido.' });
    }

    if (requester.profile?.profile_type !== 'responsavel' || requester.profile?.status !== 'ativo') {
      return sendJson(res, 403, { error: 'Voce nao tem permissao para acessar relatorios do portal.' });
    }

    const studentId = typeof req.query?.studentId === 'string' ? req.query.studentId.trim() : '';
    const month = typeof req.query?.month === 'string' ? req.query.month.trim() : '';

    if (!studentId || !MONTH_PATTERN.test(month)) {
      return sendJson(res, 400, { error: 'studentId e month no formato yyyy-mm sao obrigatorios.' });
    }

    const serviceClient = createRequestScopedClient(req);
    const { data: linkedStudents, error: linkedStudentsError } = await serviceClient
      .rpc('list_guardian_portal_students');

    if (linkedStudentsError) {
      throw createApiError(
        linkedStudentsError.message || 'Falha ao validar o vinculo do responsavel.',
        {
          statusCode: 500,
          code: 'GUARDIAN_LINK_LOAD_FAILED',
          cause: linkedStudentsError,
        }
      );
    }

    const student = (linkedStudents || []).find((item) => item.id === studentId) || null;
    if (!student?.id) {
      return sendJson(res, 403, { error: 'Aluno nao vinculado a este responsavel.' });
    }

    const [
      classResult,
      gradesResult,
      attendanceResult,
      occurrencesResult,
    ] = await Promise.all([
      student.current_class_id
        ? serviceClient
          .from('classes')
          .select('id, name, year')
          .eq('id', student.current_class_id)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      serviceClient
        .from('grades')
        .select('id, subject_id, bimester, evaluation_name, evaluation_date, score, max_score, status, created_at')
        .eq('student_id', studentId)
        .in('status', ['publicado', 'revisado', 'publicada'])
        .order('evaluation_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true }),
      serviceClient
        .from('attendance')
        .select('id, subject_id, date, status, justification, notes, created_at')
        .eq('student_id', studentId)
        .order('date', { ascending: true }),
      serviceClient
        .from('occurrences')
        .select('id, date, type, severity, title, status, created_at')
        .eq('student_id', studentId)
        .order('date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true }),
    ]);

    if (classResult.error) {
      throw createApiError(
        classResult.error.message || 'Falha ao carregar a turma do aluno.',
        {
          statusCode: 500,
          code: 'GUARDIAN_MONTHLY_REPORT_CLASS_LOAD_FAILED',
          cause: classResult.error,
        }
      );
    }

    if (gradesResult.error) {
      throw createApiError(
        gradesResult.error.message || 'Falha ao carregar as notas do aluno.',
        {
          statusCode: 500,
          code: 'GUARDIAN_MONTHLY_REPORT_GRADES_LOAD_FAILED',
          cause: gradesResult.error,
        }
      );
    }

    if (attendanceResult.error) {
      throw createApiError(
        attendanceResult.error.message || 'Falha ao carregar a frequencia do aluno.',
        {
          statusCode: 500,
          code: 'GUARDIAN_MONTHLY_REPORT_ATTENDANCE_LOAD_FAILED',
          cause: attendanceResult.error,
        }
      );
    }

    if (occurrencesResult.error) {
      throw createApiError(
        occurrencesResult.error.message || 'Falha ao carregar as ocorrencias do aluno.',
        {
          statusCode: 500,
          code: 'GUARDIAN_MONTHLY_REPORT_OCCURRENCES_LOAD_FAILED',
          cause: occurrencesResult.error,
        }
      );
    }

    const grades = gradesResult.data || [];
    const attendance = attendanceResult.data || [];
    const occurrences = occurrencesResult.data || [];
    const subjectIds = [...new Set(grades.map((grade) => grade.subject_id).filter(Boolean))];

    let subjects = [];
    if (subjectIds.length > 0) {
      const { data: subjectRows, error: subjectError } = await serviceClient
        .from('subjects')
        .select('id, name')
        .in('id', subjectIds);

      if (subjectError) {
        throw createApiError(
          subjectError.message || 'Falha ao carregar as disciplinas do relatorio mensal.',
          {
            statusCode: 500,
            code: 'GUARDIAN_MONTHLY_REPORT_SUBJECTS_LOAD_FAILED',
            cause: subjectError,
          }
        );
      }

      subjects = subjectRows || [];
    }

    return sendJson(res, 200, {
      data: {
        student,
        classRecord: classResult.data || null,
        month,
        grades: grades.filter((grade) => isWithinMonth(grade.evaluation_date || grade.created_at, month)),
        attendance: attendance.filter((record) => isWithinMonth(record.date, month)),
        occurrences: occurrences.filter((occurrence) => isWithinMonth(occurrence.date || occurrence.created_at, month)),
        subjects,
      },
    });
  } catch (error) {
    return handleApiError(res, error, { req });
  }
}
