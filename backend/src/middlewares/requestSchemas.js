import { z } from 'zod';
import {
  CHAT_ATTACHMENT_TYPES,
  CHAT_BUCKETS,
  CHAT_CALL_STATUSES,
  CHAT_CALL_TYPES,
  CHAT_SIGNAL_TYPES,
} from '../../../shared/src/contracts/chat.js';
import {
  MESSAGE_CHANNELS,
  MESSAGE_PRIORITIES,
  MESSAGE_RECIPIENT_TYPES,
} from '../../../shared/src/contracts/messages.js';
import { SYSTEM_EXPORT_FORMATS } from '../../../shared/src/contracts/systemExport.js';
import { ATTENDANCE_STATUSES } from '../../../shared/src/contracts/attendance.js';

const uuidSchema = z.string().uuid();
const routeStringSchema = z.string().trim().min(1).max(512);

function createRequestValidationError(message, code, details = null) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  error.details = details;
  return error;
}

export function parseRequestSchema(schema, input, {
  code = 'REQUEST_VALIDATION_FAILED',
  message = 'Requisicao invalida.',
} = {}) {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }

  throw createRequestValidationError(message, code, {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  });
}

export const messageCreateSchema = z.object({
  subject: z.string().trim().min(1).max(180),
  content: z.string().trim().min(1).max(12000),
  recipient_type: z.enum(Object.values(MESSAGE_RECIPIENT_TYPES)),
  recipient_ids: z.array(uuidSchema).default([]),
  class_id: uuidSchema.optional().nullable(),
  priority: z.enum(Object.values(MESSAGE_PRIORITIES)).default(MESSAGE_PRIORITIES.NORMAL),
  category: z.string().trim().min(1).max(80).default('comunicado'),
  channels: z.array(z.enum(Object.values(MESSAGE_CHANNELS))).default([MESSAGE_CHANNELS.APP]),
}).strict();

export const notificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  dismissed: z.enum(['true', 'false']).optional(),
}).strict();

export const notificationActionSchema = z.object({
  action: z.literal('mark_all_read'),
}).strict();

export const adminUsersQuerySchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
}).strict();

export const adminUserCreateSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(256),
}).strict();

export const adminUserDeleteSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()).optional(),
  profileId: uuidSchema.optional(),
}).strict().refine((value) => Boolean(value.email || value.profileId), {
  message: 'Informe email ou profileId para excluir o usuario.',
  path: ['email'],
});

export const auditEventSchema = z.object({
  eventType: z.string().trim().min(1).max(120),
  metadata: z.record(z.any()).optional(),
}).strict();

export const observabilityEventSchema = z.object({
  eventType: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(1200).optional(),
  route: routeStringSchema.optional(),
  traceId: z.string().trim().min(1).max(120).optional(),
  metadata: z.record(z.any()).optional(),
}).strict();

export const systemExportQuerySchema = z.object({
  format: z.enum([SYSTEM_EXPORT_FORMATS.XLSX, SYSTEM_EXPORT_FORMATS.CSV]).default(SYSTEM_EXPORT_FORMATS.XLSX),
  dataset: z.string().trim().max(120).optional(),
}).strict();

export const schedulePlannerGenerateSchema = z.object({
  settingId: z.string().trim().min(1).max(120),
  generationMode: z.string().trim().min(1).max(50).optional(),
}).strict();

export const attendanceLessonSaveSchema = z.object({
  classId: uuidSchema,
  subjectId: uuidSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lessonNumber: z.coerce.number().int().min(1).max(12),
  justification: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(2000).optional(),
  entries: z.array(z.object({
    studentId: uuidSchema,
    status: z.enum(Object.values(ATTENDANCE_STATUSES)),
  }).strict()).min(1).max(500),
}).strict();

export const chatMediaUrlSchema = z.object({
  action: z.enum(['upload', 'download']),
  bucket: z.enum([CHAT_BUCKETS.VOICE, CHAT_BUCKETS.RECORDINGS]).default(CHAT_BUCKETS.VOICE),
  conversationId: z.string().trim().min(3).max(255).optional(),
  fileName: z.string().trim().min(1).max(255).optional(),
  contentType: z.string().trim().min(1).max(120).optional(),
  path: z.string().trim().min(1).max(512).optional(),
}).strict().superRefine((value, context) => {
  if (value.action === 'upload') {
    if (!value.conversationId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['conversationId'],
        message: 'Conversa obrigatoria para upload.',
      });
    }

    if (!value.fileName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fileName'],
        message: 'Nome do arquivo obrigatorio para upload.',
      });
    }

    if (!value.contentType) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contentType'],
        message: 'Content-Type obrigatorio para upload.',
      });
    }
  }

  if (value.action === 'download' && !value.path) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['path'],
      message: 'Caminho do arquivo obrigatorio para download.',
    });
  }
});

export const chatConversationSchema = z.object({
  type: z.enum(['direct', 'group']).default('direct'),
  title: z.string().trim().min(1).max(120).optional(),
  participantEmails: z.array(z.string().trim().email().transform((value) => value.toLowerCase())).min(1).max(50),
}).strict();

export const chatCallStartSchema = z.object({
  conversationId: z.string().trim().min(3).max(255),
  recipientEmail: z.string().trim().email().transform((value) => value.toLowerCase()).optional(),
  participantEmails: z.array(z.string().trim().email().transform((value) => value.toLowerCase())).max(50).optional(),
  callType: z.enum(Object.values(CHAT_CALL_TYPES)),
}).strict().superRefine((value, context) => {
  if (!value.recipientEmail && (!Array.isArray(value.participantEmails) || value.participantEmails.length === 0)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['recipientEmail'],
      message: 'Informe ao menos um participante de destino.',
    });
  }
});

export const chatCallStatusSchema = z.object({
  status: z.enum(Object.values(CHAT_CALL_STATUSES)),
}).strict();

export const chatCallEndSchema = z.object({
  status: z.enum([
    CHAT_CALL_STATUSES.ENDED,
    CHAT_CALL_STATUSES.MISSED,
    CHAT_CALL_STATUSES.DECLINED,
    CHAT_CALL_STATUSES.FAILED,
  ]).default(CHAT_CALL_STATUSES.ENDED),
}).strict();

export const chatCallSignalSchema = z.object({
  signalType: z.enum(Object.values(CHAT_SIGNAL_TYPES)),
  recipientEmail: z.string().trim().email().transform((value) => value.toLowerCase()),
  payload: z.record(z.any()).default({}),
}).strict();

export const chatAttachmentSchema = z.object({
  type: z.enum(Object.values(CHAT_ATTACHMENT_TYPES)),
  path: z.string().trim().min(1).max(512),
  bucket: z.enum([CHAT_BUCKETS.VOICE, CHAT_BUCKETS.RECORDINGS]).default(CHAT_BUCKETS.VOICE),
  contentType: z.string().trim().max(120).optional().nullable(),
  fileName: z.string().trim().max(255).optional().nullable(),
  sizeBytes: z.number().int().nonnegative().optional().nullable(),
  durationMs: z.number().int().nonnegative().optional().nullable(),
}).strict();

export const chatRecordingSchema = z.object({
  bucket: z.enum([CHAT_BUCKETS.RECORDINGS]).default(CHAT_BUCKETS.RECORDINGS),
  path: z.string().trim().min(1).max(512),
  durationSeconds: z.number().int().positive().optional().nullable(),
}).strict();
