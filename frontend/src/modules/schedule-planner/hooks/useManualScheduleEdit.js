import { useMutation } from '@tanstack/react-query';
import { schedulePlannerAdminApi } from '../services/adminApi';

export function useManualScheduleEdit({ onSuccess, onError } = {}) {
  return useMutation({
    mutationFn: (payload) => schedulePlannerAdminApi.manualEdit(payload),
    onSuccess,
    onError,
  });
}

