// ßâ×ßâáßâØßâößâÑßâóßâÿ ßâößâÑßâíßâÖßâÜßâúßâûßâÿßâúßâáßâÉßâô Whykthor GSV-ßâÿßâí ßâøßâÿßâößâá ßâ¿ßâößâÿßâÑßâøßâ£ßâÉ.
import { randomUUID } from 'node:crypto';
import { dispatchNotificationEvent } from '../../../services/notificationsServer.js';
import {
  createApiError,
  createServiceRoleClient,
  getAuditActorFromRequester,
  handleApiError,
  requirePermissionRequest,
  sendJson,
} from '../../../database/supabaseAdminServer.js';
import { ensureAvailabilityForms } from '../../../services/schedulePlannerServer.js';
import { PERMISSIONS } from '../../../../../shared/src/contracts/access.js';
import { NOTIFICATION_EVENT_TYPES } from '../../../../../shared/src/contracts/notifications.js';

export default async function handler(req, res) {
  const traceId = randomUUID();

  try {
    const requester = await requirePermissionRequest(req, PERMISSIONS.SCHEDULES_MANAGE);

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { error: 'Metodo nao permitido.' });
    }

    const settingId = req.body?.settingId;
    const teacherIds = Array.isArray(req.body?.teacherIds) ? req.body.teacherIds : [];
    const dueAt = req.body?.dueAt || null;
    const note = req.body?.note || null;

    if (!settingId) {
      throw createApiError('settingId é obrigatório para enviar os questionários.', {
        statusCode: 400,
        code: 'SCHEDULE_QUESTIONNAIRES_SETTING_REQUIRED',
        traceId,
      });
    }

    const actor = getAuditActorFromRequester(requester);
    const forms = await ensureAvailabilityForms({
      settingId,
      teacherIds,
      requestedBy: requester.user.id,
      dueAt,
      note,
      actor,
    });

    const recipients = forms
      .map((form) => form.teacher_id)
      .filter(Boolean);

    const teacherRecipientProfiles = teacherIds.length > 0
      ? (
        await createServiceRoleClient(actor)
          .from('teachers')
          .select('id, full_name, email')
          .in('id', recipients)
      ).data || []
      : [];

    if (teacherRecipientProfiles.length > 0) {
      try {
        await dispatchNotificationEvent({
          actor,
          eventType: NOTIFICATION_EVENT_TYPES.MESSAGE_POSTED,
          recipients: teacherRecipientProfiles.map((teacher) => ({
            email: teacher.email,
            name: teacher.full_name,
            profileType: 'professor',
          })),
          payload: {
            subject: 'Questionário de disponibilidade para horário escolar',
            content: note || 'Há um novo questionário de disponibilidade aguardando sua resposta no módulo de horários.',
            senderName: requester.profile?.full_name || requester.user.email || 'Coordenação',
            recipientType: 'professor',
            channels: ['app'],
          },
          metadata: {
            source: 'api/admin/schedule-planner/questionnaires',
            trace_id: traceId,
            setting_id: settingId,
          },
        });
      } catch (notificationError) {
        console.warn('[api/admin/schedule-planner/questionnaires] notification dispatch failed', {
          traceId,
          settingId,
          error: notificationError?.message || notificationError,
        });
      }
    }

    return sendJson(res, 200, {
      success: true,
      forms,
      dispatchedCount: forms.length,
      traceId,
    });
  } catch (error) {
    return handleApiError(res, error);
  }
}
