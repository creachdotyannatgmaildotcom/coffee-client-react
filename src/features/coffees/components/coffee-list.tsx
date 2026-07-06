import { useSuspenseQuery } from '@tanstack/react-query'
import type { Locale } from '@/shared/config/i18n'
import { formatPrice } from '@/shared/money/money'
import { coffeesPageOptions } from '../queries/coffees'

export function CoffeeList({ page = 0, locale }: { page?: number; locale: Locale }) {
  const { data } = useSuspenseQuery(coffeesPageOptions(page))

  if (data.content.length === 0) {
    return <p className="text-muted-foreground">Aucun café pour l'instant.</p>
  }

  return (
    <ul className="flex flex-col gap-2">
      {data.content.map((coffee) => (
        <li
          key={coffee.id}
          className="flex items-center justify-between rounded-lg border border-border p-3"
        >
          <span>{coffee.name}</span>
          <span className="text-muted-foreground">{formatPrice(coffee.price, locale)}</span>
        </li>
      ))}
    </ul>
  )
}
