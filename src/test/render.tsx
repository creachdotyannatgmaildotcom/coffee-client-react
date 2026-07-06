import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import { createAppRouter } from '@/app/router'

// retry: false — en test, un échec doit échouer tout de suite, pas après
// trois tentatives espacées. Le reste du comportement reste celui de l'app.
export function makeTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
}

// Monte l'application complète (routeur + query client) à une URL donnée,
// comme le ferait un navigateur — les tests pilotent l'app par ses URL.
export function renderAt(url: string, queryClient = makeTestQueryClient()) {
  const router = createAppRouter(queryClient, createMemoryHistory({ initialEntries: [url] }))
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { router, queryClient }
}
