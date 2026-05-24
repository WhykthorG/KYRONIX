// Þ®▓Úáàþø«Õ«îÕà¿þö▒ Whykthor GSV Þú¢õ¢£
import { useQuery } from '@tanstack/react-query';
import { schedulePlannerAdminApi } from '../services/adminApi';

export function useScheduleVersions(settingId) {
  return useQuery({
    queryKey: ['schedule-versions', settingId],
    queryFn: () => schedulePlannerAdminApi.listVersions(settingId),
    enabled: Boolean(settingId),
  });
}
