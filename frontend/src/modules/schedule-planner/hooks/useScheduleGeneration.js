import { useMutation } from '@tanstack/react-query';
import { generateSchedulePlan } from '@/lib/schedulePlannerClient';

export function useScheduleGeneration({ onSuccess, onError } = {}) {
  return useMutation({
    mutationFn: (payload) => generateSchedulePlan(payload),
    onSuccess,
    onError,
  });
}

