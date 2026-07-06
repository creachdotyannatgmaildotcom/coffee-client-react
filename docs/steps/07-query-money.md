# Étape 07 — Données : TanStack Query + adapter Zod + Money + liste

**Objectif** : brancher l'application sur l'API CoffeeMachine3 — un wrapper HTTP unique qui **parse toute réponse avec Zod**, un type `Money` qui isole la dette backend sur le prix, TanStack Query pour l'état serveur, et la première page de données : la liste des cafés.

**Pourquoi (best practice 2026)** :
- **L'état serveur n'est pas de l'état client** : une liste de cafés appartient au serveur ; le front n'en détient qu'un *cache*. TanStack Query gère ce cache (fraîcheur, dédoublonnage, re-fetch, erreurs) — un store global (Redux, Zustand) pour ces données reviendrait à réécrire Query à la main, en moins bien. Aucun store global dans ce projet.
- **Parse aux frontières** : `http()` exige un schéma Zod et refuse toute réponse qui ne s'y conforme pas. Une API qui change de forme (le champ `price` devient une string…) produit une **erreur franche à la frontière**, pas un `NaN` affiché trois composants plus loin. C'est testé : c'est l'un des deux tests signature de l'étape.
- **`Money`, pas un `number` nu** : le backend envoie le prix en **centimes entiers** (dette connue : il passera un jour à BigDecimal-string). Le domaine manipule `Money { amount, currency }` ; la traduction wire ↔ domaine tient sur **une ligne** (`WirePrice = z.number().int().transform(eur)`). Le jour où le wire change, on modifie cette ligne et rien d'autre. `formatPrice()` centralise l'affichage via `Intl.NumberFormat` (avec cache : un formateur par locale+devise, pas un par rendu).
- **Retry sélectif** : réessayer un 500 ou une coupure réseau peut réussir ; réessayer un 404 ou une réponse malformée redonnera la même erreur. La politique de retry encode cette réalité (`5xx/réseau : 3 essais ; tout le reste : zéro`).
- **`useSuspenseQuery`** : le composant liste déclare "je ne rends qu'avec des données" ; le chargement (Suspense → skeleton) et la panne (errorComponent de la route) sont gérés par les *boundaries* au-dessus — le composant reste un rendu pur, sans `if (isLoading)`.
- **MSW au niveau réseau** : les tests interceptent les requêtes HTTP elles-mêmes ; `fetch`, `http()`, Zod, Query — tout le code de production s'exécute réellement. Jamais de `vi.mock` d'un module interne : on testerait alors un assemblage qui n'existe pas en prod.

**Ce qui a été ajouté** :
- `@tanstack/react-query` (+ devtools en dev), `msw` (dev).
- `src/shared/money/money.ts` : `Money`, `eur()` (refuse les montants non entiers), `formatPrice()` (Intl + cache) — et son test unitaire.
- `src/shared/api/http.ts` : wrapper `http(path, schema, init?)` — préfixe `/api` (le proxy de l'étape 06 fait le reste), en-têtes JSON, `ApiError(status)` pour tout non-2xx, `ValidationError.fieldErrors` qui parse le body 400 `{ champ: message }` du backend, `registerTokenProvider()` (no-op : l'auth arrivera plus tard sans changer les appelants).
- `src/features/coffees/schemas/coffee.ts` : `WirePrice` (la ligne qui porte la dette), `toWirePrice` (écriture symétrique), `CoffeeSchema`, `pageOf()` générique pour la Page Spring, `CoffeePageSchema`.
- `src/features/coffees/api/coffees.ts` : `listCoffeesPaged(page, size)`, `getCoffee(id)` — chaque appel passe son schéma à `http()`.
- `src/features/coffees/queries/coffees.ts` : factory `coffeeKeys` hiérarchique (`all` → `lists()` → `list(page,size)` ; `details()` → `detail(id)`) et `queryOptions` co-localisées (`coffeesPageOptions`, `coffeeDetailOptions`).
- `src/features/coffees/components/coffee-list.tsx` : la liste (`useSuspenseQuery`), prix via `formatPrice`.
- `src/features/coffees/index.ts` : le barrel expose `CoffeeList`, les query options et les types — l'intérieur de la feature (relative imports uniquement) reste privé.
- `src/routes/$locale/coffees/index.tsx` : la page — `<Suspense fallback={skeleton}>` + `errorComponent` de route (rôle `alert`, bouton Réessayer qui `reset()` la boundary Query puis `router.invalidate()`).
- `src/app/query-client.ts` : `createAppQueryClient()` — `staleTime: 30_000`, retry sélectif.
- `src/app/router.ts` + `src/routes/__root.tsx` : le `queryClient` entre dans le **contexte du routeur** (`createRootRouteWithContext`) — les loaders l'utiliseront dès l'étape 08.
- `src/test/server.ts` + `src/test/setup.ts` : serveur MSW partagé, `onUnhandledRequest: 'error'` (une requête non déclarée fait échouer le test), reset entre chaque test.
- `src/test/render.tsx` : `makeTestQueryClient()` (`retry: false`) et `renderAt(url)` — monte l'app complète à une URL donnée (memory history + injection du query client). `router.test.tsx` migré dessus.
- `src/features/coffees/components/coffee-list.test.tsx` : les deux **tests signature** — la liste s'affiche (250 centimes wire → « 2,50 € ») ; un `price` string déclenche l'écran d'erreur sans afficher de données.

**Décisions** :
- **`stores/` → `queries/`** : l'état serveur vit dans le cache Query, pas dans des stores. Le dossier, la règle `noRestrictedImports` et le barrel ont été renommés ; note ajoutée à la fiche 02.
- **Le `queryClient` passe par le contexte du routeur dès maintenant** (et non à l'étape 08 qui en a besoin pour `ensureQueryData`) : cela évite de changer la signature de `createAppRouter` deux fois, et les tests injectent déjà le bon client.
- **Handlers MSW déclarés par test** (`server.use(...)`) plutôt qu'un fichier de handlers global : chaque test affiche son "contrat serveur" à côté de ses assertions — plus lisible pour apprendre. Un socle partagé pourra émerger quand la duplication le justifiera.

**Concepts à retenir** :
1. **Query key = identité du cache** : la factory hiérarchique permet d'invalider à la bonne granularité — `lists()` rafraîchit toutes les pages sans toucher aux détails.
2. **`queryOptions` co-localisées** : la clé et le fetch sont définis ensemble, une seule fois — impossible de désynchroniser une clé et sa fonction.
3. **Un adapter, une dette** : quand un contrat externe est mauvais (prix int en centimes), on le confine dans la couche de traduction au lieu de le laisser fuir dans tout le code.
4. **Suspense inverse la charge** : le composant ne gère plus ses états de chargement/erreur ; les boundaries au-dessus le font. Le composant devient une fonction pure des données.
5. **Tester au niveau réseau** : MSW simule le *serveur*, pas nos modules. Le test de dérive de contrat (price string → alerte) prouve que la frontière Zod protège réellement l'application.

**Vérifier** :
```bash
pnpm run verify   # typecheck ✓ · biome ci ✓ · eslint ✓ · 9 tests ✓ · build ✓
# Avec le backend lancé (profil dev) :
pnpm dev          # http://localhost:5173/fr/coffees affiche la liste réelle via le proxy
# Sans backend : la page affiche l'écran d'erreur avec bouton Réessayer.
```

**Tag git** : step-07-query-money
