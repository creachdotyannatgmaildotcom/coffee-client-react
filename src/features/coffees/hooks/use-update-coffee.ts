import { useMutation, useQueryClient } from '@tanstack/react-query'
import { patchCoffee } from '../api/coffees'
import { coffeeKeys } from '../queries/coffees'
import type { Coffee, CoffeeCreate, CoffeePage } from '../schemas/coffee'

type UpdateCoffeeVariables = { id: number; patch: Partial<CoffeeCreate> }

// Mutation optimiste complète : on écrit la valeur spéculée dans le cache
// AVANT la réponse serveur (l'UI réagit instantanément), on restaure le
// snapshot si le serveur refuse, on écrit la vérité serveur s'il accepte,
// et on invalide dans tous les cas pour resynchroniser.
export function useUpdateCoffee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: UpdateCoffeeVariables) => patchCoffee(id, patch),

    onMutate: async ({ id, patch }) => {
      // 1. Stopper les fetchs en vol : une réponse en retard écraserait
      //    notre écriture spéculative avec une donnée périmée.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: coffeeKeys.detail(id) }),
        queryClient.cancelQueries({ queryKey: coffeeKeys.lists() }),
      ])

      // 2. Snapshot : de quoi tout restaurer en cas d'échec.
      const previousDetail = queryClient.getQueryData<Coffee>(coffeeKeys.detail(id))
      const previousLists = queryClient.getQueriesData<CoffeePage>({
        queryKey: coffeeKeys.lists(),
      })

      // 3. Écriture spéculative : le détail ET toutes les pages de liste en
      //    cache montrent la nouvelle valeur immédiatement (immutabilité :
      //    on reconstruit, on ne modifie jamais en place).
      if (previousDetail) {
        queryClient.setQueryData(coffeeKeys.detail(id), { ...previousDetail, ...patch })
      }
      queryClient.setQueriesData<CoffeePage>({ queryKey: coffeeKeys.lists() }, (page) =>
        page
          ? {
              ...page,
              content: page.content.map((coffee) =>
                coffee.id === id ? { ...coffee, ...patch } : coffee,
              ),
            }
          : page,
      )

      return { previousDetail, previousLists }
    },

    onError: (_error, { id }, context) => {
      // Rollback : le serveur a refusé, le cache retrouve son état d'avant.
      if (!context) return
      if (context.previousDetail) {
        queryClient.setQueryData(coffeeKeys.detail(id), context.previousDetail)
      }
      for (const [queryKey, data] of context.previousLists) {
        queryClient.setQueryData(queryKey, data)
      }
    },

    onSuccess: (coffee) => {
      // La réponse du PATCH fait foi : elle remplace la spéculation.
      queryClient.setQueryData(coffeeKeys.detail(coffee.id), coffee)
    },

    onSettled: (_data, _error, { id }) => {
      // Succès ou échec, on resynchronise avec le serveur.
      queryClient.invalidateQueries({ queryKey: coffeeKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: coffeeKeys.lists() })
    },
  })
}
