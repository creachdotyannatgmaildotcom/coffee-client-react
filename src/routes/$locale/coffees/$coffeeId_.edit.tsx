import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { CoffeeEditForm, coffeeDetailOptions } from '@/features/coffees'
import { ApiError } from '@/shared/api/http'
import { formatPrice } from '@/shared/money/money'
import { Skeleton } from '@/shared/ui/skeleton'

// Mêmes règles que la route détail : un id illisible est une URL inexistante.
const CoffeeIdSchema = z.coerce.number().int().positive()

export const Route = createFileRoute('/$locale/coffees/$coffeeId_/edit')({
  params: {
    parse: (raw) => {
      const parsed = CoffeeIdSchema.safeParse(raw.coffeeId)
      if (!parsed.success) throw notFound()
      return { coffeeId: parsed.data }
    },
    stringify: ({ coffeeId }) => ({ coffeeId: String(coffeeId) }),
  },
  loader: async ({ context: { queryClient }, params: { coffeeId } }) => {
    try {
      await queryClient.ensureQueryData(coffeeDetailOptions(queryClient, coffeeId))
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) throw notFound()
      throw error
    }
  },
  component: EditCoffeePage,
})

function EditCoffeePage() {
  const { locale, coffeeId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const query = useQuery(coffeeDetailOptions(queryClient, coffeeId))

  if (query.isError) {
    throw query.error
  }
  if (query.isPending) {
    return (
      <div role="status" aria-label="Chargement du café">
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  const coffee = query.data

  return (
    <section className="flex flex-col gap-4">
      {/* Le prix affiché vient du CACHE : l'écriture optimiste le fait
          changer avant même la réponse du serveur. */}
      <h2 className="text-xl font-semibold">
        {coffee.name} — {formatPrice(coffee.price, locale)}
      </h2>
      <CoffeeEditForm
        coffee={coffee}
        onSaved={() =>
          navigate({
            to: '/$locale/coffees/$coffeeId',
            params: { locale, coffeeId },
          })
        }
      />
    </section>
  )
}
