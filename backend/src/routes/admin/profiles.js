// Þ®▓Úáàþø«Õ«îÕà¿þö▒ Whykthor GSV Þú¢õ¢£
import {
  createAuthUserAdmin,
  createServiceRoleClient,
  deleteAuthUserAdmin,
  findAuthUserByEmail,
  getAuditActorFromRequester,
  handleApiError,
  insertManualAuditLog,
  requirePermissionRequest,
  sendJson,
} from '../../database/supabaseAdminServer.js';
import { AUDIT_ACTIONS } from '../../../../shared/src/auditLog.js';
import {
  canManageAdministrativeProfiles,
  isAdministrativeProfileType,
  PERMISSIONS,
} from '../../../../shared/src/contracts/access.js';

const ALLOWED_PROFILE_TYPES = ['professor', 'coordenador', 'secretario', 'administrador'];

export default async function handler(req, res) {
  try {
    const requester = await requirePermissionRequest(req, PERMISSIONS.USERS_MANAGE);

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { error: 'Metodo nao permitido.' });
    }

    const email = req.body?.email?.trim()?.toLowerCase();
    const password = req.body?.password;
    const fullName = req.body?.full_name?.trim();
    const profileType = req.body?.profile_type;

    if (!email || !password || !fullName || !profileType) {
      return sendJson(res, 400, { error: 'Email, password, full_name e profile_type sao obrigatorios.' });
    }

    if (!ALLOWED_PROFILE_TYPES.includes(profileType)) {
      return sendJson(res, 400, { error: 'Perfil informado e invalido para este fluxo.' });
    }

    if (
      isAdministrativeProfileType(profileType)
      && !canManageAdministrativeProfiles(requester.profile.profile_type)
    ) {
      return sendJson(res, 403, { error: 'Voce nao pode criar perfis administrativos.' });
    }

    const existing = await findAuthUserByEmail(email, {
      tenantId: requester.tenantId || null,
    });
    if (existing) {
      return sendJson(res, 409, { error: 'Este e-mail ja esta cadastrado no sistema.' });
    }

    const auditActor = getAuditActorFromRequester(requester);
    const serviceClient = createServiceRoleClient(auditActor);
    let authUser = null;

    try {
      authUser = await createAuthUserAdmin(email, password, {
        tenantId: requester.tenantId || null,
      });
      await insertManualAuditLog({
        actor: auditActor,
        action: AUDIT_ACTIONS.CREATE,
        entityTable: 'auth_users',
        recordId: authUser.id,
        newRecord: { id: authUser.id, email: authUser.email },
        metadata: {
          source: 'api/admin/profiles',
          initiated_by: requester.user.email || null,
        },
      });

      const { data: profile, error: profileError } = await serviceClient
        .from('user_profiles')
        .insert({
          tenant_id: requester.tenantId || null,
          full_name: fullName,
          user_email: email,
          phone: req.body?.phone || null,
          birth_date: req.body?.birth_date || null,
          document_id: req.body?.document_id || null,
          address: req.body?.address || null,
          department: req.body?.department || null,
          notes: req.body?.notes || null,
          profile_type: profileType,
          status: 'ativo',
          approved_at: new Date().toISOString(),
          approved_by: requester.user.email || null,
        })
        .select()
        .single();

      if (profileError) throw profileError;

      return sendJson(res, 201, {
        user: authUser,
        profile,
      });
    } catch (error) {
      if (authUser?.id) {
        try {
          await deleteAuthUserAdmin(authUser.id, {
            tenantId: requester.tenantId || null,
          });
        } catch {
          // best effort rollback
        }
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(res, error);
  }
}
