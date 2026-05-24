import { useQuery } from '@tanstack/react-query';
import { schedulePlannerAdminApi } from '../services/adminApi';

export function useScheduleSuggestions(generationId) {
  return useQuery({
    queryKey: ['schedule-suggestions-admin', generationId],
    queryFn: () => schedulePlannerAdminApi.listSuggestions(generationId),
    enabled: Boolean(generationId),
  });
}

