import { useQuery } from '@tanstack/react-query';
import { schedulePlannerAdminApi } from '../services/adminApi';

export function useScheduleConflicts(generationId) {
  return useQuery({
    queryKey: ['schedule-conflicts-admin', generationId],
    queryFn: () => schedulePlannerAdminApi.listConflicts(generationId),
    enabled: Boolean(generationId),
  });
}

