// Point d'entrée public de la feature "coffees" — seul chemin d'import autorisé
// depuis l'extérieur (app/, routes/, autres features). Les sous-dossiers
// (api, components, hooks, queries, schemas) ne s'importent jamais directement.
export { CoffeeCreateForm } from './components/coffee-create-form'
export { CoffeeDetail } from './components/coffee-detail'
export { CoffeeEditForm } from './components/coffee-edit-form'
export { CoffeeList } from './components/coffee-list'
export { useCreateCoffee } from './hooks/use-create-coffee'
export { useUpdateCoffee } from './hooks/use-update-coffee'
export {
  coffeeDetailOptions,
  coffeeFromCache,
  coffeeKeys,
  coffeesPageOptions,
  PAGE_SIZE,
} from './queries/coffees'
export type { Coffee, CoffeePage } from './schemas/coffee'
