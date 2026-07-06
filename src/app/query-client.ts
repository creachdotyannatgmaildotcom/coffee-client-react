import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/shared/api/http'

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // On ne réessaie que ce qui peut réussir au second coup : pannes
        // serveur (5xx) et échecs réseau. Un 4xx ou une dérive de contrat
        // (ZodError) donnera exactement la même réponse — inutile d'insister.
        retry: (failureCount, error) => {
          if (failureCount >= 3) return false
          if (error instanceof ApiError) return error.status >= 500
          return error instanceof TypeError
        },
      },
    },
  })
}
