import type { QueryClient } from '@tanstack/react-query'
import { createRouter, type RouterHistory } from '@tanstack/react-router'
import { DefaultNotFound } from '@/app/default-not-found'
import { routeTree } from '@/routeTree.gen'

// Fabrique unique du routeur : l'application l'utilise avec l'history
// navigateur, les tests injectent une memory history pour piloter l'URL.
// Le queryClient passe par le contexte du routeur : les loaders y accèdent.
export function createAppRouter(queryClient: QueryClient, history?: RouterHistory) {
  return createRouter({
    routeTree,
    context: { queryClient },
    // Survoler un lien précharge sa route (loader compris) : la page suivante
    // est souvent déjà en cache au moment du clic. staleTime 0 côté routeur :
    // c'est React Query qui décide de la fraîcheur, pas le routeur.
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: DefaultNotFound,
    ...(history ? { history } : {}),
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
