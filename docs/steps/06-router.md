# Étape 06 — Routage : TanStack Router + proxy API

**Objectif** : donner des URL à l'application — un routeur **typé** basé sur des fichiers, un segment de langue `/$locale` posé dès maintenant, et un proxy Vite `/api` → backend qui neutralise la contrainte CORS sans toucher au serveur.

**Pourquoi (best practice 2026)** :
- **TanStack Router** est le routeur React de référence pour les SPA : chaque route est un fichier, l'arbre est généré automatiquement, et surtout **tout est typé** — un `<Link to="/$locale">` sans le paramètre `locale` est une erreur de compilation, pas un bug en prod. Les liens morts deviennent impossibles.
- **`/$locale` dès maintenant** : l'i18n en retrofit est l'un des chantiers les plus coûteux d'un front (toutes les URL changent, tous les liens cassent). On paie le segment de langue un jalon à l'avance : aujourd'hui il ne "sert à rien", demain la traduction s'y branche sans rien casser.
- **Parse aux frontières** : l'URL est une entrée utilisateur comme une autre. Le paramètre `locale` passe par Zod (`z.enum(['fr','en']).catch('fr')`) — une locale inconnue (`/de/...`) retombe sur `fr` au lieu de faire planter le rendu.
- **Proxy plutôt que CORS** : le navigateur interdit à `localhost:5173` d'appeler `localhost:8080` (origines différentes) sauf si le serveur l'autorise explicitement — c'est le CORS : *le navigateur bloque, le serveur déclare*. Notre backend n'autorise que `localhost:4200` et on ne le modifie pas. Solution : le front appelle `/api/*` sur **sa propre origine** (pas de CORS du tout), et le serveur de dev Vite relaie vers le 8080 en coulisse. C'est aussi la topologie de prod (un reverse-proxy devant le front et l'API) — le dev reproduit la prod au lieu de s'en éloigner.

**Ce qui a été ajouté** :
- `@tanstack/react-router` + `zod` (dépendances), `@tanstack/router-plugin` + `@tanstack/react-router-devtools` (dev).
- `vite.config.ts` : plugin `tanstackRouter({ target: 'react', autoCodeSplitting: true })` **avant** le plugin React (il doit voir les fichiers de route en premier) ; bloc `server.proxy` qui relaie `/api/*` vers `http://localhost:8080` en réécrivant le chemin (`/api/coffees` → `/coffees`).
- `src/shared/config/i18n.ts` : liste des locales, `defaultLocale`, `LocaleSchema` (Zod + `.catch`).
- `src/routes/__root.tsx` : route racine — layout minimal (`<Outlet />` = emplacement où la route enfant se rend) + devtools du routeur chargées uniquement en dev (ni prod, ni tests).
- `src/routes/index.tsx` : la route `/` redirige vers `/fr` (`throw redirect(...)` dans `beforeLoad`).
- `src/routes/$locale/route.tsx` : layout du segment de langue — validation Zod du paramètre (`params.parse`), en-tête avec titre cliquable et sélecteur FR/EN en liens typés.
- `src/routes/$locale/index.tsx` : la page d'accueil (la démo Card/Skeleton/Button de l'étape 03, déplacée ici).
- `src/app/router.ts` : fabrique `createAppRouter(history?)` — l'app l'appelle sans argument, les tests injectent une *memory history* ; déclaration `Register` qui donne au typage la connaissance de toutes les routes.
- `src/main.tsx` : `<RouterProvider router={...} />` remplace `<App />` ; `src/App.tsx` et son test sont supprimés.
- `src/app/router.test.tsx` : 4 tests — redirection `/` → `/fr`, rendu sous `/en`, locale inconnue qui retombe sur `fr`, navigation par lien typé (clic sur "en" → URL `/en`).
- `src/routeTree.gen.ts` : arbre de routes **généré** par le plugin (voir Décisions) ; ignoré par Biome et ESLint (`files.includes` / `ignores`) — on ne lint pas du code généré.

**Décisions** :
- **`routeTree.gen.ts` est commité** (et non gitignoré). Raison : `pnpm typecheck` tourne **avant** `vite build` dans `verify` et en CI — si le fichier n'existait que via la génération du build, un clone frais échouerait au typecheck. Le committer rend chaque commande du pipeline autonome. Contrepartie : le fichier apparaît dans les diffs quand les routes changent — c'est voulu, on *voit* l'arbre évoluer.
- **Locale inconnue = fallback, pas 404** (`.catch('fr')` conformément au brief) : `/de` rend le contenu en locale par défaut. L'URL n'est pas réécrite — une redirection canonique pourra s'ajouter plus tard sans casser ce comportement.
- **Devtools gardées derrière `import.meta.env.PROD || import.meta.env.TEST`** : en prod le code est éliminé du bundle (branche morte), et les tests Vitest (où `DEV` est aussi vrai) ne montent pas les devtools.

**Concepts à retenir** :
1. **Routage par fichiers** : l'arborescence de `src/routes/` *est* la carte des URL — `__root.tsx` (racine), `index.tsx` (`/`), `$locale/route.tsx` (layout de `/:locale`), `$locale/index.tsx` (page de `/:locale`). Le `$` marque un paramètre dynamique.
2. **Liens typés** : `<Link to="/$locale" params={{ locale }}>` est vérifié à la compilation contre l'arbre généré. Renommer une route casse le build, pas la prod.
3. **CORS en une phrase** : le navigateur bloque les appels vers une autre origine, sauf si le serveur les autorise via des en-têtes. Un proxy de dev élimine le problème en gardant une seule origine — et reproduit la topologie de prod.
4. **`throw redirect(...)`** : dans TanStack Router, une redirection est une exception lancée pendant `beforeLoad`/`loader` — le routeur l'attrape et navigue. Idem pour `notFound()` (étape 09).
5. **Une URL est une entrée non fiable** : paramètres et query strings passent par Zod comme n'importe quelle donnée externe — c'est la doctrine "parse aux frontières" appliquée au routeur.

**Vérifier** :
```bash
pnpm run verify   # typecheck ✓ · biome ci ✓ · eslint ✓ · 4 tests routeur ✓ · build ✓
pnpm dev          # http://localhost:5173/ redirige vers /fr ;
                  # l'en-tête affiche FR/EN, cliquer EN navigue vers /en sans rechargement
```

**Tag git** : step-06-router
