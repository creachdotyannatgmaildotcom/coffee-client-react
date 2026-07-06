import { useQueryErrorResetBoundary } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Suspense, useEffect } from 'react'
import { CoffeeList } from '@/features/coffees'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'

export const Route = createFileRoute('/$locale/coffees/')({
  errorComponent: CoffeesError,
  component: CoffeesPage,
})

function CoffeesPage() {
  const { locale } = Route.useParams()
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Nos cafés</h2>
      <Suspense fallback={<CoffeeListSkeleton />}>
        <CoffeeList locale={locale} />
      </Suspense>
    </section>
  )
}

function CoffeeListSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-2" aria-label="Chargement des cafés">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  )
}

// Panne (réseau, 5xx, dérive de contrat) : on l'affiche, on propose de
// réessayer. Le reset de React Query est indispensable : sans lui, la query
// en erreur resterait en erreur et le retry re-planterait immédiatement.
function CoffeesError() {
  const router = useRouter()
  const { reset } = useQueryErrorResetBoundary()

  useEffect(() => {
    reset()
  }, [reset])

  return (
    <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive p-4">
      <p className="font-medium text-destructive">Impossible de charger les cafés.</p>
      <p className="text-muted-foreground text-sm">
        Le serveur est peut-être indisponible, ou sa réponse n'a pas la forme attendue.
      </p>
      <Button variant="outline" onClick={() => router.invalidate()}>
        Réessayer
      </Button>
    </div>
  )
}
