import {
  createApiError,
  createRequestScopedClient,
  handleApiError,
  requireAuthenticatedRequest,
  sendJson,
} from '../../database/supabaseAdminServer.js';

export default async function handler(req, res) {
  try {
    const requester = await requireAuthenticatedRequest(req);

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return sendJson(res, 405, { error: 'Metodo nao permitido.' });
    }

    if (requester.profile?.profile_type !== 'responsavel' || requester.profile?.status !== 'ativo') {
      return sendJson(res, 403, { error: 'Voce nao tem permissao para acessar o portal do responsavel.' });
    }

    const serviceClient = createRequestScopedClient(req);
    const { data: students, error: studentsError } = await serviceClient
      .rpc('list_guardian_portal_students');

    if (studentsError) {
      throw createApiError(
        studentsError.message || 'Falha ao carregar os alunos vinculados ao responsavel.',
        {
          statusCode: 500,
          code: 'GUARDIAN_STUDENTS_LOAD_FAILED',
          cause: studentsError,
        }
      );
    }

    return sendJson(res, 200, {
      data: students || [],
    });
  } catch (error) {
    return handleApiError(res, error, { req });
  }
}
