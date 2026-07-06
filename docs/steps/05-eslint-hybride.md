# Étape 05 — Lint hybride : ESLint minimal pour le React Compiler

**Objectif** : détecter automatiquement les violations des Règles des Hooks et les endroits où le React Compiler renonce à optimiser — deux familles de diagnostics que Biome ne sait pas produire. On ajoute ESLint, mais **réduit à cette seule responsabilité** : Biome reste le formateur, le trieur d'imports et le linter généraliste.

**Pourquoi (best practice 2026)** :
- **Le React Compiler a besoin de son propre analyseur** : depuis la v6, `eslint-plugin-react-hooks` embarque les diagnostics du compilateur lui-même (pureté du rendu, immutabilité, `setState` dans le rendu ou dans un effet, mémoïsation manuelle à préserver…). Quand le compilateur ne peut pas optimiser un composant, c'est cette règle qui explique *où* et *pourquoi*. Ces analyses reposent sur l'infrastructure interne du compilateur — Biome ne peut ni les implémenter ni les exécuter.
- **Un linter = une responsabilité** : la tentation serait de réactiver tout ESLint (style, imports, etc.), mais on retomberait dans les conflits ESLint/Biome que l'étape 01 a éliminés. Le `eslint.config.js` de cette étape ne contient **aucune règle de style** : uniquement le preset `recommended-latest` du plugin react-hooks. Chaque outil garde son périmètre : Biome = forme du code, ESLint = sémantique React.
- **`--max-warnings 0`** : le preset classe certains diagnostics en simple avertissement (`exhaustive-deps` par exemple). Un avertissement qu'on tolère aujourd'hui devient invisible demain — on convertit donc tout avertissement en échec de lint, en local comme en CI.
- **`--cache`** : ESLint est plus lent que Biome ; le cache (fichier `.eslintcache`, ignoré par git) fait qu'il ne ré-analyse que les fichiers modifiés.

**Ce qui a été ajouté** :
- `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks` (v7) en devDependencies.
- `eslint.config.js` : configuration "flat" (le format moderne d'ESLint — un simple module JS qui exporte un tableau de blocs de config). Un seul bloc : `files: ['src/**/*.{ts,tsx}']` (ESLint ne regarde que le code source de l'app), parser `typescript-eslint` (ESLint ne comprend pas TypeScript nativement), et le preset `reactHooks.configs.flat['recommended-latest']` qui active `rules-of-hooks`, `exhaustive-deps` et l'ensemble des diagnostics du React Compiler (`purity`, `immutability`, `set-state-in-render`, `refs`…).
- `package.json` :
  - script `lint` : `biome lint . && eslint --cache --max-warnings 0 .` — les deux linters en séquence, chacun sur son périmètre ;
  - script `verify` : ESLint inséré entre `biome ci` et les tests ;
  - `lint-staged` : les fichiers `.ts/.tsx` stagés passent désormais par Biome **puis** ESLint (`--no-warn-ignored` évite le bruit pour les fichiers hors de `src/`, comme `vite.config.ts`).
- `.gitignore` : ajout de `.eslintcache`.

**Décisions** :
- **Numérotation** : la mission nommait cette étape « 04 », mais le tag `step-04-testing` (mise en place de Vitest + React Testing Library) existe déjà et a été poussé. On ne renumérote jamais un historique publié : cette étape devient donc **05** et toutes les suivantes sont décalées d'un cran (06 routeur, 07 données, 08 pagination, 09 détail, 10 création, 11 édition).
- **Version du plugin** : `eslint-plugin-react-hooks@latest` a installé la **v7** (et non la v6 citée dans le brief). En v7, les configs plates vivent sous `configs.flat` — d'où `configs.flat['recommended-latest']` et non `configs['recommended-latest']` (qui est l'ancien format eslintrc, incompatible avec le flat config). Vérifié empiriquement : la mauvaise variante fait planter ESLint au démarrage.

**Concepts à retenir** :
1. Biome et le plugin react-hooks ne sont pas concurrents mais **complémentaires** : Biome vérifie la forme (style, imports, pièges JS généraux), le plugin vérifie la sémantique React (ordre des hooks, dépendances, contrats du Compiler). Aucune règle n'est portée par les deux.
2. Le React Compiler optimise silencieusement — sans ce lint, un composant qui viole ses contrats est simplement **sauté** (pas d'erreur, juste pas d'optimisation). La règle ESLint rend ce renoncement visible et actionnable.
3. Un preset de lint se vérifie **empiriquement** avant adoption : on a écrit une violation volontaire des Règles des Hooks (hook dans un `if`), constaté que `pnpm lint` la rejette, puis supprimé le fichier de démonstration. Même méthode qu'à l'étape 02 pour `noRestrictedImports`.
4. `--max-warnings 0` transforme les avertissements en erreurs : en CI, un avertissement toléré est un avertissement qui ne sera jamais lu.
5. Le flat config d'ESLint (`eslint.config.js`) est un module JS ordinaire : on peut inspecter dans Node ce qu'un plugin exporte réellement (`Object.keys(plugin.configs)`) plutôt que de deviner d'après une doc potentiellement décalée.

**Vérifier** :
```bash
pnpm lint          # biome lint . puis eslint --cache --max-warnings 0 . : tout vert
pnpm run verify    # typecheck ✓ · biome ci ✓ · eslint ✓ · 1 test ✓ · build ✓

# Test empirique : une violation des Règles des Hooks doit être rejetée
cat > src/demo.tsx <<'EOF'
import { useState } from 'react'
export function Demo({ on }: { on: boolean }) {
  if (on) {
    const [x] = useState(0)
    return <span>{x}</span>
  }
  return null
}
EOF
pnpm lint          # ✖ react-hooks/rules-of-hooks : hook appelé conditionnellement
rm src/demo.tsx    # nettoyer, pnpm lint repasse au vert
```

**Tag git** : step-05-eslint-hybride
