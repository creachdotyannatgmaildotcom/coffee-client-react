import { useQuery, useQueryErrorResetBoundary } from '@tanstack/react-query'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { z } from 'zod'
import { CoffeeList, coffeesPageOptions } from '@/features/coffees'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'

// La query string est une entrée utilisateur : on la parse. Tout ce qui n'est
// pas un entier ≥ 0 (`?page=banane`, `?page=-3`) retombe sur la page 0.
const CoffeesSearchSchema = z.object({
  page: z.coerce.number().int().min(0).catch(0),
})

export const Route = createFileRoute('/$locale/coffees/')({
  validateSearch: (search) => CoffeesSearchSchema.parse(search),
  // Le loader ne dépend que de `page` : il ne re-tourne pas si un autre
  // paramètre de recherche change un jour.
  loaderDeps: ({ search }) => ({ page: search.page }),
  // Réchauffe le cache sans bloquer la navigation : l'URL change tout de
  // suite, keepPreviousData affiche l'ancienne page pendant le chargement.
  // L'erreur éventuelle est déjà portée par la query (le composant la relance
  // vers l'errorComponent) — le catch évite juste une rejection non gérée.
  loader: ({ context: { queryClient }, deps: { page } }) => {
    void queryClient.ensureQueryData(coffeesPageOptions(page)).catch(() => {})
  },
  errorComponent: CoffeesError,
  component: CoffeesPage,
})

function CoffeesPage() {
  const { locale } = Route.useParams()
  const { page } = Route.useSearch()
  const query = useQuery(coffeesPageOptions(page))

  if (query.isError) {
    throw query.error
  }
  if (query.isPending) {
    return <CoffeeListSkeleton />
  }

  const { content, number, totalPages } = query.data
  const isFirst = number <= 0
  const isLast = number + 1 >= totalPages

  return (
    <section className={`flex flex-col gap-4 ${query.isPlaceholderData ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Nos cafés</h2>
        <Link
          to="/$locale/coffees/new"
          params={{ locale }}
          className="text-sm underline underline-offset-4"
        >
          + Ajouter un café
        </Link>
      </div>
      <CoffeeList coffees={content} locale={locale} />
      <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
        <Link
          from={Route.fullPath}
          search={(prev) => ({ ...prev, page: number - 1 })}
          disabled={isFirst}
          aria-disabled={isFirst}
          className={isFirst ? 'text-muted-foreground/50' : 'text-foreground'}
        >
          ← Précédent
        </Link>
        <span className="text-muted-foreground">
          Page {number + 1} / {Math.max(totalPages, 1)}
        </span>
        <Link
          from={Route.fullPath}
          search={(prev) => ({ ...prev, page: number + 1 })}
          disabled={isLast}
          aria-disabled={isLast}
          className={isLast ? 'text-muted-foreground/50' : 'text-foreground'}
        >
          Suivant →
        </Link>
      </nav>
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
