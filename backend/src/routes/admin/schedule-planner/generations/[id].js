// ┌ñÏ▒┘êÏ»┘ê┘é Ïº┘è┘å Ï»┌ñÏ▒Ï¿┘êÏºÏ¬ Ï│┌ñ┘å┘ê┘ç┌¢ Ïº┘ê┘ä┘è┘ç Whyktor GSV.
import { randomUUID } from 'node:crypto';
import { createServiceRoleClient, handleApiError, requireAnyPermissionRequest, sendJson } from '../../../../database/supabaseAdminServer.js';
import { PERMISSIONS } from '../../../../../../shared/src/contracts/access.js';

export default async function handler(req, res) {
  const traceId = randomUUID();

  try {
    await requireAnyPermissionRequest(req, [
      PERMISSIONS.SCHEDULES_MANAGE,
      PERMISSIONS.SCHEDULES_VIEW,
      PERMISSIONS.SCHEDULES_AUDIT,
    ]);

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return sendJson(res, 405, { error: 'Metodo nao permitido.' });
    }

    const generationId = req.params?.id || req.query?.id;
    if (!generationId) {
      return sendJson(res, 400, { success: false, error: 'generationId é obrigatório.', traceId });
    }

    const client = createServiceRoleClient();
    const [generation, entries, conflicts, suggestions, versions] = await Promise.all([
      client.from('schedule_generations').select('*').eq('id', generationId).maybeSingle(),
      client.from('schedule_entries').select('*').eq('generation_id', generationId).order('day_of_week'),
      client.from('schedule_conflicts').select('*').eq('generation_id', generationId).order('created_at', { ascending: false }),
      client.from('schedule_suggestions').select('*').eq('generation_id', generationId).order('created_at', { ascending: false }),
      client.from('schedule_versions_overview').select('*').eq('generation_id', generationId).order('version_number', { ascending: false }),
    ]);

    return sendJson(res, 200, {
      success: true,
      data: {
        generation: generation.data || null,
        entries: entries.data || [],
        conflicts: conflicts.data || [],
        suggestions: suggestions.data || [],
        versions: versions.data || [],
      },
      traceId,
    });
  } catch (error) {
    return handleApiError(res, error);
  }
}
