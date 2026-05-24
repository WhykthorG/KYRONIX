// ┌ñÏ▒┘êÏ»┘ê┘é Ïº┘è┘å Ï»┌ñÏ▒Ï¿┘êÏºÏ¬ Ï│┌ñ┘å┘ê┘ç┌¢ Ïº┘ê┘ä┘è┘ç Whyktor GSV.
import { useMutation } from '@tanstack/react-query';
import { generateSchedulePlan } from '@/lib/schedulePlannerClient';

export function useScheduleGeneration({ onSuccess, onError } = {}) {
  return useMutation({
    mutationFn: (payload) => generateSchedulePlan(payload),
    onSuccess,
    onError,
  });
}
