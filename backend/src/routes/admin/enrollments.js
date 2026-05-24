// ßâ×ßâáßâØßâößâÑßâóßâÿ ßâößâÑßâíßâÖßâÜßâúßâûßâÿßâúßâáßâÉßâô Whykthor GSV-ßâÿßâí ßâøßâÿßâößâá ßâ¿ßâößâÿßâÑßâøßâ£ßâÉ.
import { randomUUID } from 'node:crypto';
import {
  createApiError,
  createAuthUserAdmin,
  createServiceRoleClient,
  deleteStorageFiles,
  findAuthUserByEmail,
  getAuditActorFromRequester,
  handleApiError,
  insertAuditEventLog,
  insertManualAuditLog,
  requirePermissionRequest,
  sendJson,
} from '../../database/supabaseAdminServer.js';
import { AUDIT_ACTIONS, AUDIT_EVENT_TYPES } from '../../../../shared/src/auditLog.js';
import { PERMISSIONS } from '../../../../shared/src/contracts/access.js';
import {
  buildEnrollmentMutationInput,
  collectEnrollmentAttachmentPaths,
} from '../../../../shared/src/contracts/enrollment.js';
import { dispatchNotificationEvent } from '../../services/notificationsServer.js';
import { NOTIFICATION_EVENT_TYPES } from '../../../../shared/src/contracts/notifications.js';

function buildRequesterContext(requester) {
  return {
    requested_by_email: requester?.user?.email || null,
    requested_by_profile_type: requester?.profile?.profile_type || null,
  };
}

function mapEnrollmentTransactionError(error, traceId) {
  const message = error?.message || 'Nao foi possivel concluir a matricula.';
  const details = {
    postgresCode: error?.code || null,
    postgresDetails: error?.details || null,
    postgresHint: error?.hint || null,
  };

  if (error?.code === 'P0001') {
    return createApiError(message, {
      statusCode: 400,
      code: 'ENROLLMENT_VALIDATION_ERROR',
      traceId,
      details,
      cause: error,
    });
  }

  if (error?.code === '23505') {
    if (
      message.includes('students_cpf_key')
      || message.includes('Ja existe um aluno cadastrado com este CPF.')
    ) {
      return createApiError('Ja existe um aluno cadastrado com este CPF.', {
        statusCode: 409,
        code: 'ENROLLMENT_STUDENT_CPF_CONFLICT',
        traceId,
        details,
        cause: error,
      });
    }

    if (
      message.includes('students_registration_number_key')
      || message.includes('A matricula informada ja esta em uso.')
    ) {
      return createApiError('A matricula informada ja esta em uso.', {
        statusCode: 409,
        code: 'ENROLLMENT_REGISTRATION_CONFLICT',
        traceId,
        details,
        cause: error,
      });
    }

    if (
      message.includes('user_profiles_user_email_key')
      || message.includes('Ja existe um perfil vinculado a este e-mail.')
    ) {
      return createApiError('Ja existe um perfil vinculado a este e-mail.', {
        statusCode: 409,
        code: 'ENROLLMENT_PROFILE_EMAIL_CONFLICT',
        traceId,
        details,
        cause: error,
      });
    }
  }

  if (error?.code === '23503' && message.includes('fk_students_class')) {
    return createApiError('A turma informada nao existe ou nao esta disponivel.', {
      statusCode: 400,
      code: 'ENROLLMENT_CLASS_NOT_FOUND',
      traceId,
      details,
      cause: error,
    });
  }

  return createApiError('Nao foi possivel concluir a matricula.', {
    statusCode: 500,
    code: 'ENROLLMENT_TRANSACTION_FAILED',
    traceId,
    details,
    cause: error,
  });
}

async function cleanupEnrollmentFailure({
  serviceClient,
  traceId,
  studentId = null,
  profileId = null,
  attachmentPaths = [],
}) {
  const cleanup = {
    databaseRolledBack: studentId ? false : true,
    attachmentsInvalidated: false,
    errors: [],
  };

  if (studentId) {
    const { error } = await serviceClient.rpc('admin_cleanup_enrollment_transaction', {
      p_student_id: studentId,
      p_profile_id: profileId,
    });

    if (error) {
      cleanup.errors.push({
        scope: 'database',
        message: error.message || 'Falha ao reverter registros da matricula.',
        code: error.code || null,
      });
    } else {
      cleanup.databaseRolledBack = true;
    }
  }

  if (attachmentPaths.length > 0) {
    try {
      await deleteStorageFiles(attachmentPaths);
      cleanup.attachmentsInvalidated = true;
    } catch (error) {
      cleanup.errors.push({
        scope: 'storage',
        message: error.message || 'Falha ao remover anexos da matricula.',
        code: error.code || null,
      });
    }
  }

  if (cleanup.errors.length > 0) {
    throw createApiError(
      'Falha ao reverter completamente a matricula apos erro no fluxo server-side.',
      {
        statusCode: 500,
        code: 'ENROLLMENT_ROLLBACK_FAILED',
        traceId,
        details: cleanup,
      }
    );
  }

  return cleanup;
}

export default async function handler(req, res) {
  const traceId = randomUUID();
  let attachmentPaths = [];

  try {
    const requester = await requirePermissionRequest(req, PERMISSIONS.ENROLLMENTS_MANAGE);

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { error: 'Metodo nao permitido.' });
    }

    const input = buildEnrollmentMutationInput({
      student: req.body?.student || {},
      access: req.body?.access || {},
    });

    const payload = input.student;
    const access = input.access;
    attachmentPaths = collectEnrollmentAttachmentPaths(payload);

    if (!payload?.full_name || !payload?.cpf || !payload?.birth_date) {
      throw createApiError(
        'Dados obrigatorios da matricula estao incompletos.',
        {
          statusCode: 400,
          code: 'ENROLLMENT_REQUIRED_FIELDS_MISSING',
          traceId,
        }
      );
    }

    if (access.create_access && (!access.email || !access.password)) {
      throw createApiError(
        'Email e password sao obrigatorios para criar acesso.',
        {
          statusCode: 400,
          code: 'ENROLLMENT_ACCESS_FIELDS_MISSING',
          traceId,
        }
      );
    }

    const auditActor = getAuditActorFromRequester(requester);
    const serviceClient = createServiceRoleClient(auditActor);

    console.info(`[api/admin/enrollments][start][${traceId}]`, {
      initiatedBy: requester.user.email || null,
      createAccess: access.create_access,
      attachments: attachmentPaths.length,
    });

    if (access.create_access) {
      const existingAuthUser = await findAuthUserByEmail(access.email);
      if (existingAuthUser) {
        throw createApiError(
          'Este e-mail ja esta cadastrado no sistema.',
          {
            statusCode: 409,
            code: 'ENROLLMENT_AUTH_EMAIL_CONFLICT',
            traceId,
          }
        );
      }
    }

    const { data: transactionResult, error: transactionError } = await serviceClient.rpc(
      'admin_create_enrollment_transaction',
      {
        p_student: payload,
        p_access: access,
        p_requester: buildRequesterContext(requester),
      }
    );

    if (transactionError) {
      const mappedError = mapEnrollmentTransactionError(transactionError, traceId);
      const cleanup = await cleanupEnrollmentFailure({
        serviceClient,
        traceId,
        attachmentPaths,
      });

      mappedError.details = {
        ...(mappedError.details || {}),
        attachmentsInvalidated: cleanup.attachmentsInvalidated,
      };

      throw mappedError;
    }

    if (!transactionResult?.student?.id) {
      throw createApiError(
        'A transacao de matricula nao retornou o aluno criado.',
        {
          statusCode: 500,
          code: 'ENROLLMENT_TRANSACTION_EMPTY',
          traceId,
        }
      );
    }

    let authUser = null;

    if (access.create_access) {
      try {
        authUser = await createAuthUserAdmin(access.email, access.password, {
          tenantId: requester.tenantId || null,
        });
      } catch (error) {
        await cleanupEnrollmentFailure({
          serviceClient,
          traceId,
          studentId: transactionResult.student.id,
          profileId: transactionResult.profile?.id || null,
          attachmentPaths,
        });

        throw createApiError(
          error?.message || 'Nao foi possivel criar o acesso de autenticacao.',
          {
            statusCode: error?.statusCode || 500,
            code: error?.code || 'ENROLLMENT_AUTH_CREATE_FAILED',
            traceId,
            details: {
              attachmentsInvalidated: attachmentPaths.length > 0,
            },
            cause: error,
          }
        );
      }

      try {
        await insertManualAuditLog({
          actor: auditActor,
          action: AUDIT_ACTIONS.CREATE,
          entityTable: 'auth_users',
          recordId: authUser.id,
          newRecord: { id: authUser.id, email: authUser.email },
          metadata: {
            source: 'api/admin/enrollments',
            initiated_by: requester.user.email || null,
            trace_id: traceId,
          },
        });
      } catch (auditError) {
        console.warn(
          `[api/admin/enrollments][audit-warning][${traceId}] Falha ao registrar auditoria manual do auth user.`,
          auditError
        );
      }
    }

    try {
      await insertAuditEventLog({
        actor: auditActor,
        eventType: AUDIT_EVENT_TYPES.ENROLLMENT_TRANSACTION,
        recordId: transactionResult.student.id,
        newRecord: {
          student_id: transactionResult.student.id,
          profile_id: transactionResult.profile?.id || null,
          access_created: Boolean(authUser?.id),
        },
        metadata: {
          source: 'api/admin/enrollments',
          trace_id: traceId,
          initiated_by: requester.user.email || null,
          student_email: transactionResult.student.email || null,
          profile_email: transactionResult.profile?.user_email || null,
        },
      });
    } catch (auditError) {
      console.warn(
        `[api/admin/enrollments][audit-warning][${traceId}] Falha ao registrar evento composto de matricula.`,
        auditError
      );
    }

    try {
      await dispatchNotificationEvent({
        actor: auditActor,
        eventType: NOTIFICATION_EVENT_TYPES.ENROLLMENT_CREATED,
        payload: {
          studentId: transactionResult.student.id,
          studentName: transactionResult.student.full_name || payload.full_name,
          studentEmail: transactionResult.student.email || payload.email || null,
          actionRecordId: transactionResult.student.id,
        },
        metadata: {
          source: 'api/admin/enrollments',
          trace_id: traceId,
          initiated_by: requester.user.email || null,
          access_created: Boolean(authUser?.id),
        },
      });

      if (attachmentPaths.length === 0) {
        await dispatchNotificationEvent({
          actor: auditActor,
          eventType: NOTIFICATION_EVENT_TYPES.DOCUMENT_PENDING,
          payload: {
            studentId: transactionResult.student.id,
            studentName: transactionResult.student.full_name || payload.full_name,
            actionRecordId: transactionResult.student.id,
          },
          metadata: {
            source: 'api/admin/enrollments',
            trace_id: traceId,
            initiated_by: requester.user.email || null,
            attachments_count: 0,
          },
        });
      }
    } catch (notificationError) {
      console.warn(
        `[api/admin/enrollments][notification-warning][${traceId}] Falha ao despachar notificacoes da matricula.`,
        notificationError
      );
    }

    console.info(`[api/admin/enrollments][success][${traceId}]`, {
      initiatedBy: requester.user.email || null,
      studentId: transactionResult.student.id,
      profileId: transactionResult.profile?.id || null,
      authUserId: authUser?.id || null,
    });

    return sendJson(res, 201, {
      student: transactionResult.student,
      profile: transactionResult.profile || null,
      accessCreated: Boolean(authUser?.id),
      traceId,
    });
  } catch (error) {
    if (
      attachmentPaths.length > 0
      && error?.code?.startsWith('ENROLLMENT_')
      && !error?.details?.attachmentsInvalidated
    ) {
      try {
        const cleanup = await cleanupEnrollmentFailure({
          serviceClient: createServiceRoleClient(),
          traceId: error?.traceId || traceId,
          attachmentPaths,
        });

        error.details = {
          ...(error.details || {}),
          attachmentsInvalidated: cleanup.attachmentsInvalidated,
        };
      } catch (cleanupError) {
        return handleApiError(res, cleanupError);
      }
    }

    return handleApiError(res, error);
  }
}
