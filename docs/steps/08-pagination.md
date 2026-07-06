# Étape 08 — Pagination pilotée par l'URL

**Objectif** : la page affichée vit dans l'URL (`/fr/coffees?page=2`), pas dans un `useState`. Rechargement, partage de lien, bouton Retour : tout fonctionne, parce que l'URL **est** l'état.

**Pourquoi (best practice 2026)** :
- **L'URL comme source de vérité** : un `useState(page)` meurt au premier F5 et rend la page impartageable. En rangeant la pagination dans la query string, le navigateur devient le store : historique, deep-linking et bouton Retour sont gratuits.
- **`validateSearch` + Zod** : `?page=banane` ou `?page=-3` arriveront un jour (utilisateur, lien cassé, crawler). La query string est parsée comme toute frontière : `z.coerce.number().int().min(0).catch(0)` — tout ce qui n'est pas un entier positif redevient page 0, sans crash ni page blanche. Testé (test signature).
- **`loaderDeps` → `loader` → `ensureQueryData`** : le routeur sait de quelles données une URL a besoin *avant* de rendre le composant. `loaderDeps` déclare que le loader dépend de `page` ; le loader demande à React Query de remplir le cache (`ensureQueryData` : fetch seulement si absent ou périmé — Query dédoublonne).
- **`placeholderData: keepPreviousData`** : pendant le chargement de la page N+1, on continue d'afficher la page N (légèrement estompée) au lieu d'un flash de skeleton. La pagination paraît instantanée même sur réseau lent.
- **`defaultPreload: 'intent'`** : survoler « Suivant » précharge la route — loader compris, donc données comprises. Au clic, la page est déjà là. `defaultPreloadStaleTime: 0` laisse React Query seul juge de la fraîcheur (le routeur ne fait pas de cache concurrent).

**Ce qui a été ajouté** :
- `src/routes/$locale/coffees/index.tsx` :
  - `validateSearch` : parse Zod de la query string (`page` typée dans toute la route) ;
  - `loaderDeps` + `loader` non bloquant : le cache se remplit pendant que la navigation s'affiche ;
  - la page possède désormais la query (`useQuery`) : elle lit `number`/`totalPages` pour la barre de pagination, relance l'erreur vers l'`errorComponent`, affiche le skeleton au premier chargement et estompe le contenu quand `isPlaceholderData` ;
  - liens **Précédent / Suivant** typés avec **updater fonctionnel** (`search={(prev) => ({ ...prev, page: prev.page + 1 })}`) : on décrit la *transformation* de l'état d'URL, on n'écrase pas les autres paramètres ; `disabled` aux bornes.
- `src/features/coffees/components/coffee-list.tsx` : devient **présentationnel** (`coffees` en prop) — voir Décisions.
- `src/features/coffees/queries/coffees.ts` : `placeholderData: keepPreviousData` co-localisé dans `coffeesPageOptions`.
- `src/app/router.ts` : `defaultPreload: 'intent'`, `defaultPreloadStaleTime: 0`.
- `src/routes/$locale/route.tsx` : le lien « Cafés » fournit `search={{ page: 0 }}` (le typage l'exige : la route a désormais une search string obligatoire).
- `src/app/coffees-pagination.test.tsx` : 3 tests — `?page=banane` → page 0 sans crash (l'URL normalisée le prouve), clic « Suivant » → l'URL passe à `page=1` **et** les données changent, `?page=-3` → page 0.

**Décisions** :
- **`useSuspenseQuery` → `useQuery` sur cette page** : `keepPreviousData` est incompatible avec Suspense (une query suspendue ne peut pas « montrer l'ancienne donnée » — elle suspend). Comme la doctrine impose `placeholderData: keepPreviousData`, la page passe à `useQuery` : le loader garantit le remplissage du cache, `isPending` couvre le premier chargement, `throw query.error` renvoie les pannes vers l'`errorComponent` de la route (le comportement observable de l'étape 07 — skeleton, liste, écran d'erreur — est inchangé, ses tests passent sans modification).
- **La query remonte dans la route, `CoffeeList` devient présentationnel** : l'état « quelle page ? » appartient à l'URL, donc à la route. Le composant de feature redevient une fonction pure de ses props — plus simple à tester et réutilisable (la page de détail ou une recherche pourront l'alimenter autrement).
- **Loader non bloquant** (`void ensureQueryData(...)`) : bloquer la navigation jusqu'à l'arrivée des données rendrait `keepPreviousData` invisible (l'URL ne changerait qu'une fois les données prêtes). Le `catch(() => {})` évite une *unhandled rejection* — l'erreur reste portée par la query elle-même.

**Concepts à retenir** :
1. **Tout état qui doit survivre à un rechargement va dans l'URL** ; `useState` est réservé à l'éphémère (un menu ouvert, un brouillon de champ).
2. **Updater fonctionnel sur la search string** : `search={(prev) => ({ ...prev, page: … })}` compose avec les futurs paramètres (tri, filtre…) au lieu de les écraser — même principe que `setState(fn)`.
3. **Le routeur orchestre, Query possède le cache** : le loader ne stocke rien, il *demande* à Query de garantir la donnée. Chacun son rôle, pas de double cache.
4. **`keepPreviousData` = UX de continuité** : montrer une donnée légèrement périmée pendant 200 ms vaut mieux qu'un flash blanc. L'estompage (`isPlaceholderData`) signale honnêtement l'instant de transition.
5. **Préchargement à l'intention** : le hover est un signal d'intention gratuit — l'exploiter rend l'app « instantanée » sans aucun code dans les composants.

**Vérifier** :
```bash
pnpm run verify   # typecheck ✓ · biome ci ✓ · eslint ✓ · 12 tests ✓ · build ✓
# Avec le backend (profil dev) :
pnpm dev          # /fr/coffees : Suivant/Précédent changent ?page=… et la liste ;
                  # F5 sur ?page=2 ré-affiche la page 2 ; ?page=banane affiche la page 0
```

**Tag git** : step-08-pagination
