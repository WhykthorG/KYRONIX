// ┌ñÏ▒┘êÏ»┘ê┘é Ïº┘è┘å Ï»┌ñÏ▒Ï¿┘êÏºÏ¬ Ï│┌ñ┘å┘ê┘ç┌¢ Ïº┘ê┘ä┘è┘ç Whyktor GSV.
import { randomUUID } from 'node:crypto';
import { createServiceRoleClient, handleApiError, requireAnyPermissionRequest, sendJson } from '../../../database/supabaseAdminServer.js';
import { PERMISSIONS } from '../../../../../shared/src/contracts/access.js';

export default async function handler(req, res) {
  const traceId = randomUUID();

  try {
    await requireAnyPermissionRequest(req, [
      PERMISSIONS.SCHEDULES_MANAGE,
      PERMISSIONS.SCHEDULES_VIEW,
      PERMISSIONS.SCHEDULES_AUDIT,
      PERMISSIONS.SCHEDULES_PUBLISH,
    ]);

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return sendJson(res, 405, { error: 'Metodo nao permitido.' });
    }

    const client = createServiceRoleClient();
    const settingId = req.query?.settingId || null;

    let query = client.from('schedule_versions_overview').select('*').order('version_number', { ascending: false }).limit(200);
    if (settingId) {
      query = query.eq('setting_id', settingId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return sendJson(res, 200, { success: true, data: data || [], traceId });
  } catch (error) {
    return handleApiError(res, error);
  }
}
