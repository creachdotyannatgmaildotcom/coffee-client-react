import { createRouter, type RouterHistory } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'

// Fabrique unique du routeur : l'application l'utilise sans argument (history
// navigateur), les tests injectent une memory history pour piloter l'URL.
export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    ...(history ? { history } : {}),
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
