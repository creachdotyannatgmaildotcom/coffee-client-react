# Étape 09 — Détail et sémantique d'erreur

**Objectif** : la page `/fr/coffees/42` — et surtout la discipline d'erreur qui va avec : distinguer **le fait métier** (« ce café n'existe pas » → page 404 calme) de **la panne technique** (« le serveur ne répond pas » → écran d'erreur avec retry). Confondre les deux, c'est mentir à l'utilisateur.

**Pourquoi (best practice 2026)** :
- **404 ≠ erreur** : un id inconnu n'est pas un dysfonctionnement — l'application marche parfaitement, c'est la ressource qui n'existe pas (supprimée, lien périmé). L'utilisateur doit voir un message métier serein avec une porte de sortie, pas un écran rouge « réessayer » qui réessaierait pour rien. TanStack Router matérialise cette distinction : `notFoundComponent` (fait métier) vs `errorComponent` (panne).
- **`.parse`, pas `.catch`, pour l'id** : la locale (`/de` → `fr`) et la page (`?page=banane` → 0) ont une valeur de repli *raisonnable*. Un id n'en a **aucune** : remplacer `/coffees/banane` par `/coffees/1` afficherait un café au hasard. Un id illisible est une URL qui n'existe pas → `notFound()`, levé avant qu'aucune requête ne parte (pas de `GET /coffees/NaN`).
- **Le loader traduit le protocole en métier** : l'API dit « HTTP 404 », le domaine dit « ce café n'existe pas ». `ApiError(404)` → `throw notFound()` — cette conversion vit dans le loader, à la frontière, pas dans les composants.
- **Seed-from-list** : l'utilisateur vient presque toujours de la liste — le café qu'il veut voir est **déjà dans le cache** (dans une page de liste). On s'en sert : navigation instantanée avec la donnée de la liste en `placeholderData`, pendant que la version fraîche arrive en arrière-plan.

**Ce qui a été ajouté** :
- `src/routes/$locale/coffees/$coffeeId.tsx` :
  - `params.parse` : `z.coerce.number().int().positive().safeParse` — échec → `throw notFound()` (le routeur le gère nativement dans `params.parse`, vérifié dans son code source) ;
  - `loader` à deux branches : si le café est déjà dans le cache (seed), navigation immédiate et fetch en arrière-plan ; sinon on attend le fetch et on convertit `ApiError(404)` → `notFound()` ;
  - `notFoundComponent` (« Café introuvable », lien retour liste) **distinct** de `errorComponent` (« Impossible de charger », bouton Réessayer = reset de la boundary Query + `router.invalidate()`) ;
  - le composant page refait la même conversion 404→notFound pour le cas seed (le fetch en arrière-plan peut découvrir une suppression).
- `src/features/coffees/queries/coffees.ts` : `coffeeFromCache(queryClient, id)` (cherche dans le cache détail puis dans les pages de liste) ; `coffeeDetailOptions(queryClient, id)` avec `placeholderData` semé depuis ce cache.
- `src/features/coffees/components/coffee-detail.tsx` : carte présentationnelle (nom, prix formaté).
- `src/features/coffees/components/coffee-list.tsx` : chaque ligne devient un lien typé vers le détail (le survol précharge grâce à `defaultPreload: 'intent'`).
- `src/app/default-not-found.tsx` + `defaultNotFoundComponent` dans le routeur : 404 générique pour toute URL sans route.
- `src/app/coffee-detail.test.tsx` : les **tests signature** — détail affiché ; id inconnu → page 404 métier (pas d'alerte) ; id non numérique → 404 **sans aucune requête réseau** (MSW en `onUnhandledRequest: 'error'` : le moindre fetch ferait échouer le test) ; un 500 → écran de panne avec retry qui fonctionne (le 2ᵉ appel réussit), et **pas** la page 404.

**Décisions** :
- **`safeParse` + `throw notFound()`** plutôt que `.parse` nu : `.parse` qui lève une ZodError produit une `PathParamError` que le routeur route vers l'`errorComponent` — un écran de panne pour une URL mal formée, sémantiquement faux. Le code source du routeur (`isNotFound(err)` dans `matchRoutesInternal`) prend en charge `notFound()` levé depuis `params.parse` : c'est le canal prévu. L'esprit du brief est respecté : pas de valeur de repli, refus franc.
- **L'id non numérique rend le 404 de la route** (« Café introuvable ») plutôt que le 404 générique : l'utilisateur est dans l'univers « cafés », le message contextualisé avec retour à la liste est plus utile.
- **Loader à deux branches** : toujours attendre le fetch rendrait le seed invisible (le composant ne rend qu'après le loader). Ne jamais attendre empêcherait la conversion 404→notFound avant rendu. La branche est choisie par la présence du seed — les deux propriétés sont conservées.

**Concepts à retenir** :
1. **Trois issues, trois écrans** : donnée → page ; absence métier → `notFoundComponent` ; panne → `errorComponent`. Un utilisateur ne doit jamais voir « réessayer » pour une ressource qui n'existera jamais.
2. **La valeur de repli est un choix métier, pas un réflexe** : `.catch()` quand un défaut a du sens (locale, page), `notFound()` quand il n'en a pas (id).
3. **Le cache est un capital** : la liste a déjà payé le prix du réseau — le détail le réutilise (seed) au lieu de faire attendre l'utilisateur une deuxième fois.
4. **Convertir les erreurs à la frontière** : HTTP (404, 500) est un détail de transport ; le reste de l'app raisonne en termes métier (`notFound`) ou en pannes franches.
5. **Vérifier le framework dans son code source** : le comportement de `params.parse` en cas d'exception n'était pas évident — on a lu `router-core` pour découvrir que `notFound()` y est géré nativement, puis prouvé le comportement par un test.

**Vérifier** :
```bash
pnpm run verify   # typecheck ✓ · biome ci ✓ · eslint ✓ · 16 tests ✓ · build ✓
# Avec le backend (profil dev) :
pnpm dev          # cliquer un café → détail instantané (seed) ;
                  # /fr/coffees/999999 → « Café introuvable » ;
                  # /fr/coffees/banane → 404 sans requête (onglet Réseau vide)
```

**Tag git** : step-09-detail
