export const MESSAGE_RECIPIENT_TYPES = Object.freeze({
  ALL: 'todos',
  CLASS: 'turma',
  STUDENT: 'aluno',
  TEACHER: 'professor',
  COORDINATOR: 'coordenador',
});

export const MESSAGE_STATUSES = Object.freeze({
  DRAFT: 'rascunho',
  SCHEDULED: 'agendado',
  SENT: 'enviado',
  FAILED: 'falhou',
});

export const MESSAGE_CHANNELS = Object.freeze({
  APP: 'app',
  EMAIL: 'email',
});

export const MESSAGE_PRIORITIES = Object.freeze({
  LOW: 'baixa',
  NORMAL: 'normal',
  HIGH: 'alta',
  URGENT: 'urgente',
});

export const STAFF_MESSAGE_RECIPIENT_OPTIONS = Object.freeze([
  { value: MESSAGE_RECIPIENT_TYPES.ALL, label: 'Todos' },
  { value: MESSAGE_RECIPIENT_TYPES.CLASS, label: 'Turma específica' },
]);

export const TEACHER_CENTER_RECIPIENT_OPTIONS = Object.freeze([
  { value: MESSAGE_RECIPIENT_TYPES.CLASS, label: 'Turma inteira' },
  { value: MESSAGE_RECIPIENT_TYPES.STUDENT, label: 'Alunos específicos' },
]);

const VALID_RECIPIENT_TYPES = new Set(Object.values(MESSAGE_RECIPIENT_TYPES));
const VALID_STATUSES = new Set(Object.values(MESSAGE_STATUSES));
const VALID_CHANNELS = new Set(Object.values(MESSAGE_CHANNELS));

const LEGACY_RECIPIENT_ALIASES = Object.freeze({
  individual: MESSAGE_RECIPIENT_TYPES.STUDENT,
  professores: MESSAGE_RECIPIENT_TYPES.TEACHER,
});

const LEGACY_STATUS_ALIASES = Object.freeze({
  enviada: MESSAGE_STATUSES.SENT,
  agendada: MESSAGE_STATUSES.SCHEDULED,
});

export function normalizeMessageRecipientType(value) {
  const normalized = LEGACY_RECIPIENT_ALIASES[value] ?? value;
  return VALID_RECIPIENT_TYPES.has(normalized) ? normalized : null;
}

export function normalizeMessageStatus(value) {
  const normalized = LEGACY_STATUS_ALIASES[value] ?? value;
  return VALID_STATUSES.has(normalized) ? normalized : null;
}

export function normalizeMessageChannels(channels) {
  const values = Array.isArray(channels) ? channels : [MESSAGE_CHANNELS.APP];
  const normalized = values.filter((channel) => VALID_CHANNELS.has(channel));
  return normalized.length > 0 ? [...new Set(normalized)] : [MESSAGE_CHANNELS.APP];
}

export function buildMessagePayload({
  formData,
  sender,
  senderType,
  studentContext = null,
  now = new Date().toISOString(),
}) {
  if (!sender?.id) {
    throw new Error('Remetente inválido para envio da mensagem.');
  }

  const forcedStudentMessage = Boolean(studentContext);
  const recipientType = forcedStudentMessage
    ? MESSAGE_RECIPIENT_TYPES.CLASS
    : normalizeMessageRecipientType(formData?.recipient_type);

  if (!recipientType) {
    throw new Error('Tipo de destinatário inválido.');
  }

  const subject = formData?.subject?.trim();
  const content = formData?.content?.trim();

  if (!subject) {
    throw new Error('Assunto é obrigatório.');
  }

  if (!content) {
    throw new Error('Mensagem é obrigatória.');
  }

  const classId = forcedStudentMessage
    ? studentContext?.current_class_id ?? null
    : typeof formData?.class_id === 'string' && formData.class_id.trim()
      ? formData.class_id.trim()
      : null;

  if (recipientType === MESSAGE_RECIPIENT_TYPES.CLASS && !classId) {
    throw new Error('Selecione a turma para enviar a mensagem.');
  }

  const recipientIds = Array.isArray(formData?.recipient_ids)
    ? formData.recipient_ids.filter(Boolean)
    : [];

  if (recipientType === MESSAGE_RECIPIENT_TYPES.STUDENT && recipientIds.length === 0) {
    throw new Error('Selecione ao menos um aluno.');
  }

  return {
    sender_id: sender.id,
    sender_name: sender.full_name || sender.email,
    sender_type: senderType,
    recipient_type: recipientType,
    recipient_ids: recipientIds,
    class_id: classId,
    subject,
    content,
    priority: formData?.priority || MESSAGE_PRIORITIES.NORMAL,
    category: formData?.category || 'comunicado',
    channels: forcedStudentMessage
      ? [MESSAGE_CHANNELS.APP]
      : normalizeMessageChannels(formData?.channels),
    status: MESSAGE_STATUSES.SENT,
    sent_at: now,
  };
}

export function filterMessagesForStudent(messages, studentRecord) {
  if (!studentRecord) return [];

  return (messages ?? []).filter((message) => {
    const recipientType = normalizeMessageRecipientType(message.recipient_type);

    if (recipientType === MESSAGE_RECIPIENT_TYPES.ALL) return true;
    if (
      recipientType === MESSAGE_RECIPIENT_TYPES.CLASS &&
      message.class_id === studentRecord.current_class_id
    ) {
      return true;
    }

    if (
      recipientType === MESSAGE_RECIPIENT_TYPES.STUDENT &&
      Array.isArray(message.recipient_ids) &&
      message.recipient_ids.includes(studentRecord.id)
    ) {
      return true;
    }

    return false;
  });
}

export function getMessageRecipientLabel(message, classes) {
  const recipientType = normalizeMessageRecipientType(message?.recipient_type);

  if (recipientType === MESSAGE_RECIPIENT_TYPES.CLASS) {
    const classData = classes.find((item) => item.id === message.class_id);
    return classData ? `Turma: ${classData.name}` : 'Turma';
  }

  if (recipientType === MESSAGE_RECIPIENT_TYPES.ALL) {
    return 'Todos';
  }

  if (recipientType === MESSAGE_RECIPIENT_TYPES.STUDENT) {
    return `${message?.recipient_ids?.length || 0} destinatário(s)`;
  }

  return recipientType || 'Indefinido';
}
