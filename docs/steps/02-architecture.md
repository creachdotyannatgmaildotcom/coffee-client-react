## Étape 02 — Architecture

**Objectif** : poser le squelette de dossiers feature-based imposé, l'alias d'import `@/`, la convention de barrel (point d'entrée public par feature) et une règle de lint qui empêche de la contourner.

**Pourquoi (best practice 2026)** :
- **Architecture feature-based** : regrouper par capacité métier (`features/coffees/`) plutôt que par type technique (`components/`, `hooks/`…) limite le couplage et rend le code navigable à mesure que l'appli grossit — on supprime une feature en supprimant un dossier.
- **Barrel `index.ts`** : chaque feature expose une API publique unique. Le reste de l'appli ne connaît jamais l'organisation interne d'une feature (où est l'appel API, quel hook l'utilise…) — ça la rend libre de se réorganiser sans casser ses consommateurs.
- **Alias `@/`** : des imports absolus (`@/features/coffees`) plutôt que relatifs (`../../../features/coffees`) survivent aux déplacements de fichiers et restent lisibles à n'importe quelle profondeur.
- **Règle de lint sur les frontières** : une convention non vérifiée par l'outillage finit toujours par être violée sous pression de deadline. `noRestrictedImports` (Biome) avec des patterns glob sur `@/features/*/api/*` etc. transforme la convention en erreur de build — testée et validée empiriquement avant intégration (un import direct dans `coffees/api/` depuis une autre feature est rejeté, un import via le barrel `@/features/coffees` passe).

**Ce qui a été ajouté** :
- Squelette de dossiers : `src/app/`, `src/features/coffees/{api,components,hooks,schemas,stores}/`, `src/shared/{ui,lib,hooks,config}/`, `src/routes/`, `src/types/` (fichiers `.gitkeep` pour les dossiers encore vides — Git ne suit pas les répertoires sans contenu).
- `src/features/coffees/index.ts` : barrel public de la feature, pour l'instant vide (`export {}`), qui sera complété au fil des jalons suivants (schémas, hooks, composants exposés).
- `tsconfig.app.json` : ajout de `"paths": { "@/*": ["./src/*"] }` pour résoudre l'alias côté TypeScript (sans `baseUrl`, déprécié en TS 6 avec `moduleResolution: "bundler"`).
- `vite.config.ts` : ajout de `resolve.alias` (`@` → `./src` via `fileURLToPath`) pour que Vite résolve le même alias à la compilation et au build.
- `biome.json` : règle `linter.rules.style.noRestrictedImports` avec des patterns glob (`@/features/*/api/*`, `.../components/*`, etc.) qui bloquent tout import direct dans les sous-dossiers internes d'une feature, avec un message explicite renvoyant vers le barrel.

**Concepts à retenir** :
1. Les frontières d'architecture qui ne sont pas vérifiées par l'outillage sont des frontières qui finissent par disparaître — encoder la règle dans le linter la rend non-négociable.
2. `baseUrl` est déprécié depuis TypeScript 6 avec la résolution `bundler` : `paths` seul suffit et reste compatible avec la résolution moderne.
3. L'alias doit être déclaré à deux endroits qui ne se synchronisent pas automatiquement : `tsconfig` (pour la vérification de types et l'auto-complétion) et `vite.config.ts` (pour la résolution au build/dev) — toujours les tester ensemble.
4. Toujours valider empiriquement une règle de lint avant de l'adopter : tester un cas qui doit échouer et un cas qui doit passer, plutôt que supposer que la documentation décrit fidèlement le comportement réel.
5. Git ne versionne pas les dossiers vides — `.gitkeep` est la convention pragmatique pour matérialiser un squelette avant que son contenu n'arrive.

**Vérifier** :
```bash
pnpm typecheck   # l'alias @/ résout correctement les imports (testé avec un import temporaire @/App)
pnpm lint        # biome lint . : la règle noRestrictedImports est active et ne casse rien sur le code existant
pnpm build       # build de prod généré, alias résolu par Vite
```

**Tag git** : step-02-architecture
