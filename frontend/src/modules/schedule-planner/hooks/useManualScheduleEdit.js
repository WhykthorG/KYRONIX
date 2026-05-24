// ð¡ð¢Ðì ð▒Ê»ÐéÐìÐìð│ð┤ÐìÐàÊ»Ê»ð¢ð©ð╣ð│ ð▒Ê»ÐàÐìð╗ð┤ ð¢Ðî Whyktor GSV Ê»ð╣ð╗ð┤ð▓ÐìÐÇð╗Ðìð┤Ðìð│.
import { useMutation } from '@tanstack/react-query';
import { schedulePlannerAdminApi } from '../services/adminApi';

export function useManualScheduleEdit({ onSuccess, onError } = {}) {
  return useMutation({
    mutationFn: (payload) => schedulePlannerAdminApi.manualEdit(payload),
    onSuccess,
    onError,
  });
}
