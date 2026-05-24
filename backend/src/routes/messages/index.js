import {
  createApiError,
  createServiceRoleClient,
  getAuditActorFromRequester,
  handleApiError,
  requireAuthenticatedRequest,
  sendJson,
} from '../../database/supabaseAdminServer.js';
import { enforceRequestSecurity } from '../../middlewares/requestSecurity.js';
import {
  canCreateOwnClassMessages,
  canManageMessages,
} from '../../../../shared/src/contracts/access.js';
import { buildMessagePayload } from '../../../../shared/src/contracts/messages.js';
import {
  dispatchNotificationEvent,
} from '../../services/notificationsServer.js';
import { NOTIFICATION_EVENT_TYPES } from '../../../../shared/src/contracts/notifications.js';
import { buildSystemJobResponseHeaders } from '../../../../shared/src/contracts/systemEvents.js';
import {
  messageCreateSchema,
  parseRequestSchema,
} from '../../middlewares/requestSchemas.js';

async function resolveStudentContext(serviceClient, email) {
  const { data, error } = await serviceClient
    .from('students')
    .select('id, current_class_id')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    throw createApiError(
      error.message || 'Falha ao localizar contexto do aluno para envio de mensagem.',
      {
        statusCode: 500,
        code: 'MESSAGE_STUDENT_CONTEXT_FAILED',
        cause: error,
      }
    );
  }

  if (!data?.id || !data?.current_class_id) {
    throw createApiError(
      'Nao foi possivel identificar a turma do aluno para envio da mensagem.',
      {
        statusCode: 400,
        code: 'MESSAGE_STUDENT_CLASS_REQUIRED',
      }
    );
  }

  return data;
}

async function rollbackCreatedMessage(serviceClient, messageId, dispatchError) {
  const { error } = await serviceClient
    .from('messages')
    .delete()
    .eq('id', messageId);

  if (!error) {
    return;
  }

  throw createApiError(
    'Falha ao reverter o comunicado apos erro no dispatch de notificacoes.',
    {
      statusCode: 500,
      code: 'MESSAGE_NOTIFICATION_ROLLBACK_FAILED',
      cause: error,
      details: {
        messageId,
        dispatchError: dispatchError?.message || null,
        postgresCode: error.code || null,
      },
    }
  );
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      throw createApiError('Metodo nao permitido.', {
        statusCode: 405,
        code: 'METHOD_NOT_ALLOWED',
      });
    }

    const requester = await requireAuthenticatedRequest(req);
    await enforceRequestSecurity({
      req,
      requester,
      routeKey: 'api/messages',
      action: 'write',
      metadata: {
        entity: 'messages',
      },
    });
    const profileType = requester.profile?.profile_type || null;
    const canWriteMessages = canManageMessages(profileType);
    const canWriteOwnClassMessage = canCreateOwnClassMessages(profileType);

    if (!canWriteMessages && !canWriteOwnClassMessage) {
      throw createApiError('Voce nao tem permissao para enviar comunicados.', {
        statusCode: 403,
        code: 'MESSAGE_WRITE_FORBIDDEN',
      });
    }

    const formData = parseRequestSchema(messageCreateSchema, req.body || {}, {
      code: 'MESSAGE_PAYLOAD_INVALID',
      message: 'Payload do comunicado invalido.',
    });

    const auditActor = getAuditActorFromRequester(requester);
    const serviceClient = createServiceRoleClient(auditActor);

    const studentContext = canWriteOwnClassMessage && !canWriteMessages
      ? await resolveStudentContext(serviceClient, requester.user.email)
      : null;

    const payload = buildMessagePayload({
      formData,
      sender: {
        id: requester.user.id,
        email: requester.user.email,
        full_name: requester.profile?.full_name || requester.user.user_metadata?.full_name || null,
      },
      senderType: profileType,
      studentContext,
    });

    const { data: message, error } = await serviceClient
      .from('messages')
      .insert(payload)
      .select('*')
      .single();

    if (error || !message?.id) {
      throw createApiError(
        error?.message || 'Nao foi possivel criar o comunicado.',
        {
          statusCode: 500,
          code: 'MESSAGE_CREATE_FAILED',
          cause: error,
          details: {
            postgresCode: error?.code || null,
          },
        }
      );
    }

    try {
      const notificationDispatch = await dispatchNotificationEvent({
        actor: auditActor,
        eventType: NOTIFICATION_EVENT_TYPES.MESSAGE_POSTED,
        payload: {
          messageId: message.id,
          subject: message.subject,
          content: message.content,
          senderName: message.sender_name,
          recipientType: message.recipient_type,
          recipientIds: message.recipient_ids,
          classId: message.class_id,
          channels: message.channels,
          actionRecordId: message.id,
        },
        metadata: {
          source: 'api/messages',
          initiated_by: requester.user.email || null,
          category: message.category || null,
          priority: message.priority || null,
        },
      });

      for (const [headerName, headerValue] of Object.entries(
        buildSystemJobResponseHeaders(notificationDispatch?.job)
      )) {
        res.setHeader(headerName, headerValue);
      }

      return sendJson(res, 201, {
        message,
        notificationDispatch,
      });
    } catch (dispatchError) {
      await rollbackCreatedMessage(serviceClient, message.id, dispatchError);

      throw createApiError(
        'Falha ao despachar notificacoes do comunicado.',
        {
          statusCode: 500,
          code: 'MESSAGE_NOTIFICATION_DISPATCH_FAILED',
          cause: dispatchError,
          details: {
            messageId: message.id,
          },
        }
      );
    }
  } catch (error) {
    if (error?.statusCode === 405) {
      res.setHeader('Allow', 'POST');
    }

    return handleApiError(res, error, { req });
  }
}
