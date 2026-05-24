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