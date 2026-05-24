// Þ®▓Úáàþø«Õ«îÕà¿þö▒ Whykthor GSV Þú¢õ¢£
import { randomUUID } from 'node:crypto';
import {
  createApiError,
  deleteUserProfileAdmin,
  deleteAuthUserAdmin,
  findAuthUserById,
  findUserProfileAdmin,
  getAuditActorFromRequester,
  handleApiError,
  insertManualAuditLog,
  requirePermissionRequest,
  resetAuthUserPassword,
  sendJson,
} from '../../../database/supabaseAdminServer.js';
import { AUDIT_ACTIONS } from '../../../../../shared/src/auditLog.js';
import {
  canManageAdministrativeProfiles,
  isAdministrativeProfileType,
  PERMISSIONS,
} from '../../../../../shared/src/contracts/access.js';
import { dispatchNotificationEvent } from '../../../services/notificationsServer.js';
import { NOTIFICATION_EVENT_TYPES } from '../../../../../shared/src/contracts/notifications.js';
import { buildSystemJobResponseHeaders } from '../../../../../shared/src/contracts/systemEvents.js';

function assertCanManageTargetUser({
  requester,
  targetProfile = null,
  targetAuthUser = null,
  operationLabel = 'gerenciar',
}) {
  const isSelfTarget = Boolean(
    (targetProfile?.id && requester.profile?.id && targetProfile.id === requester.profile.id)
    || (targetProfile?.user_email && requester.user?.email && targetProfile.user_email === requester.user.email)
    || (targetAuthUser?.id && requester.user?.id && targetAuthUser.id === requester.user.id)
    || (targetAuthUser?.email && requester.user?.email && targetAuthUser.email === requester.user.email)
  );

  if (isSelfTarget) {
    throw createApiError(`Voce nao pode ${operationLabel} o proprio acesso.`, {
      statusCode: 403,
      code: 'USER_SELF_OPERATION_BLOCKED',
    });
  }

  if (
    isAdministrativeProfileType(targetProfile?.profile_type)
    && !canManageAdministrativeProfiles(requester.profile?.profile_type)
  ) {
    throw createApiError('Voce nao pode operar contas administrativas sensiveis.', {
      statusCode: 403,
      code: 'USER_SENSITIVE_TARGET_BLOCKED',
    });
  }
}

export default async function handler(req, res) {
  try {
    const requester = await requirePermissionRequest(req, PERMISSIONS.USERS_MANAGE);
    const auditActor = getAuditActorFromRequester(requester);

    const userId = typeof req.query?.userId === 'string' ? req.query.userId : '';
    if (!userId) {
      return sendJson(res, 400, { error: 'userId e obrigatorio.' });
    }

    const authUser = await findAuthUserById(userId, {
      tenantId: requester.tenantId || null,
    });
    if (!authUser?.id) {
      return sendJson(res, 404, { error: 'Usuario informado nao foi encontrado.' });
    }

    const targetProfile = authUser.email
      ? await findUserProfileAdmin({
          email: authUser.email,
          tenantId: requester.tenantId || null,
        })
      : null;

    if (req.method === 'PUT') {
      const password = req.body?.password;
      if (!password) {
        return sendJson(res, 400, { error: 'A nova senha e obrigatoria.' });
      }

      assertCanManageTargetUser({
        requester,
        targetProfile,
        targetAuthUser: authUser,
        operationLabel: 'redefinir',
      });

      const user = await resetAuthUserPassword(userId, password, {
        tenantId: requester.tenantId || null,
      });
      await insertManualAuditLog({
        actor: auditActor,
        action: AUDIT_ACTIONS.UPDATE,
        entityTable: 'auth_users',
        recordId: userId,
        previousRecord: { id: userId },
        newRecord: { id: userId },
        metadata: {
          source: 'api/admin/users/[userId]',
          operation: 'password_reset',
          initiated_by: requester.user.email || null,
        },
      });

      try {
        const recipientEmail = user?.user?.email || user?.email || null;
        const requestId = randomUUID();

        const notificationDispatch = await dispatchNotificationEvent({
          actor: auditActor,
          eventType: NOTIFICATION_EVENT_TYPES.ACCESS_RESET,
          payload: {
            recipientEmail,
            recipientName: user?.user?.user_metadata?.full_name || user?.user_metadata?.full_name || null,
            recipientProfileType: null,
            actorName: requester.profile?.full_name || requester.user.email || null,
            actionRecordId: userId,
          },
          metadata: {
            source: 'api/admin/users/[userId]',
            initiated_by: requester.user.email || null,
            request_id: requestId,
          },
        });

        for (const [headerName, headerValue] of Object.entries(
          buildSystemJobResponseHeaders(notificationDispatch?.job)
        )) {
          res.setHeader(headerName, headerValue);
        }
      } catch (notificationError) {
        console.warn('[api/admin/users/[userId]] Falha ao despachar notificacao de redefinicao de acesso.', notificationError);
      }

      return sendJson(res, 200, { user });
    }

    if (req.method === 'DELETE') {
      assertCanManageTargetUser({
        requester,
        targetProfile,
        targetAuthUser: authUser,
        operationLabel: 'excluir',
      });

      await deleteAuthUserAdmin(userId, {
        tenantId: requester.tenantId || null,
      });
      const profileResult = targetProfile?.id
        ? await deleteUserProfileAdmin({
            profileId: targetProfile.id,
            email: targetProfile.user_email || null,
            auditActor,
            tenantId: requester.tenantId || null,
          })
        : null;
      await insertManualAuditLog({
        actor: auditActor,
        action: AUDIT_ACTIONS.DELETE,
        entityTable: 'auth_users',
        recordId: userId,
        previousRecord: { id: userId },
        metadata: {
          source: 'api/admin/users/[userId]',
          initiated_by: requester.user.email || null,
        },
      });
      return sendJson(res, 200, {
        success: true,
        authUserDeleted: true,
        profileDeleted: Boolean(profileResult?.profileDeleted),
      });
    }

    res.setHeader('Allow', 'PUT, DELETE');
    return sendJson(res, 405, { error: 'Metodo nao permitido.' });
  } catch (error) {
    if (error?.statusCode === 405) {
      res.setHeader('Allow', 'PUT, DELETE');
    }
    return handleApiError(res, error);
  }
}
