import {
  createApiError,
  createRequestScopedClient,
  createServiceRoleClient,
  handleApiError,
  requireAuthenticatedRequest,
  sendJson,
} from '../../database/supabaseAdminServer.js';
import {
  DEFAULT_STORAGE_BUCKET,
  extractStoragePath,
  normalizeStorageFileReferences,
} from '../../../../shared/src/contracts/storage.js';

export default async function handler(req, res) {
  try {
    const requester = await requireAuthenticatedRequest(req);

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { error: 'Metodo nao permitido.' });
    }

    if (requester.profile?.profile_type !== 'responsavel' || requester.profile?.status !== 'ativo') {
      return sendJson(res, 403, { error: 'Voce nao tem permissao para acessar documentos do portal.' });
    }

    const studentId = typeof req.query?.studentId === 'string' ? req.query.studentId.trim() : '';
    const requestedPath = extractStoragePath(req.body?.filePath, DEFAULT_STORAGE_BUCKET);

    if (!studentId || !requestedPath) {
      return sendJson(res, 400, { error: 'studentId e filePath sao obrigatorios.' });
    }

    const scopedClient = createRequestScopedClient(req);
    const { data: students, error: studentsError } = await scopedClient
      .rpc('list_guardian_portal_students');

    if (studentsError) {
      throw createApiError(
        studentsError.message || 'Falha ao validar o vinculo do responsavel.',
        {
          statusCode: 500,
          code: 'GUARDIAN_STUDENT_DOCUMENTS_LOAD_FAILED',
          cause: studentsError,
        }
      );
    }

    const student = (students || []).find((item) => item.id === studentId);
    if (!student?.id) {
      return sendJson(res, 403, { error: 'Aluno não vinculado a este responsável.' });
    }

    const attachment = normalizeStorageFileReferences(student?.attachments, DEFAULT_STORAGE_BUCKET)
      .find((item) => item.file_path === requestedPath);

    if (!attachment?.file_path) {
      return sendJson(res, 404, { error: 'Documento permitido não encontrado para este aluno.' });
    }

    const bucket = attachment.bucket || DEFAULT_STORAGE_BUCKET;
    const serviceClient = createServiceRoleClient();
    const { data: signedData, error: signedUrlError } = await serviceClient.storage
      .from(bucket)
      .createSignedUrl(attachment.file_path, 3600);

    if (signedUrlError || !signedData?.signedUrl) {
      throw createApiError(
        signedUrlError?.message || 'Falha ao gerar o acesso temporario ao documento.',
        {
          statusCode: 500,
          code: 'GUARDIAN_DOCUMENT_SIGN_FAILED',
          cause: signedUrlError || null,
        }
      );
    }

    return sendJson(res, 200, {
      signedUrl: signedData.signedUrl,
      fileName: attachment.file_name || null,
      bucket,
      filePath: attachment.file_path,
    });
  } catch (error) {
    return handleApiError(res, error, { req });
  }
}
