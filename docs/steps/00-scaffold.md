## Étape 00 — Scaffold

**Objectif** : disposer d'une application React 19 + TypeScript démarrable, gérée avec pnpm et bundlée par Vite — la fondation de tous les jalons suivants.

**Pourquoi (best practice 2026)** :
- **Vite** reste la référence pour les SPA React : démarrage quasi instantané, HMR rapide, build de production optimisé (Rollup/Rolldown).
- **pnpm** installe les dépendances par liens durs : plus rapide, moins d'espace disque, et un `node_modules` strict qui empêche d'importer des "phantom dependencies" non déclarées.
- **React 19.2 + React Compiler** : le compilateur mémoïse automatiquement les composants et hooks au moment du build. On l'active dès le scaffold pour ne jamais avoir à écrire `useMemo`/`useCallback` défensifs — la règle du brief ("laisse le compilateur gérer la mémoïsation") n'est tenable que si l'outil est branché dès le départ.

**Ce qui a été ajouté** :
- `package.json` : projet renommé `coffee-client`, scripts `dev`, `build`, `typecheck`, `lint`, `preview`.
- `vite.config.ts` : plugin `@vitejs/plugin-react` + `@rolldown/plugin-babel` configuré avec `reactCompilerPreset()` pour activer le React Compiler (l'API a changé en plugin-react v6 / Vite 8 : le compilateur passe désormais par un plugin Babel séparé plutôt que par une option `babel` du plugin React).
- `src/App.tsx`, `src/index.css`, `index.html` : nettoyés du contenu de démonstration du template Vite (logos, sections marketing) pour repartir d'une page minimale "Coffee Client".
- Suppression des assets inutiles (`react.svg`, `vite.svg`, `hero.png`, `icons.svg`).

**Concepts à retenir** :
1. Un scaffold Vite "react-ts" fournit déjà TypeScript, ESLint et un `tsconfig` strict de base — on l'ajuste plutôt que de repartir de zéro.
2. Le React Compiler se configure désormais via un plugin Babel dédié (`reactCompilerPreset`) combiné à `@rolldown/plugin-babel`, et non plus via une option du plugin React — toujours vérifier la doc de la version installée, les API évoluent vite.
3. pnpm + corepack est la combinaison recommandée pour épingler la version du gestionnaire de paquets sans dépendre d'une install globale.
4. Garder le scaffold minimal dès le départ (pas de CSS ni d'assets de démo) évite d'accumuler de la dette dès le jalon 0.

**Vérifier** :
```bash
pnpm typecheck   # tsc -b --noEmit : aucune erreur de typage
pnpm lint        # eslint . : aucun avertissement
pnpm build       # tsc -b && vite build : build de prod généré dans dist/
pnpm dev         # démarre le serveur de dev sur http://localhost:5173 et affiche "Coffee Client"
```

**Tag git** : step-00-scaffold
