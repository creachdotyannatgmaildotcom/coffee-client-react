import { http } from '@/shared/api/http'
import { type CoffeeCreate, CoffeePageSchema, CoffeeSchema, toWirePrice } from '../schemas/coffee'

export function listCoffeesPaged(page: number, size: number) {
  const search = new URLSearchParams({ page: String(page), size: String(size) })
  return http(`/coffees/paged?${search}`, CoffeePageSchema)
}

export function getCoffee(id: number) {
  return http(`/coffees/${id}`, CoffeeSchema)
}

export function createCoffee(input: CoffeeCreate) {
  return http('/coffees', CoffeeSchema, {
    method: 'POST',
    // L'adapter écrit le format wire : Money → centimes entiers.
    body: JSON.stringify({ name: input.name, price: toWirePrice(input.price) }),
  })
}
