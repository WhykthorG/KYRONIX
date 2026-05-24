// ┌ñÏ▒┘êÏ»┘ê┘é Ïº┘è┘å Ï»┌ñÏ▒Ï¿┘êÏºÏ¬ Ï│┌ñ┘å┘ê┘ç┌¢ Ïº┘ê┘ä┘è┘ç Whyktor GSV.
import {
  createApiError,
  createServiceRoleClient,
  getAuditActorFromRequester,
  handleApiError,
  requireAuthenticatedRequest,
  sendJson,
} from '../../../database/supabaseAdminServer.js';
import { enforceRequestSecurity } from '../../../middlewares/requestSecurity.js';
import { parseRequestSchema, chatConversationSchema } from '../../../middlewares/requestSchemas.js';
import { buildDirectConversationId } from '../../../../../shared/src/contracts/chat.js';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isUniqueViolation(error) {
  return error?.code === '23505';
}

async function hydrateConversationParticipants(serviceClient, conversations = []) {
  const conversationIds = conversations.map((conversation) => conversation.id).filter(Boolean);
  if (conversationIds.length === 0) {
    return [];
  }

  const { data: participants, error: participantsError } = await serviceClient
    .from('chat_conversation_participants')
    .select('conversation_id, participant_email, role, joined_at')
    .in('conversation_id', conversationIds);

  if (participantsError) {
    throw createApiError(
      participantsError.message || 'Falha ao carregar participantes das conversas.',
      {
        statusCode: 500,
        code: 'CHAT_CONVERSATION_PARTICIPANTS_LOOKUP_FAILED',
        cause: participantsError,
      }
    );
  }

  const participantsByConversationId = new Map();
  for (const participant of participants || []) {
    if (!participantsByConversationId.has(participant.conversation_id)) {
      participantsByConversationId.set(participant.conversation_id, []);
    }
    participantsByConversationId.get(participant.conversation_id).push(participant);
  }

  return conversations.map((conversation) => ({
    ...conversation,
    participants: participantsByConversationId.get(conversation.id) || [],
  }));
}

async function hydrateConversationLatestMessages(serviceClient, conversations = []) {
  const conversationIds = conversations.map((conversation) => conversation.id).filter(Boolean);
  if (conversationIds.length === 0) {
    return conversations;
  }

  const { data: messages, error } = await serviceClient
    .from('direct_messages')
    .select('id, conversation_id, sender_email, sender_name, content, message_type, media_metadata, created_at')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: false })
    .limit(Math.max(100, conversationIds.length * 5));

  if (error) {
    throw createApiError(error.message || 'Falha ao carregar ultimas mensagens das conversas.', {
      statusCode: 500,
      code: 'CHAT_CONVERSATION_LAST_MESSAGE_FAILED',
      cause: error,
    });
  }

  const latestMessageByConversationId = new Map();
  for (const message of messages || []) {
    if (!latestMessageByConversationId.has(message.conversation_id)) {
      latestMessageByConversationId.set(message.conversation_id, message);
    }
  }

  return conversations.map((conversation) => ({
    ...conversation,
    last_message: latestMessageByConversationId.get(conversation.id) || null,
  }));
}

async function findDirectConversationByKey(serviceClient, directKey) {
  const { data, error } = await serviceClient
    .from('chat_conversations')
    .select('*')
    .eq('type', 'direct')
    .eq('direct_key', directKey)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw createApiError(
      error.message || 'Falha ao localizar conversa direta existente.',
      {
        statusCode: 500,
        code: 'CHAT_DIRECT_LOOKUP_FAILED',
        cause: error,
      }
    );
  }

  if (!data?.id) {
    return null;
  }

  const hydratedWithParticipants = await hydrateConversationParticipants(serviceClient, [data]);
  const hydrated = await hydrateConversationLatestMessages(serviceClient, hydratedWithParticipants);
  return hydrated[0] || null;
}

export default async function handler(req, res) {
  try {
    const requester = await requireAuthenticatedRequest(req);
    const serviceClient = createServiceRoleClient(getAuditActorFromRequester(requester));
    const requesterEmail = normalizeEmail(requester.user.email);

    if (req.method === 'GET') {
      await enforceRequestSecurity({
        req,
        requester,
        routeKey: 'api/chat/conversations',
        action: 'read',
        metadata: { entity: 'chat_conversations' },
      });

      const { data, error } = await serviceClient
        .from('chat_conversation_participants')
        .select('conversation_id, role, joined_at, chat_conversations(*)')
        .eq('participant_email', requesterEmail)
        .order('joined_at', { ascending: false })
        .limit(100);

      if (error) {
        throw createApiError(error.message || 'Falha ao listar conversas.', {
          statusCode: 500,
          code: 'CHAT_CONVERSATIONS_LIST_FAILED',
          cause: error,
        });
      }

      const conversationsWithParticipants = await hydrateConversationParticipants(
        serviceClient,
        (data || []).map((row) => ({
          ...row.chat_conversations,
          participant_role: row.role,
          joined_at: row.joined_at,
        }))
      );
      const conversations = await hydrateConversationLatestMessages(
        serviceClient,
        conversationsWithParticipants
      );

      return sendJson(res, 200, {
        conversations,
      });
    }

    if (req.method === 'POST') {
      await enforceRequestSecurity({
        req,
        requester,
        routeKey: 'api/chat/conversations',
        action: 'write',
        metadata: { entity: 'chat_conversations' },
      });

      const payload = parseRequestSchema(chatConversationSchema, req.body || {}, {
        code: 'CHAT_CONVERSATION_INVALID',
        message: 'Payload de conversa invalido.',
      });

      const participantEmails = [...new Set(
        [requesterEmail, ...payload.participantEmails.map(normalizeEmail)]
      )];
      const isDirectConversation = payload.type === 'direct';
      const directKey = isDirectConversation
        ? buildDirectConversationId(participantEmails[0], participantEmails[1])
        : null;

      if (isDirectConversation && participantEmails.length !== 2) {
        throw createApiError('Conversas diretas exigem exatamente dois participantes.', {
          statusCode: 400,
          code: 'CHAT_DIRECT_PARTICIPANTS_INVALID',
        });
      }

      if (isDirectConversation) {
        const existingConversation = await findDirectConversationByKey(serviceClient, directKey);
        if (existingConversation?.id) {
          await serviceClient
            .from('chat_conversation_participants')
            .upsert(
              participantEmails.map((email) => ({
                conversation_id: existingConversation.id,
                participant_email: email,
                role: email === requesterEmail ? 'owner' : 'member',
              })),
              { onConflict: 'conversation_id,participant_email' }
            );

          return sendJson(res, 200, {
            conversation: existingConversation,
            participants: existingConversation.participants || [],
            existing: true,
          });
        }
      }

      let conversation = null;
      let conversationError = null;
      let existing = false;

      const insertResult = await serviceClient
        .from('chat_conversations')
        .insert({
          type: payload.type,
          title: payload.type === 'group' ? payload.title || 'Novo grupo' : null,
          created_by_email: requesterEmail,
          direct_key: directKey,
        })
        .select('*')
        .single();

      conversation = insertResult.data || null;
      conversationError = insertResult.error || null;

      if (conversationError && isDirectConversation && isUniqueViolation(conversationError)) {
        existing = true;
        conversation = await findDirectConversationByKey(serviceClient, directKey);
        conversationError = null;
      }

      if (conversationError || !conversation?.id) {
        throw createApiError(
          conversationError?.message || 'Falha ao criar conversa.',
          {
            statusCode: 500,
            code: 'CHAT_CONVERSATION_CREATE_FAILED',
            cause: conversationError || null,
          }
        );
      }

      const participantRows = participantEmails.map((email) => ({
        conversation_id: conversation.id,
        participant_email: email,
        role: email === requesterEmail ? 'owner' : 'member',
      }));

      const { error: participantsError } = await serviceClient
        .from('chat_conversation_participants')
        .upsert(participantRows, { onConflict: 'conversation_id,participant_email' });

      if (participantsError) {
        throw createApiError(
          participantsError.message || 'Falha ao adicionar participantes.',
          {
            statusCode: 500,
            code: 'CHAT_CONVERSATION_PARTICIPANTS_FAILED',
            cause: participantsError,
          }
        );
      }

      const hydratedWithParticipants = await hydrateConversationParticipants(serviceClient, [conversation]);
      const hydratedConversation = await hydrateConversationLatestMessages(serviceClient, hydratedWithParticipants);

      return sendJson(res, existing ? 200 : 201, {
        conversation: hydratedConversation[0],
        participants: participantRows,
        ...(existing ? { existing: true } : {}),
      });
    }

    throw createApiError('Metodo nao permitido.', {
      statusCode: 405,
      code: 'METHOD_NOT_ALLOWED',
    });
  } catch (error) {
    if (error?.statusCode === 405) {
      res.setHeader('Allow', 'GET, POST');
    }

    return handleApiError(res, error, { req });
  }
}
