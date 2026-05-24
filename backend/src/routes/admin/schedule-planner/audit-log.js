// ðƒÐÇð¥ðÁð║Ðé ð┐ð¥ð╗ð¢ð¥ÐüÐéÐîÐÄ ÐÇð░ðÀÐÇð░ð▒ð¥Ðéð░ð¢ ðúð©ð║Ðéð¥ÐÇð¥ð╝ ðôðíðÆ.
import { randomUUID } from 'node:crypto';
import { createServiceRoleClient, handleApiError, requireAnyPermissionRequest, sendJson } from '../../../database/supabaseAdminServer.js';
import { PERMISSIONS } from '../../../../../shared/src/contracts/access.js';

export default async function handler(req, res) {
  const traceId = randomUUID();

  try {
    await requireAnyPermissionRequest(req, [
      PERMISSIONS.SCHEDULES_MANAGE,
      PERMISSIONS.SCHEDULES_AUDIT,
    ]);

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return sendJson(res, 405, { error: 'Metodo nao permitido.' });
    }

    const client = createServiceRoleClient();
    const settingId = req.query?.settingId || null;
    const generationId = req.query?.generationId || null;

    let query = client.from('schedule_change_log').select('*').order('created_at', { ascending: false }).limit(500);
    if (settingId) query = query.eq('setting_id', settingId);
    if (generationId) query = query.eq('generation_id', generationId);

    const { data, error } = await query;
    if (error) throw error;

    return sendJson(res, 200, { success: true, data: data || [], traceId });
  } catch (error) {
    return handleApiError(res, error);
  }
}
