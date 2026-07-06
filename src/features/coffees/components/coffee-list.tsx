import type { Locale } from '@/shared/config/i18n'
import { formatPrice } from '@/shared/money/money'
import type { Coffee } from '../schemas/coffee'

// Composant présentationnel : la donnée vient d'en haut (la route possède la
// query, car la page affichée est pilotée par l'URL).
export function CoffeeList({ coffees, locale }: { coffees: Coffee[]; locale: Locale }) {
  if (coffees.length === 0) {
    return <p className="text-muted-foreground">Aucun café pour l'instant.</p>
  }

  return (
    <ul className="flex flex-col gap-2">
      {coffees.map((coffee) => (
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
