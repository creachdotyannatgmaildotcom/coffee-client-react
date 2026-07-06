import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createCoffee } from '../api/coffees'
import { coffeeKeys } from '../queries/coffees'

export function useCreateCoffee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createCoffee,
    onSuccess: (coffee) => {
      // Les pages de liste sont périmées (un élément de plus quelque part) :
      // on invalide. Le détail, lui, est déjà connu : la réponse du POST fait
      // foi, on l'écrit directement dans le cache — la navigation vers la
      // page du nouveau café sera instantanée, sans GET supplémentaire.
      queryClient.invalidateQueries({ queryKey: coffeeKeys.lists() })
      queryClient.setQueryData(coffeeKeys.detail(coffee.id), coffee)
    },
  })
}
