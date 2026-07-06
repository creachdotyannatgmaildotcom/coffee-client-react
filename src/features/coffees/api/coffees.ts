import { http } from '@/shared/api/http'
import { CoffeePageSchema, CoffeeSchema } from '../schemas/coffee'

export function listCoffeesPaged(page: number, size: number) {
  const search = new URLSearchParams({ page: String(page), size: String(size) })
  return http(`/coffees/paged?${search}`, CoffeePageSchema)
}

export function getCoffee(id: number) {
  return http(`/coffees/${id}`, CoffeeSchema)
}
