// ßâ×ßâáßâØßâößâÑßâóßâÿ ßâößâÑßâíßâÖßâÜßâúßâûßâÿßâúßâáßâÉßâô Whykthor GSV-ßâÿßâí ßâøßâÿßâößâá ßâ¿ßâößâÿßâÑßâøßâ£ßâÉ.
import { handleSupabaseProxyRequest } from '../../../services/supabaseProxyServer.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  return handleSupabaseProxyRequest(req, res, {
    pathParts: req.params?.path || req.query?.path || [],
  });
}
