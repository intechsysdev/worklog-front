import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './api'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Un 4xx es determinista: reintentarlo solo genera ruido.
        if (error instanceof ApiError && error.status < 500) return false
        return failureCount < 2
      },
    },
  },
})
