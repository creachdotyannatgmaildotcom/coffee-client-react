import { keepPreviousData, type QueryClient, queryOptions } from '@tanstack/react-query'
import { getCoffee, listCoffeesPaged } from '../api/coffees'
import type { Coffee, CoffeePage } from '../schemas/coffee'

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
    // Pendant le chargement de la page N+1, on continue d'afficher la page N
    // au lieu d'un flash de skeleton — la navigation paraît instantanée.
    placeholderData: keepPreviousData,
  })
}

// Seed-from-list : si le café est déjà passé dans une page de liste en cache
// (ou dans le cache détail), on peut l'afficher immédiatement pendant que la
// version fraîche arrive en arrière-plan.
export function coffeeFromCache(queryClient: QueryClient, id: number): Coffee | undefined {
  const detail = queryClient.getQueryData<Coffee>(coffeeKeys.detail(id))
  if (detail) return detail
  for (const [, page] of queryClient.getQueriesData<CoffeePage>({ queryKey: coffeeKeys.lists() })) {
    const hit = page?.content.find((coffee) => coffee.id === id)
    if (hit) return hit
  }
  return undefined
}

export function coffeeDetailOptions(queryClient: QueryClient, id: number) {
  return queryOptions({
    queryKey: coffeeKeys.detail(id),
    queryFn: () => getCoffee(id),
    placeholderData: () => coffeeFromCache(queryClient, id),
  })
}
