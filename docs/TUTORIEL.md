# Coffee Client — construire le projet de zéro, pas à pas

Ce tutoriel s'adresse à un **débutant complet** : il part de la toute première commande
(installation des outils) et va jusqu'à la dernière ligne de code (premier test automatisé).
À la fin de **chaque étape**, le projet compile, se lance et passe toutes les vérifications —
on ne passe jamais à l'étape suivante avec un projet cassé.

Ce qu'on construit : le squelette d'une application React moderne (juillet 2026) nommée
`coffee-client`, avec :

| Étape | Contenu | Fiche détaillée |
|---|---|---|
| 00 | Scaffold Vite + React 19 + TypeScript + React Compiler | [steps/00-scaffold.md](./steps/00-scaffold.md) |
| 01 | Tooling : TypeScript strict, Biome, Husky, CI GitHub Actions | [steps/01-tooling.md](./steps/01-tooling.md) |
| 02 | Architecture feature-based, alias `@/`, frontières d'import | [steps/02-architecture.md](./steps/02-architecture.md) |
| 03 | UI : Tailwind CSS v4, shadcn/ui (Button, Card, Skeleton) | [steps/03-ui-foundation.md](./steps/03-ui-foundation.md) |
| 04 | Tests : Vitest + React Testing Library | — |
| 05 | Lint hybride : ESLint minimal pour le React Compiler | [steps/05-eslint-hybride.md](./steps/05-eslint-hybride.md) |
| 06 | Routage : TanStack Router + proxy API | [steps/06-router.md](./steps/06-router.md) |
| 07 | Données : TanStack Query + adapter Zod + Money | [steps/07-query-money.md](./steps/07-query-money.md) |

> **Convention de lecture** : les blocs `bash` sont des commandes à taper dans le terminal,
> depuis le dossier du projet (sauf mention contraire). Les blocs avec un nom de fichier en
> titre sont le **contenu complet** du fichier à créer ou remplacer.

---

## Étape 0 — Prérequis (une seule fois par machine)

Il faut trois outils : **Node.js** (exécute JavaScript hors navigateur), **pnpm**
(gestionnaire de paquets, plus rapide et plus strict que npm) et **git** (historique du code).

1. **Node.js 24 ou plus** : télécharger la version LTS sur <https://nodejs.org>, ou avec
   [nvm](https://github.com/nvm-sh/nvm) :

   ```bash
   nvm install 24
   nvm use 24
   node --version   # doit afficher v24.x.x ou plus
   ```

2. **pnpm 11 ou plus** :

   ```bash
   npm install -g pnpm
   pnpm --version   # doit afficher 11.x.x ou plus
   ```

3. **git** : déjà présent sur Linux/macOS en général (`git --version`), sinon <https://git-scm.com>.

---

## Étape 00 — Scaffold : une application React qui démarre

### 00.1 Créer le projet

`create-vite` génère un projet React + TypeScript minimal mais fonctionnel :

```bash
pnpm create vite@latest coffee-client --template react-ts
cd coffee-client
pnpm install
git init
```

Lancer le serveur de développement pour vérifier que tout fonctionne :

```bash
pnpm dev
```

Ouvrir <http://localhost:5173> : la page de démonstration Vite s'affiche.
Arrêter le serveur avec `Ctrl+C`.

### 00.2 Nettoyer le contenu de démonstration

Le template livre des logos et du CSS de démo dont on ne veut pas. On supprime les assets
et on remplace trois fichiers par une version minimale.

```bash
rm -f src/assets/react.svg public/vite.svg src/App.css
```

```tsx
// src/App.tsx
function App() {
  return <h1>Coffee Client</h1>
}

export default App
```

```css
/* src/index.css — vidé pour l'instant, Tailwind arrivera à l'étape 03 */
```

```html
<!-- index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Coffee Client</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

> Le favicon référencé n'existe pas encore : déposer n'importe quel SVG dans
> `public/favicon.svg` (ou supprimer la ligne `<link rel="icon" …>` en attendant).

### 00.3 Activer le React Compiler

Le React Compiler mémoïse automatiquement composants et hooks au build : on n'écrira
**jamais** de `useMemo`/`useCallback` défensifs. On l'active dès maintenant. Avec Vite 8 et
`@vitejs/plugin-react` v6, il se branche via un plugin Babel séparé :

```bash
pnpm add -D @rolldown/plugin-babel babel-plugin-react-compiler @babel/core @types/babel__core
```

```ts
// vite.config.ts
import babel from '@rolldown/plugin-babel'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
})
```

### 00.4 Ajouter le script `typecheck`

Dans `package.json`, section `"scripts"`, ajouter une ligne :

```jsonc
"typecheck": "tsc -b --noEmit",
```

### ✅ Vérifier l'étape 00

```bash
pnpm typecheck   # aucune erreur de typage
pnpm build       # génère un build de production dans dist/
pnpm dev         # http://localhost:5173 affiche "Coffee Client"
```

Premier commit :

```bash
git add -A
git commit -m "feat: scaffold React 19 + Vite + React Compiler"
git tag step-00-scaffold
```

---

## Étape 01 — Tooling : verrouiller la qualité dès le départ

Objectif : que le code mal typé, mal formaté ou non conforme **ne puisse pas** entrer dans
l'historique git ni passer la CI.

### 01.1 TypeScript en mode strict total

Malgré son nom, le template "react-ts" n'active pas toutes les protections. Ouvrir
`tsconfig.app.json` **et** `tsconfig.node.json`, et s'assurer que la section
`compilerOptions` contient :

```jsonc
/* Strict total */
"strict": true,
"noUncheckedIndexedAccess": true,
"exactOptionalPropertyTypes": true,
```

- `strict` : active toutes les vérifications de base (dont `strictNullChecks` — `null` et
  `undefined` doivent être gérés explicitement).
- `noUncheckedIndexedAccess` : `tableau[i]` est typé "peut-être `undefined`", ce qui est la
  réalité du JavaScript.
- `exactOptionalPropertyTypes` : une propriété optionnelle absente et une propriété à
  `undefined` sont deux choses différentes.

### 01.2 Remplacer ESLint par Biome

Biome = linter + formateur + tri des imports dans **un seul outil**, très rapide.
On supprime ESLint (installé par le template) et on installe Biome :

```bash
pnpm remove eslint @eslint/js eslint-plugin-react-hooks eslint-plugin-react-refresh typescript-eslint globals
rm eslint.config.js
pnpm add -D @biomejs/biome
```

> Si `pnpm remove` se plaint d'un paquet absent, retirer ce nom de la commande : la liste
> exacte dépend de la version du template. L'important est que `package.json` ne contienne
> plus aucun paquet `eslint*` et que `eslint.config.js` ait disparu.

```json
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/2.4.16/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignoreUnknown": false
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "asNeeded"
    }
  },
  "assist": {
    "enabled": true,
    "actions": {
      "source": {
        "organizeImports": "on"
      }
    }
  }
}
```

Formater tout le projet une première fois avec les nouvelles règles :

```bash
pnpm exec biome check --write .
```

Biome va signaler une erreur dans `src/main.tsx` : le template utilise
`document.getElementById('root')!` et l'assertion non-nulle `!` est interdite
(règle `noNonNullAssertion`). On la remplace par une garde explicite — plus sûr **et** plus
lisible en cas d'erreur :

```tsx
// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found in index.html')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

### 01.3 EditorConfig

Garantit la même indentation et le même encodage quel que soit l'éditeur :

```ini
# .editorconfig
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false
```

### 01.4 Épingler les versions de Node et pnpm

Dans `package.json`, juste après `"type": "module"`, ajouter :

```jsonc
"packageManager": "pnpm@11.9.0",
"engines": {
  "node": ">=24",
  "pnpm": ">=11"
},
```

Tout le monde (et la CI) utilise ainsi les mêmes versions d'outils.

### 01.5 Scripts qualité

Remplacer la section `"scripts"` de `package.json` par :

```jsonc
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "typecheck": "tsc -b --noEmit",
  "lint": "biome lint .",
  "format": "biome format --write .",
  "check": "biome check --write .",
  "preview": "vite preview",
  "verify": "pnpm typecheck && biome ci . && pnpm build",
  "prepare": "husky"
},
```

Deux pièges évités ici :

- Le script s'appelle **`verify` et non `ci`** : `pnpm ci` est une commande **intégrée** à
  pnpm (installation propre, comme `npm ci`) qui masquerait notre script — on croirait
  lancer les vérifications alors qu'on relancerait juste une installation.
- On utilise **`biome ci .`** et non `biome lint` : `biome ci` vérifie le lint **et** le
  formatage **et** l'ordre des imports, sans rien modifier — exactement ce qu'une CI doit faire.

### 01.6 Hooks git : Husky + lint-staged

À chaque `git commit`, Biome corrige automatiquement les fichiers stagés. Impossible de
committer du code mal formaté, et c'est rapide car seuls les fichiers stagés sont traités.

```bash
pnpm add -D husky lint-staged
pnpm exec husky init
```

`husky init` a créé `.husky/pre-commit` — remplacer son contenu par :

```bash
# .husky/pre-commit
pnpm exec lint-staged
```

Puis déclarer la configuration lint-staged dans `package.json` (au même niveau que
`"scripts"`) :

```jsonc
"lint-staged": {
  "*.{ts,tsx,js,jsx,json,css,md}": [
    "biome check --write --no-errors-on-unmatched"
  ]
},
```

### 01.7 CI GitHub Actions

La même commande `verify` tourne en local et sur GitHub : "ça marche chez moi" devient
impossible.

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - run: pnpm run verify
```

### ✅ Vérifier l'étape 01

```bash
pnpm run verify   # typecheck + biome ci + build : tout vert
git add -A
git commit -m "feat(tooling): strict TS, Biome, Husky, lint-staged, CI"
# → le hook pre-commit se déclenche : lint-staged passe sur les fichiers stagés
git tag step-01-tooling
```

---

## Étape 02 — Architecture : dossiers par feature et frontières d'import

Objectif : organiser le code **par capacité métier** (`features/coffees/`) plutôt que par
type technique (`components/`, `hooks/`…), et rendre cette organisation **impossible à
contourner** grâce au linter.

### 02.1 Le squelette de dossiers

```bash
mkdir -p src/app src/routes src/types \
  src/features/coffees/{api,components,hooks,schemas,stores} \
  src/shared/{ui,lib,hooks,config}
```

Git ne versionne pas les dossiers vides : on y dépose un fichier `.gitkeep` (convention) :

```bash
touch src/app/.gitkeep src/routes/.gitkeep src/types/.gitkeep \
  src/features/coffees/{api,components,hooks,schemas,stores}/.gitkeep \
  src/shared/{ui,lib,hooks,config}/.gitkeep
```

Rôle de chaque dossier :

| Dossier | Contenu |
|---|---|
| `src/app/` | Composition de l'application (providers, layout racine) |
| `src/routes/` | Définition des routes |
| `src/features/coffees/` | Tout ce qui concerne la feature "cafés" : API, composants, hooks, schémas, stores |
| `src/shared/` | Code réutilisable sans logique métier : composants UI, utilitaires, hooks génériques |
| `src/types/` | Types globaux |

### 02.2 Le barrel : l'API publique d'une feature

Chaque feature expose un **unique point d'entrée** (`index.ts`). Le reste de l'application
importe `@/features/coffees`, jamais ses sous-dossiers — la feature reste libre de se
réorganiser en interne sans rien casser ailleurs.

```ts
// src/features/coffees/index.ts
// Point d'entrée public de la feature "coffees" — seul chemin d'import autorisé
// depuis l'extérieur (app/, routes/, autres features). Les sous-dossiers
// (api, components, hooks, schemas, stores) ne s'importent jamais directement.
export {}
```

(`export {}` = barrel vide pour l'instant ; il se remplira au fil des jalons.)

### 02.3 L'alias `@/`

Des imports absolus (`@/shared/ui/button`) plutôt que relatifs (`../../../shared/ui/button`).
L'alias se déclare à **deux endroits** qui ne se synchronisent pas tout seuls :

**Côté TypeScript** — dans `tsconfig.app.json`, section `compilerOptions` :

```jsonc
"paths": {
  "@/*": ["./src/*"]
}
```

**Côté Vite** — `vite.config.ts` complet à ce stade (le module `node:url` demande les types
Node) :

```bash
pnpm add -D @types/node
```

```ts
// vite.config.ts
import { fileURLToPath } from 'node:url'
import babel from '@rolldown/plugin-babel'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
```

### 02.4 La frontière encodée dans le linter

Une convention non vérifiée par l'outillage finit toujours par être violée. Dans
`biome.json`, remplacer la section `"linter"` par :

```jsonc
"linter": {
  "enabled": true,
  "rules": {
    "recommended": true,
    "style": {
      "noRestrictedImports": {
        "level": "error",
        "options": {
          "patterns": [
            {
              "group": [
                "@/features/*/api/*",
                "@/features/*/components/*",
                "@/features/*/hooks/*",
                "@/features/*/schemas/*",
                "@/features/*/stores/*"
              ],
              "message": "Importer une feature uniquement via son barrel public (index.ts) — jamais ses sous-dossiers internes."
            }
          ]
        }
      }
    }
  }
},
```

**Tester la règle empiriquement** (une règle de lint s'adopte après vérification, pas sur
confiance). Ajouter temporairement dans `src/App.tsx` :

```ts
import { x } from '@/features/coffees/api/client'
```

`pnpm lint` doit afficher l'erreur `noRestrictedImports` avec notre message. Retirer la
ligne : `pnpm lint` repasse au vert.

### ✅ Vérifier l'étape 02

```bash
pnpm run verify
git add -A
git commit -m "feat(architecture): feature-based skeleton, @/ alias, import boundaries"
git tag step-02-architecture
```

---

## Étape 03 — Fondations UI : Tailwind CSS v4 + shadcn/ui

Objectif : le styling utilitaire (Tailwind), des composants accessibles dont on **possède le
code** (shadcn/ui sur primitives Base UI), et un thème clair/sombre par variables CSS.

### 03.1 Tailwind CSS v4

```bash
pnpm add tailwindcss @tailwindcss/vite tw-animate-css
```

Dans `vite.config.ts`, ajouter le plugin :

```ts
import tailwindcss from '@tailwindcss/vite'
// …
plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
```

Et dans `src/index.css` (qui était vide) :

```css
@import "tailwindcss";
@import "tw-animate-css";
```

Tailwind v4 se configure **directement en CSS** (directive `@theme`) : pas de
`tailwind.config.js`.

### 03.2 Apprendre à Biome la syntaxe Tailwind

Sans cela, Biome traiterait `@theme`, `@custom-variant`, `@apply` comme des erreurs CSS.
Dans `biome.json`, ajouter au niveau racine :

```jsonc
"css": {
  "parser": {
    "tailwindDirectives": true
  }
},
```

### 03.3 Initialiser shadcn/ui

shadcn/ui n'est **pas une librairie de composants installée** : son CLI copie le code source
des composants dans notre repo (`src/shared/ui/`), où on peut le modifier librement. Les
primitives d'accessibilité (focus, clavier, ARIA) viennent de Base UI (`@base-ui/react`).

```bash
pnpm dlx shadcn@latest init
```

Répondre aux questions : couleur de base **neutral**, variables CSS **oui**. Le CLI crée
`components.json` et remplit `src/index.css` avec le thème.

Le CLI suppose par défaut des alias `@/components` et `@/lib` — les adapter à notre
architecture en éditant `components.json` :

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-nova",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "rtl": false,
  "aliases": {
    "components": "@/shared/ui",
    "utils": "@/shared/lib/utils",
    "ui": "@/shared/ui",
    "lib": "@/shared/lib",
    "hooks": "@/shared/hooks"
  },
  "registries": {}
}
```

Après l'init, `src/index.css` doit contenir (en plus des deux `@import`) :

- `@custom-variant dark (&:is(.dark *));` — la bascule sombre par classe `.dark` ;
- un bloc `:root { --background: …; --primary: …; }` — les **tokens** du thème clair, en
  couleurs `oklch` ;
- un bloc `.dark { … }` — les mêmes tokens en version sombre ;
- un bloc `@theme inline { --color-background: var(--background); … }` — le pont qui
  transforme chaque token en classes utilitaires (`bg-background`, `text-primary`…) ;
- un bloc `@layer base` appliquant `bg-background text-foreground` au `body`.

(Le fichier de référence complet est [`src/index.css`](../src/index.css) dans ce repo.)

L'init crée aussi l'utilitaire `cn()`, standard de tout projet shadcn — il fusionne
intelligemment des classes Tailwind :

```ts
// src/shared/lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### 03.4 Ajouter les trois premiers composants

```bash
pnpm dlx shadcn@latest add button card skeleton
```

Le CLI copie `button.tsx`, `card.tsx`, `skeleton.tsx` dans `src/shared/ui/` et installe
lui-même leurs dépendances (`@base-ui/react`, `class-variance-authority`, `clsx`,
`tailwind-merge`, `lucide-react`). Ouvrir `src/shared/ui/button.tsx` pour voir le principe :
une primitive Base UI + des variantes de style déclarées avec `cva()` — **c'est notre code**,
modifiable à volonté.

### 03.5 Page de démonstration

```tsx
// src/App.tsx
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Skeleton } from '@/shared/ui/skeleton'

function App() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Coffee Client</h1>
      <Card>
        <CardHeader>
          <CardTitle>Fondations UI</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Button>Valider</Button>
        </CardContent>
      </Card>
    </main>
  )
}

export default App
```

### ✅ Vérifier l'étape 03

```bash
pnpm run verify
pnpm dev
```

Dans le navigateur : une carte à bordure et coins arrondis, deux barres de squelette qui
pulsent, un bouton sombre "Valider". `typecheck`/`lint`/`build` ne disent rien de
l'apparence — **toujours** vérifier visuellement un changement de style.

```bash
git add -A
git commit -m "feat(ui): Tailwind CSS v4 + shadcn/ui foundation (Button, Card, Skeleton)"
git tag step-03-ui-foundation
```

---

## Étape 04 — Tests : Vitest + React Testing Library

Objectif : pouvoir prouver automatiquement qu'un composant fait ce qu'on attend. Vitest est
le lanceur de tests natif de l'écosystème Vite ; React Testing Library teste les composants
**comme un utilisateur les voit** (rôles accessibles, texte visible) et non par leurs
détails d'implémentation.

### 04.1 Installer

```bash
pnpm add -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- `jsdom` : un faux navigateur en Node, pour rendre les composants sans Chrome ;
- `@testing-library/jest-dom` : des assertions lisibles (`toBeInTheDocument()`…) ;
- `@testing-library/user-event` : simulera les clics et frappes clavier (utile dès les
  prochains jalons).

### 04.2 Configurer

Vitest lit la configuration de Vite. On lui ajoute un bloc `test` dans `vite.config.ts` —
la première ligne (`/// <reference …>`) apprend à TypeScript que la propriété `test` existe :

```ts
// vite.config.ts
/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

Le fichier de setup s'exécute avant chaque fichier de test : il enregistre les assertions
jest-dom et le nettoyage du DOM entre les tests :

```ts
// src/test/setup.ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Sans globals Vitest, RTL ne peut pas enregistrer son cleanup automatique.
afterEach(cleanup)
```

### 04.3 Premier test

Un test = **rendre** le composant, puis **affirmer** ce que l'utilisateur doit voir. On
cible les éléments par leur **rôle accessible** (`heading`, `button`) : si le test passe,
c'est aussi la preuve que la page est correctement structurée pour un lecteur d'écran.

```tsx
// src/App.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '@/App'

describe('App', () => {
  it('affiche le titre et le bouton de validation', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Coffee Client' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Valider' })).toBeInTheDocument()
  })
})
```

### 04.4 Brancher les tests dans les scripts et la CI

Dans `package.json`, ajouter les deux scripts de test et insérer `pnpm test` dans `verify` :

```jsonc
"test": "vitest run",
"test:watch": "vitest",
"verify": "pnpm typecheck && biome ci . && pnpm test && pnpm build",
```

La CI exécute déjà `pnpm run verify` : les tests y tournent donc automatiquement, sans
toucher à `ci.yml`.

### ✅ Vérifier l'étape 04

```bash
pnpm test
```

Sortie attendue :

```
 Test Files  1 passed (1)
      Tests  1 passed (1)
```

Puis la vérification complète et le commit :

```bash
pnpm run verify   # typecheck ✓ · biome ci ✓ · 1 test ✓ · build ✓
git add -A
git commit -m "feat(testing): Vitest + React Testing Library setup with first test"
git tag step-04-testing
```

---

## Récapitulatif

Vous avez construit, en 5 étapes toujours vertes :

1. une app **React 19 + Vite 8** avec le **React Compiler** (mémoïsation automatique) ;
2. un socle qualité **non contournable** : TypeScript strict total, Biome (lint + format),
   hook pre-commit, et une commande `verify` identique en local et en CI ;
3. une **architecture feature-based** dont les frontières sont gardées par le linter ;
4. des fondations UI **possédées dans le repo** : Tailwind v4, thème par tokens `oklch`,
   composants shadcn/ui accessibles (Base UI) ;
5. une chaîne de **tests** orientée utilisateur avec Vitest + React Testing Library.

Le cycle de travail à retenir pour la suite :

```bash
pnpm dev          # coder avec rechargement à chaud
pnpm test:watch   # tests relancés à chaque sauvegarde
pnpm run verify   # avant chaque commit important : tout doit être vert
```

### En cas de problème

- **Les versions ont bougé** : ce tutoriel a été validé avec React 19.2, Vite 8, TypeScript 6,
  Biome 2.4, Vitest 4, Tailwind 4.3, Node 24, pnpm 11. Comparer votre `package.json` avec
  celui du repo de référence en cas de comportement différent.
- **`pnpm ci` réinstalle au lieu de vérifier** : c'est normal, `ci` est une commande interne
  de pnpm — la commande de vérification du projet est `pnpm run verify`.
- **Biome signale une erreur sur `@theme` ou `@apply`** : vérifier
  `css.parser.tailwindDirectives: true` dans `biome.json` (étape 03.2).
- **`Cannot find module '@/…'`** : l'alias doit être déclaré aux deux endroits —
  `tsconfig.app.json` (`paths`) et `vite.config.ts` (`resolve.alias`) (étape 02.3).
