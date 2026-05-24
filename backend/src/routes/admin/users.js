// ð¡ð¢Ðì ð▒Ê»ÐéÐìÐìð│ð┤ÐìÐàÊ»Ê»ð¢ð©ð╣ð│ ð▒Ê»ÐàÐìð╗ð┤ ð¢Ðî Whyktor GSV Ê»ð╣ð╗ð┤ð▓ÐìÐÇð╗Ðìð┤Ðìð│.
import {
  createApiError,
  createAuthUserAdmin,
  deleteAuthUserAdmin,
  getAuditActorFromRequester,
  deleteUserProfileAdmin,
  findAuthUserByEmail,
  findUserProfileAdmin,
  handleApiError,
  insertManualAuditLog,
  requirePermissionRequest,
  sendJson,
} from '../../database/supabaseAdminServer.js';
import { enforceRequestSecurity } from '../../middlewares/requestSecurity.js';
import { AUDIT_ACTIONS } from '../../../../shared/src/auditLog.js';
import {
  canManageAdministrativeProfiles,
  isAdministrativeProfileType,
  PERMISSIONS,
} from '../../../../shared/src/contracts/access.js';
import {
  adminUserCreateSchema,
  adminUserDeleteSchema,
  adminUsersQuerySchema,
  parseRequestSchema,
} from '../../middlewares/requestSchemas.js';

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
    await enforceRequestSecurity({
      req,
      requester,
      routeKey: 'api/admin/users',
      action: 'admin',
      metadata: {
        entity: 'auth_users',
        method: req.method,
      },
    });

    if (req.method === 'GET') {
      const query = parseRequestSchema(adminUsersQuerySchema, {
        email: typeof req.query?.email === 'string' ? req.query.email : '',
      }, {
        code: 'ADMIN_USER_QUERY_INVALID',
        message: 'O parametro email e obrigatorio.',
      });

      const user = await findAuthUserByEmail(query.email, { tenantId: requester.tenantId || null });
      return sendJson(res, 200, { user });
    }

    if (req.method === 'POST') {
      const body = parseRequestSchema(adminUserCreateSchema, req.body || {}, {
        code: 'ADMIN_USER_CREATE_INVALID',
        message: 'Email e password sao obrigatorios.',
      });

      const existing = await findAuthUserByEmail(body.email, { tenantId: requester.tenantId || null });
      if (existing) {
        return sendJson(res, 409, { error: 'Este e-mail ja esta cadastrado no sistema.' });
      }

      const user = await createAuthUserAdmin(body.email, body.password, {
        tenantId: requester.tenantId || null,
      });
      await insertManualAuditLog({
        actor: auditActor,
        action: AUDIT_ACTIONS.CREATE,
        entityTable: 'auth_users',
        recordId: user.id,
        newRecord: { id: user.id, email: user.email },
        metadata: {
          source: 'api/admin/users',
          initiated_by: requester.user.email || null,
        },
      });
      return sendJson(res, 201, { user });
    }

    if (req.method === 'DELETE') {
      const query = parseRequestSchema(adminUserDeleteSchema, {
        email: typeof req.query?.email === 'string' ? req.query.email : undefined,
        profileId: typeof req.query?.profileId === 'string' ? req.query.profileId : undefined,
      }, {
        code: 'ADMIN_USER_DELETE_INVALID',
        message: 'Informe email ou profileId para excluir o usuario.',
      });

      const profile = await findUserProfileAdmin({
        profileId: query.profileId || '',
        email: query.email || '',
        tenantId: requester.tenantId || null,
      });

      if (query.profileId && !profile) {
        return sendJson(res, 404, { error: 'Perfil informado nao foi encontrado.' });
      }

      if (query.email && query.profileId && profile?.user_email !== query.email) {
        return sendJson(res, 409, { error: 'email e profileId referenciam usuarios diferentes.' });
      }

      const resolvedEmail = query.email || profile?.user_email || '';
      let authUser = null;
      if (resolvedEmail) {
        authUser = await findAuthUserByEmail(resolvedEmail, {
          tenantId: requester.tenantId || null,
        });
      }

      if (!profile && !authUser) {
        return sendJson(res, 404, { error: 'Usuario informado nao foi encontrado.' });
      }

      assertCanManageTargetUser({
        requester,
        targetProfile: profile,
        targetAuthUser: authUser,
        operationLabel: 'excluir',
      });

      if (authUser?.id) {
        await deleteAuthUserAdmin(authUser.id, {
          tenantId: requester.tenantId || null,
        });
        await insertManualAuditLog({
          actor: auditActor,
          action: AUDIT_ACTIONS.DELETE,
          entityTable: 'auth_users',
          recordId: authUser.id,
          previousRecord: { id: authUser.id, email: authUser.email },
          metadata: {
            source: 'api/admin/users',
            initiated_by: requester.user.email || null,
          },
        });
      }

      const profileResult = await deleteUserProfileAdmin({
        profileId: profile?.id || query.profileId,
        email: resolvedEmail || null,
        auditActor,
        tenantId: requester.tenantId || null,
      });

      return sendJson(res, 200, {
        success: true,
        authUserDeleted: Boolean(authUser?.id),
        profileDeleted: Boolean(profileResult?.profileDeleted),
      });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return sendJson(res, 405, { error: 'Metodo nao permitido.' });
  } catch (error) {
    return handleApiError(res, error);
  }
}
