import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CoffeeCreateForm } from '@/features/coffees'

export const Route = createFileRoute('/$locale/coffees/new')({
  component: NewCoffeePage,
})

function NewCoffeePage() {
  const { locale } = Route.useParams()
  const navigate = useNavigate()

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Nouveau café</h2>
      <CoffeeCreateForm
        onCreated={(coffee) =>
          navigate({
            to: '/$locale/coffees/$coffeeId',
            params: { locale, coffeeId: coffee.id },
          })
        }
      />
    </section>
  )
}
