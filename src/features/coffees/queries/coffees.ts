import { queryOptions } from '@tanstack/react-query'
import { getCoffee, listCoffeesPaged } from '../api/coffees'

export const PAGE_SIZE = 10

// Factory hiérarchique : invalider coffeeKeys.lists() touche toutes les pages
// sans toucher les détails ; coffeeKeys.all rase tout le domaine coffees.
export const coffeeKeys = {
  all: ['coffees'] as const,
  lists: () => [...coffeeKeys.all, 'list'] as const,
  list: (page: number, size: number) => [...coffeeKeys.lists(), { page, size }] as const,
  details: () => [...coffeeKeys.all, 'detail'] as const,
  detail: (id: number) => [...coffeeKeys.details(), id] as const,
}

export function coffeesPageOptions(page: number, size: number = PAGE_SIZE) {
  return queryOptions({
    queryKey: coffeeKeys.list(page, size),
    queryFn: () => listCoffeesPaged(page, size),
  })
}

export function coffeeDetailOptions(id: number) {
  return queryOptions({
    queryKey: coffeeKeys.detail(id),
    queryFn: () => getCoffee(id),
  })
}
