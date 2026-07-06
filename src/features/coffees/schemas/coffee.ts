import { z } from 'zod'
import { eur, type Money } from '@/shared/money/money'

// Toute la dette backend « price est un int en centimes » tient sur cette
// ligne : le jour où le serveur passe à BigDecimal sérialisé en chaîne, seul
// WirePrice change — le reste de l'application ne voit que des Money.
export const WirePrice = z.number().int().transform(eur)

// Écriture symétrique : Money du domaine → forme wire attendue par le backend.
export function toWirePrice(money: Money): number {
  return money.amount
}

export const CoffeeSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  price: WirePrice,
})

export type Coffee = z.infer<typeof CoffeeSchema>

// Page Spring générique : réutilisable pour n'importe quel contenu paginé.
export function pageOf<T extends z.ZodType>(item: T) {
  return z.object({
    content: z.array(item),
    number: z.number().int(),
    size: z.number().int(),
    totalElements: z.number().int(),
    totalPages: z.number().int(),
  })
}

export const CoffeePageSchema = pageOf(CoffeeSchema)
export type CoffeePage = z.infer<typeof CoffeePageSchema>
