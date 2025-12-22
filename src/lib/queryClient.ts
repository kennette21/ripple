import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 1 minute
      staleTime: 1000 * 60,
      // Cache is kept for 5 minutes after becoming unused
      gcTime: 1000 * 60 * 5,
      // Retry failed requests up to 3 times
      retry: 3,
      // Refetch on window focus (useful for mobile app state changes)
      refetchOnWindowFocus: true,
      // Don't refetch on mount if data is still fresh
      refetchOnMount: true,
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
    },
  },
});
