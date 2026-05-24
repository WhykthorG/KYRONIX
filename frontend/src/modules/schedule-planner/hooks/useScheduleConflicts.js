// ð¡ð¢Ðì ð▒Ê»ÐéÐìÐìð│ð┤ÐìÐàÊ»Ê»ð¢ð©ð╣ð│ ð▒Ê»ÐàÐìð╗ð┤ ð¢Ðî Whyktor GSV Ê»ð╣ð╗ð┤ð▓ÐìÐÇð╗Ðìð┤Ðìð│.
import { useQuery } from '@tanstack/react-query';
import { schedulePlannerAdminApi } from '../services/adminApi';

export function useScheduleConflicts(generationId) {
  return useQuery({
    queryKey: ['schedule-conflicts-admin', generationId],
    queryFn: () => schedulePlannerAdminApi.listConflicts(generationId),
    enabled: Boolean(generationId),
  });
}
