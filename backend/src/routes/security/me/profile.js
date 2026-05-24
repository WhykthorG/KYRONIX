import {
  handleApiError,
  requireAuthenticatedRequest,
  sendJson,
} from '../../../database/supabaseAdminServer.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return sendJson(res, 405, { error: 'Metodo nao permitido.' });
    }

    const requester = await requireAuthenticatedRequest(req);

    return sendJson(res, 200, {
      profile: requester.profile || null,
      tenantId: requester.tenantId || null,
    });
  } catch (error) {
    return handleApiError(res, error);
  }
}
