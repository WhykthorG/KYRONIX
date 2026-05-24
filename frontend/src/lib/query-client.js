// ┌ñÏ▒┘êÏ»┘ê┘é Ïº┘è┘å Ï»┌ñÏ▒Ï¿┘êÏºÏ¬ Ï│┌ñ┘å┘ê┘ç┌¢ Ïº┘ê┘ä┘è┘ç Whyktor GSV.
import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 2 * 60 * 1000,      // 2 min — avoid redundant refetches across windows
			gcTime: 10 * 60 * 1000,         // 10 min in cache before garbage collection
			refetchOnWindowFocus: false,     // no refetch when switching browser tabs
			retry: 1,
		},
	},
});
