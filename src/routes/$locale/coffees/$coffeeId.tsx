import { useQuery, useQueryClient, useQueryErrorResetBoundary } from '@tanstack/react-query'
import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { z } from 'zod'
import { CoffeeDetail, coffeeDetailOptions, coffeeFromCache } from '@/features/coffees'
import { ApiError } from '@/shared/api/http'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'

// `.parse`, pas `.catch` : contrairement à la locale ou à la pagination, il
// n'existe aucun id "par défaut" raisonnable. /coffees/banane ne veut rien
// dire — c'est une URL qui n'existe pas (404), pas une valeur à corriger.
const CoffeeIdSchema = z.coerce.number().int().positive()

export const Route = createFileRoute('/$locale/coffees/$coffeeId')({
  params: {
    parse: (raw) => {
      const parsed = CoffeeIdSchema.safeParse(raw.coffeeId)
      // Pas de valeur de repli : un id illisible est une URL qui n'existe
      // pas. On lève notFound() avant même qu'un fetch soit envisagé.
      if (!parsed.success) throw notFound()
      return { coffeeId: parsed.data }
    },
    stringify: ({ coffeeId }) => ({ coffeeId: String(coffeeId) }),
  },
  loader: async ({ context: { queryClient }, params: { coffeeId } }) => {
    const ensure = queryClient.ensureQueryData(coffeeDetailOptions(queryClient, coffeeId))
    if (coffeeFromCache(queryClient, coffeeId)) {
      // Déjà de quoi afficher (seed-from-list) : navigation instantanée, la
      // version fraîche arrive en arrière-plan ; une éventuelle erreur sera
      // portée par la query et traitée au rendu.
      ensure.catch(() => {})
      return
    }
    try {
      await ensure
    } catch (error) {
      // 404 = fait métier ("ce café n'existe pas"), pas une panne : on le
      // convertit en notFound() pour rendre la page 404 métier.
      if (error instanceof ApiError && error.status === 404) throw notFound()
      throw error
    }
  },
  notFoundComponent: CoffeeNotFound,
  errorComponent: CoffeeDetailError,
  component: CoffeeDetailPage,
})

function CoffeeDetailPage() {
  const { locale, coffeeId } = Route.useParams()
  const queryClient = useQueryClient()
  const query = useQuery(coffeeDetailOptions(queryClient, coffeeId))

  if (query.isError) {
    // Cas seed-from-list : le fetch en arrière-plan peut découvrir que le
    // café a été supprimé entre-temps — même sémantique que dans le loader.
    if (query.error instanceof ApiError && query.error.status === 404) throw notFound()
    throw query.error
  }
  if (query.isPending) {
    return (
      <div role="status" aria-label="Chargement du café">
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <CoffeeDetail coffee={query.data} locale={locale} />
      <Link
        to="/$locale/coffees"
        params={{ locale }}
        search={{ page: 0 }}
        className="text-muted-foreground text-sm"
      >
        ← Tous les cafés
      </Link>
    </section>
  )
}

// 404 métier : l'application fonctionne parfaitement, c'est la ressource qui
// n'existe pas. Ton calme, pas de rouge, une porte de sortie.
function CoffeeNotFound() {
  const { locale } = Route.useParams()
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h2 className="text-xl font-semibold">Café introuvable</h2>
      <p className="text-muted-foreground">
        Ce café n'existe pas ou n'existe plus. Il a peut-être été retiré de la carte.
      </p>
      <Link
        to="/$locale/coffees"
        params={{ locale }}
        search={{ page: 0 }}
        className="text-sm underline"
      >
        ← Retour à la liste des cafés
      </Link>
    </section>
  )
}

// Panne technique (5xx, réseau, dérive de contrat) : rouge, et un retry.
function CoffeeDetailError() {
  const router = useRouter()
  const { reset } = useQueryErrorResetBoundary()

  useEffect(() => {
    reset()
  }, [reset])

  return (
    <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive p-4">
      <p className="font-medium text-destructive">Impossible de charger ce café.</p>
      <p className="text-muted-foreground text-sm">
        Le serveur est peut-être indisponible. Ce n'est pas un problème avec ce café en particulier.
      </p>
      <Button variant="outline" onClick={() => router.invalidate()}>
        Réessayer
      </Button>
    </div>
  )
}
