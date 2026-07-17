import { randomUUID } from 'node:crypto';
import {
  createApiError,
  createServiceRoleClient,
  getAuditActorFromRequester,
  handleApiError,
  insertManualAuditLog,
  requirePermissionRequest,
  sendJson,
} from '../../database/supabaseAdminServer.js';
import { enforceRequestSecurity } from '../../middlewares/requestSecurity.js';
import { AUDIT_ACTIONS } from '../../../../shared/src/auditLog.js';
import { PERMISSIONS } from '../../../../shared/src/contracts/access.js';
import {
  normalizeReservationPayload,
  buildReservationMutationInput,
  isReservationConflict,
} from '../../../../shared/src/contracts/laboratory.js';

export default async function handler(req, res) {
  const traceId = randomUUID();
  try {
    const requester = await requirePermissionRequest(req, PERMISSIONS.LABORATORIES_READ);
    await enforceRequestSecurity({
      req,
      requester,
      routeKey: 'api/laboratories/reservations',
      action: req.method === 'GET' ? 'read' : 'write',
      metadata: { entity: 'lab_reservations' },
    });

    const serviceClient = createServiceRoleClient(getAuditActorFromRequester(requester));

    if (req.method === 'GET') {
      const { lab_id, date, status } = req.query || {};

      let query = serviceClient
        .from('lab_reservations')
        .select(`
          *,
          lab:laboratories(id, name, location)
        `)
        .order('date', { ascending: false })
        .order('start_time');

      if (lab_id) query = query.eq('lab_id', lab_id);
      if (date) query = query.eq('date', date);
      if (status) query = query.eq('status', status);

      const { data, error } = await query;

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'RESERVATIONS_FETCH_FAILED',
        });
      }

      return sendJson(res, 200, { reservations: data, traceId });
    }

    if (req.method === 'POST') {
      const input = buildReservationMutationInput(req.body || {});

      const { data: existingReservations } = await serviceClient
        .from('lab_reservations')
        .select('*')
        .eq('lab_id', input.lab_id)
        .eq('date', input.date)
        .neq('status', 'cancelada');

      if (isReservationConflict(input, existingReservations || [])) {
        throw createApiError('Conflito de horário com outra reserva.', {
          statusCode: 409,
          code: 'RESERVATION_CONFLICT',
        });
      }

      const { data, error } = await serviceClient
        .from('lab_reservations')
        .insert(input)
        .select()
        .single();

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'RESERVATION_CREATE_FAILED',
        });
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requester),
        action: AUDIT_ACTIONS.CREATE,
        entityTable: 'lab_reservations',
        recordId: data.id,
        newRecord: data,
        metadata: { source: 'api/laboratories/reservations', trace_id: traceId },
      });

      return sendJson(res, 201, { reservation: data, traceId });
    }

    if (req.method === 'PUT') {
      const id = req.query?.id || req.body?.id;
      if (!id) {
        throw createApiError('ID da reserva é obrigatório.', {
          statusCode: 400,
          code: 'RESERVATION_ID_REQUIRED',
        });
      }

      const input = normalizeReservationPayload(req.body || {});

      const { data, error } = await serviceClient
        .from('lab_reservations')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'RESERVATION_UPDATE_FAILED',
        });
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requester),
        action: AUDIT_ACTIONS.UPDATE,
        entityTable: 'lab_reservations',
        recordId: id,
        newRecord: data,
        metadata: { source: 'api/laboratories/reservations', trace_id: traceId },
      });

      return sendJson(res, 200, { reservation: data, traceId });
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id;
      if (!id) {
        throw createApiError('ID da reserva é obrigatório.', {
          statusCode: 400,
          code: 'RESERVATION_ID_REQUIRED',
        });
      }

      const { error } = await serviceClient
        .from('lab_reservations')
        .delete()
        .eq('id', id);

      if (error) {
        throw createApiError(error.message, {
          statusCode: 500,
          code: 'RESERVATION_DELETE_FAILED',
        });
      }

      await insertManualAuditLog({
        actor: getAuditActorFromRequester(requester),
        action: AUDIT_ACTIONS.DELETE,
        entityTable: 'lab_reservations',
        recordId: id,
        metadata: { source: 'api/laboratories/reservations', trace_id: traceId },
      });

      return sendJson(res, 200, { deleted: true, traceId });
    }

    res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return sendJson(res, 405, { error: 'Metodo nao permitido.' });
  } catch (error) {
    if (error?.statusCode === 405) {
      res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    }
    return handleApiError(res, error);
  }
}
