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

// Saisie du formulaire de création : l'utilisateur tape un prix en EUROS
// ("4.20"), le schéma le transforme en Money (centimes). Aucun message
// personnalisé ici : les defaults Zod (locale fr) s'appliquent.
export const CoffeeCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  price: z
    .string()
    .transform((raw) => Number(raw.replace(',', '.')))
    .pipe(z.number().positive())
    .transform((euros) => eur(Math.round(euros * 100))),
})

export type CoffeeCreateInput = z.input<typeof CoffeeCreateSchema>
export type CoffeeCreate = z.output<typeof CoffeeCreateSchema>

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
