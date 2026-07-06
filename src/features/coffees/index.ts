// Point d'entrée public de la feature "coffees" — seul chemin d'import autorisé
// depuis l'extérieur (app/, routes/, autres features). Les sous-dossiers
// (api, components, hooks, queries, schemas) ne s'importent jamais directement.
export { CoffeeDetail } from './components/coffee-detail'
export { CoffeeList } from './components/coffee-list'
export {
  coffeeDetailOptions,
  coffeeFromCache,
  coffeeKeys,
  coffeesPageOptions,
  PAGE_SIZE,
} from './queries/coffees'
export type { Coffee, CoffeePage } from './schemas/coffee'
