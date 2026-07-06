import { createRootRoute, Outlet } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'

// Les devtools ne sont chargées qu'en dev : jamais en prod, ni pendant les tests.
const RouterDevtools =
  import.meta.env.PROD || import.meta.env.TEST
    ? () => null
    : lazy(() =>
        import('@tanstack/react-router-devtools').then((mod) => ({
          default: mod.TanStackRouterDevtools,
        })),
      )

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <>
      <Outlet />
      <Suspense>
        <RouterDevtools />
      </Suspense>
    </>
  )
}
