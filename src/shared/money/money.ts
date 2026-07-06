// Le domaine ne manipule jamais un prix `number` nu : un montant est toujours
// un Money — centimes entiers + devise. La forme "wire" (ce que le backend
// envoie) ne sort jamais de l'adapter (schemas de feature).
export type Money = {
  readonly amount: number
  readonly currency: 'EUR'
}

export function eur(amount: number): Money {
  if (!Number.isInteger(amount)) {
    throw new TypeError(`Un montant Money est en centimes entiers, reçu : ${amount}`)
  }
  return { amount, currency: 'EUR' }
}

// Intl.NumberFormat est coûteux à construire : un formateur par couple
// locale+devise, mémorisé pour toute la durée de vie de l'application.
const formatters = new Map<string, Intl.NumberFormat>()

export function formatPrice(money: Money, locale = 'fr'): string {
  const key = `${locale}:${money.currency}`
  let formatter = formatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { style: 'currency', currency: money.currency })
    formatters.set(key, formatter)
  }
  return formatter.format(money.amount / 100)
}
