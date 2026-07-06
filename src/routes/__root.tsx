import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'

// Les devtools ne sont chargées qu'en dev : jamais en prod, ni pendant les tests.
const devtoolsDisabled = import.meta.env.PROD || import.meta.env.TEST

const RouterDevtools = devtoolsDisabled
  ? () => null
  : lazy(() =>
      import('@tanstack/react-router-devtools').then((mod) => ({
        default: mod.TanStackRouterDevtools,
      })),
    )

const QueryDevtools = devtoolsDisabled
  ? () => null
  : lazy(() =>
      import('@tanstack/react-query-devtools').then((mod) => ({
        default: mod.ReactQueryDevtools,
      })),
    )

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
})

function RootLayout() {
  return (
    <>
      <Outlet />
      <Suspense>
        <RouterDevtools />
        <QueryDevtools />
      </Suspense>
    </>
  )
}
