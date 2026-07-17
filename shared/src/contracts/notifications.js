// ßâ×ßâáßâØßâößâÑßâóßâÿ ßâößâÑßâíßâÖßâÜßâúßâûßâÿßâúßâáßâÉßâô Whykthor GSV-ßâÿßâí ßâøßâÿßâößâá ßâ¿ßâößâÿßâÑßâøßâ£ßâÉ.
export const NOTIFICATION_TABLE_NAME = 'notifications';

export const NOTIFICATION_EVENT_TYPES = Object.freeze({
  ENROLLMENT_CREATED: 'enrollment_created',
  DOCUMENT_PENDING: 'document_pending',
  MESSAGE_POSTED: 'message_posted',
  ACCESS_RESET: 'access_reset',
  GRADE_POSTED: 'grade_posted',
  ATTENDANCE_ISSUE: 'attendance_issue',
  PAYMENT_DUE: 'payment_due',
  ASSIGNMENT_DEADLINE: 'assignment_deadline',
  SCHEDULE_CHANGED: 'schedule_changed',
  LIBRARY_LOAN_DUE: 'library_loan_due',
  TCC_UPDATE: 'tcc_update',
  INTERNSHIP_UPDATE: 'internship_update',
  EXAM_SCHEDULED: 'exam_scheduled',
});

export const NOTIFICATION_CHANNELS = Object.freeze({
  APP: 'app',
  EMAIL: 'email',
});

export const NOTIFICATION_APP_STATUSES = Object.freeze({
  DELIVERED: 'entregue',
  READ: 'lida',
  DISMISSED: 'dispensada',
});

export const NOTIFICATION_EMAIL_STATUSES = Object.freeze({
  PENDING: 'pendente',
  SENT: 'enviado',
  FAILED: 'falhou',
  SKIPPED: 'dispensado',
});

const VALID_EVENT_TYPES = new Set(Object.values(NOTIFICATION_EVENT_TYPES));
const VALID_CHANNELS = new Set(Object.values(NOTIFICATION_CHANNELS));

const DEFAULT_CHANNELS = Object.freeze([
  NOTIFICATION_CHANNELS.APP,
  NOTIFICATION_CHANNELS.EMAIL,
]);

const NOTIFICATION_PREFERENCE_KEYS = Object.freeze({
  [NOTIFICATION_EVENT_TYPES.ENROLLMENT_CREATED]: 'notifyNewEnrollment',
  [NOTIFICATION_EVENT_TYPES.DOCUMENT_PENDING]: 'notifyDocumentPending',
  [NOTIFICATION_EVENT_TYPES.MESSAGE_POSTED]: 'notifyMessagePosted',
  [NOTIFICATION_EVENT_TYPES.ACCESS_RESET]: 'notifyAccessReset',
  [NOTIFICATION_EVENT_TYPES.GRADE_POSTED]: 'notifyGradePosted',
  [NOTIFICATION_EVENT_TYPES.ATTENDANCE_ISSUE]: 'notifyAttendanceIssue',
  [NOTIFICATION_EVENT_TYPES.PAYMENT_DUE]: 'notifyPaymentDue',
  [NOTIFICATION_EVENT_TYPES.ASSIGNMENT_DEADLINE]: 'notifyAssignmentDeadline',
  [NOTIFICATION_EVENT_TYPES.SCHEDULE_CHANGED]: 'notifyScheduleChanged',
  [NOTIFICATION_EVENT_TYPES.LIBRARY_LOAN_DUE]: 'notifyLibraryLoanDue',
  [NOTIFICATION_EVENT_TYPES.TCC_UPDATE]: 'notifyTccUpdate',
  [NOTIFICATION_EVENT_TYPES.INTERNSHIP_UPDATE]: 'notifyInternshipUpdate',
  [NOTIFICATION_EVENT_TYPES.EXAM_SCHEDULED]: 'notifyExamScheduled',
});

const SENSITIVE_METADATA_PATTERNS = [
  /password/i,
  /token/i,
  /authorization/i,
  /secret/i,
  /apikey/i,
  /api_key/i,
];

function normalizeString(value, fallback = null) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeEmail(value) {
  const email = normalizeString(value, null);
  return email ? email.toLowerCase() : null;
}

function truncateText(value, maxLength = 140) {
  const text = normalizeString(value, '');
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
}

function sanitizeMetadata(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMetadata(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        if (SENSITIVE_METADATA_PATTERNS.some((pattern) => pattern.test(key))) {
          return [key, '[redacted]'];
        }

        return [key, sanitizeMetadata(item)];
      })
    );
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  return value ?? null;
}

export function normalizeNotificationChannels(channels, fallback = DEFAULT_CHANNELS) {
  const values = Array.isArray(channels) ? channels : fallback;
  const normalized = values.filter((channel) => VALID_CHANNELS.has(channel));
  return normalized.length > 0 ? [...new Set(normalized)] : [...DEFAULT_CHANNELS];
}

export function resolveNotificationPreferenceKey(eventType) {
  return NOTIFICATION_PREFERENCE_KEYS[eventType] || null;
}

export function isNotificationEventEnabled(settings = {}, eventType) {
  const key = resolveNotificationPreferenceKey(eventType);
  if (!key) {
    return true;
  }

  return settings[key] ?? true;
}

export function getNotificationPresentation(eventType) {
  switch (eventType) {
    case NOTIFICATION_EVENT_TYPES.ENROLLMENT_CREATED:
      return {
        icon: '🎓',
        actionApp: 'students',
        actionLabel: 'Abrir alunos',
      };
    case NOTIFICATION_EVENT_TYPES.DOCUMENT_PENDING:
      return {
        icon: '📎',
        actionApp: 'registration',
        actionLabel: 'Revisar matricula',
      };
    case NOTIFICATION_EVENT_TYPES.MESSAGE_POSTED:
      return {
        icon: '📣',
        actionApp: 'messages',
        actionLabel: 'Abrir comunicados',
      };
    case NOTIFICATION_EVENT_TYPES.ACCESS_RESET:
      return {
        icon: '🔑',
        actionApp: null,
        actionLabel: null,
      };
    case NOTIFICATION_EVENT_TYPES.GRADE_POSTED:
      return {
        icon: '📝',
        actionApp: 'grades',
        actionLabel: 'Ver notas',
      };
    case NOTIFICATION_EVENT_TYPES.ATTENDANCE_ISSUE:
      return {
        icon: '⚠️',
        actionApp: 'attendance',
        actionLabel: 'Ver frequencia',
      };
    case NOTIFICATION_EVENT_TYPES.PAYMENT_DUE:
      return {
        icon: '💰',
        actionApp: null,
        actionLabel: null,
      };
    case NOTIFICATION_EVENT_TYPES.ASSIGNMENT_DEADLINE:
      return {
        icon: '📋',
        actionApp: 'assignments',
        actionLabel: 'Ver atividades',
      };
    case NOTIFICATION_EVENT_TYPES.SCHEDULE_CHANGED:
      return {
        icon: '📅',
        actionApp: 'schoolcalendar',
        actionLabel: 'Ver calendario',
      };
    case NOTIFICATION_EVENT_TYPES.LIBRARY_LOAN_DUE:
      return {
        icon: '📚',
        actionApp: 'library',
        actionLabel: 'Ver biblioteca',
      };
    case NOTIFICATION_EVENT_TYPES.TCC_UPDATE:
      return {
        icon: '📄',
        actionApp: 'tcc_projects',
        actionLabel: 'Ver TCC',
      };
    case NOTIFICATION_EVENT_TYPES.INTERNSHIP_UPDATE:
      return {
        icon: '💼',
        actionApp: 'internships',
        actionLabel: 'Ver estagios',
      };
    case NOTIFICATION_EVENT_TYPES.EXAM_SCHEDULED:
      return {
        icon: '📝',
        actionApp: 'schoolcalendar',
        actionLabel: 'Ver calendario',
      };
    default:
      return {
        icon: '🔔',
        actionApp: null,
        actionLabel: null,
      };
  }
}

export function buildNotificationTemplate({
  eventType,
  payload = {},
  secrets = {},
}) {
  const presentation = getNotificationPresentation(eventType);

  switch (eventType) {
    case NOTIFICATION_EVENT_TYPES.ENROLLMENT_CREATED: {
      const studentName = normalizeString(payload.studentName, 'Aluno sem identificacao');
      const className = normalizeString(payload.className, null);
      const title = 'Nova matricula registrada';
      const body = className
        ? `${studentName} foi matriculado(a) na turma ${className}.`
        : `${studentName} foi matriculado(a) e aguarda acompanhamento da equipe.`;

      return {
        title,
        body,
        emailSubject: title,
        emailText: `${body}\n\nOrigem: fluxo de matricula.`,
        actionApp: presentation.actionApp,
        actionLabel: presentation.actionLabel,
      };
    }

    case NOTIFICATION_EVENT_TYPES.DOCUMENT_PENDING: {
      const studentName = normalizeString(payload.studentName, 'Aluno sem identificacao');
      const title = 'Documentacao pendente na matricula';
      const body = `${studentName} foi matriculado(a) sem anexos obrigatorios enviados.`;

      return {
        title,
        body,
        emailSubject: title,
        emailText: `${body}\n\nAcesse o modulo de matriculas para acompanhar a regularizacao.`,
        actionApp: presentation.actionApp,
        actionLabel: presentation.actionLabel,
      };
    }

    case NOTIFICATION_EVENT_TYPES.MESSAGE_POSTED: {
      const subject = normalizeString(payload.subject, 'Novo comunicado');
      const senderName = normalizeString(payload.senderName, 'Equipe escolar');
      const preview = truncateText(payload.content, 120);
      const title = `Novo comunicado: ${subject}`;
      const body = preview
        ? `${senderName} enviou um comunicado. ${preview}`
        : `${senderName} enviou um novo comunicado para voce.`;

      return {
        title,
        body,
        emailSubject: title,
        emailText: `${senderName} enviou um comunicado.\n\nAssunto: ${subject}\n\n${payload.content || ''}`.trim(),
        actionApp: presentation.actionApp,
        actionLabel: presentation.actionLabel,
      };
    }

    case NOTIFICATION_EVENT_TYPES.ACCESS_RESET: {
      const actorName = normalizeString(payload.actorName, 'A equipe da escola');
      const title = 'Acesso redefinido';
      const body = `${actorName} redefiniu seu acesso ao sistema. Use o fluxo seguro de recuperacao para definir uma nova senha.`;

      return {
        title,
        body,
        emailSubject: title,
        emailText: body,
        actionApp: presentation.actionApp,
        actionLabel: presentation.actionLabel,
      };
    }

    case NOTIFICATION_EVENT_TYPES.GRADE_POSTED: {
      const studentName = normalizeString(payload.studentName, 'Aluno');
      const subjectName = normalizeString(payload.subjectName, 'Disciplina');
      const grade = payload.grade != null ? String(payload.grade) : '--';
      const title = 'Nota lancada';
      const body = `Nota ${grade} lancada para ${studentName} na disciplina ${subjectName}.`;

      return {
        title,
        body,
        emailSubject: title,
        emailText: body,
        actionApp: presentation.actionApp,
        actionLabel: presentation.actionLabel,
      };
    }

    case NOTIFICATION_EVENT_TYPES.ATTENDANCE_ISSUE: {
      const studentName = normalizeString(payload.studentName, 'Aluno');
      const className = normalizeString(payload.className, 'Turma');
      const absenceCount = payload.absenceCount || 0;
      const title = 'Alerta de frequencia';
      const body = `${studentName} possui ${absenceCount} falta(s) na turma ${className}. Atencao ao limite de faltas.`;

      return {
        title,
        body,
        emailSubject: title,
        emailText: body,
        actionApp: presentation.actionApp,
        actionLabel: presentation.actionLabel,
      };
    }

    case NOTIFICATION_EVENT_TYPES.ASSIGNMENT_DEADLINE: {
      const assignmentTitle = normalizeString(payload.assignmentTitle, 'Atividade');
      const dueDate = normalizeString(payload.dueDate, 'em breve');
      const title = 'Prazo de atividade proximo';
      const body = `A atividade "${assignmentTitle}" vence ${dueDate}. Nao esqueca de entregar.`;

      return {
        title,
        body,
        emailSubject: title,
        emailText: body,
        actionApp: presentation.actionApp,
        actionLabel: presentation.actionLabel,
      };
    }

    case NOTIFICATION_EVENT_TYPES.SCHEDULE_CHANGED: {
      const title = 'Horario alterado';
      const body = 'O horario da turma foi atualizado. Verifique o calendario escolar.';

      return {
        title,
        body,
        emailSubject: title,
        emailText: body,
        actionApp: presentation.actionApp,
        actionLabel: presentation.actionLabel,
      };
    }

    case NOTIFICATION_EVENT_TYPES.LIBRARY_LOAN_DUE: {
      const itemName = normalizeString(payload.itemName, 'Material');
      const dueDate = normalizeString(payload.dueDate, 'em breve');
      const title = 'Devolucao de biblioteca pendente';
      const body = `O material "${itemName}" deve ser devolvido ate ${dueDate}.`;

      return {
        title,
        body,
        emailSubject: title,
        emailText: body,
        actionApp: presentation.actionApp,
        actionLabel: presentation.actionLabel,
      };
    }

    case NOTIFICATION_EVENT_TYPES.TCC_UPDATE: {
      const tccTitle = normalizeString(payload.tccTitle, 'Projeto TCC');
      const updateType = normalizeString(payload.updateType, 'atualizacao');
      const title = 'Atualizacao no TCC';
      const body = `O projeto "${tccTitle}" recebeu uma ${updateType}.`;

      return {
        title,
        body,
        emailSubject: title,
        emailText: body,
        actionApp: presentation.actionApp,
        actionLabel: presentation.actionLabel,
      };
    }

    case NOTIFICATION_EVENT_TYPES.INTERNSHIP_UPDATE: {
      const studentName = normalizeString(payload.studentName, 'Aluno');
      const updateType = normalizeString(payload.updateType, 'atualizacao');
      const title = 'Atualizacao de estagio';
      const body = `Estagio de ${studentName} recebeu uma ${updateType}.`;

      return {
        title,
        body,
        emailSubject: title,
        emailText: body,
        actionApp: presentation.actionApp,
        actionLabel: presentation.actionLabel,
      };
    }

    case NOTIFICATION_EVENT_TYPES.EXAM_SCHEDULED: {
      const examTitle = normalizeString(payload.examTitle, 'Avaliacao');
      const examDate = normalizeString(payload.examDate, 'em breve');
      const className = normalizeString(payload.className, 'Turma');
      const title = 'Avaliacao agendada';
      const body = `${examTitle} agendada para ${examDate} na turma ${className}.`;

      return {
        title,
        body,
        emailSubject: title,
        emailText: body,
        actionApp: presentation.actionApp,
        actionLabel: presentation.actionLabel,
      };
    }

    case NOTIFICATION_EVENT_TYPES.PAYMENT_DUE: {
      const amount = payload.amount != null ? `R$ ${Number(payload.amount).toFixed(2)}` : '';
      const dueDate = normalizeString(payload.dueDate, 'em breve');
      const title = 'Pagamento pendente';
      const body = `Pagamento${amount ? ` no valor de ${amount}` : ''} com vencimento em ${dueDate}.`;

      return {
        title,
        body,
        emailSubject: title,
        emailText: body,
        actionApp: presentation.actionApp,
        actionLabel: presentation.actionLabel,
      };
    }

    default:
      throw Object.assign(new Error('Tipo de notificacao invalido.'), {
        code: 'NOTIFICATION_EVENT_INVALID',
        statusCode: 400,
      });
  }
}

export function buildNotificationRecord({
  eventType,
  recipient,
  channels,
  template,
  tenantId = null,
  metadata = {},
  actionRecordId = null,
  now = new Date().toISOString(),
}) {
  if (!VALID_EVENT_TYPES.has(eventType)) {
    throw Object.assign(new Error('Tipo de notificacao invalido.'), {
      code: 'NOTIFICATION_EVENT_INVALID',
      statusCode: 400,
    });
  }

  const recipientEmail = normalizeEmail(recipient?.email);
  if (!recipientEmail) {
    throw Object.assign(new Error('Destinatario da notificacao sem e-mail valido.'), {
      code: 'NOTIFICATION_RECIPIENT_EMAIL_REQUIRED',
      statusCode: 400,
    });
  }

  const resolvedTemplate = template || buildNotificationTemplate({ eventType });
  const normalizedChannels = normalizeNotificationChannels(channels);
  const hasAppChannel = normalizedChannels.includes(NOTIFICATION_CHANNELS.APP);
  const hasEmailChannel = normalizedChannels.includes(NOTIFICATION_CHANNELS.EMAIL);

  return {
    tenant_id: normalizeString(tenantId, null),
    recipient_email: recipientEmail,
    recipient_name: normalizeString(recipient?.name, null),
    recipient_profile_type: normalizeString(recipient?.profileType, null),
    event_type: eventType,
    title: normalizeString(resolvedTemplate.title, 'Notificacao'),
    body: normalizeString(resolvedTemplate.body, 'Voce recebeu uma nova notificacao.'),
    channels: normalizedChannels,
    app_status: hasAppChannel
      ? NOTIFICATION_APP_STATUSES.DELIVERED
      : NOTIFICATION_APP_STATUSES.DISMISSED,
    email_status: hasEmailChannel
      ? NOTIFICATION_EMAIL_STATUSES.PENDING
      : NOTIFICATION_EMAIL_STATUSES.SKIPPED,
    email_error: null,
    action_app: normalizeString(resolvedTemplate.actionApp, null),
    action_label: normalizeString(resolvedTemplate.actionLabel, null),
    action_record_id: normalizeString(actionRecordId, null),
    metadata: sanitizeMetadata(metadata),
    created_at: now,
    updated_at: now,
  };
}

export function getDefaultNotificationChannels() {
  return [...DEFAULT_CHANNELS];
}

export function isNotificationsTableUnavailable(error) {
  return error?.code === '42P01'
    || error?.code === 'PGRST205'
    || /notifications/i.test(error?.message || '');
}
