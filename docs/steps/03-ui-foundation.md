## Étape 03 — UI Foundation

**Objectif** : poser les fondations visuelles de l'application — Tailwind CSS pour le styling utilitaire, shadcn/ui pour des composants accessibles "possédés" dans le repo, un thème clair/sombre basé sur des tokens CSS, et les trois premiers composants réutilisables (`Button`, `Card`, `Skeleton`) dans `shared/ui/`.

**Pourquoi (best practice 2026)** :
- **Tailwind CSS v4** : styling utilitaire avec purge automatique du CSS mort, configuration native via `@theme` en CSS plutôt qu'un fichier `tailwind.config.js` — plus rapide à la compilation et plus proche des standards CSS modernes (`oklch`, `@layer`, `@custom-variant`).
- **shadcn/ui** : ce n'est pas une librairie installée comme dépendance figée — le code source des composants est copié dans `shared/ui/`, ce qui les rend personnalisables à volonté. Les primitives viennent de **Base UI** (`@base-ui/react`), le successeur de Radix UI porté par la même équipe : accessibilité (focus, clavier, ARIA) garantie par construction, sans réinventer ces mécanismes.
- **Thème par tokens CSS** (`--background`, `--primary`, `--radius`…) : changer l'identité visuelle de l'appli revient à changer des variables CSS, pas à toucher au code des composants — séparation propre entre design et implémentation, et bascule clair/sombre gratuite via la classe `.dark`.

**Ce qui a été ajouté** :
- `tailwindcss` + `@tailwindcss/vite` : plugin Vite officiel pour Tailwind v4 (zéro config supplémentaire, intégré à `vite.config.ts`).
- `components.json` : configuration shadcn/ui avec les alias adaptés à notre architecture (`ui` → `@/shared/ui`, `lib` → `@/shared/lib`, `hooks` → `@/shared/hooks`, contrairement aux alias par défaut `@/components`).
- `src/index.css` : import de Tailwind, palette de tokens en `oklch` (mode clair + `.dark`), mapping `@theme inline` vers les classes utilitaires (`bg-primary`, `text-foreground`…), styles de base (`@layer base`).
- `src/shared/lib/utils.ts` : fonction `cn()` (fusion de classes via `clsx` + `tailwind-merge`) — utilitaire standard de tout projet shadcn/ui.
- `src/shared/ui/{button,card,skeleton}.tsx` : trois premiers composants générés par le CLI shadcn, basés sur `@base-ui/react` et `class-variance-authority` pour les variantes.
- `src/App.tsx` : page de démonstration utilisant les trois composants pour vérifier visuellement le thème (capture d'écran validée via Playwright : carte avec coins arrondis et bordure, squelettes avec animation de pulsation, bouton avec les bons tokens de couleur).
- `biome.json` : option `css.parser.tailwindDirectives: true` pour que Biome comprenne la syntaxe Tailwind (`@theme`, `@apply`, `@custom-variant`) sans la signaler comme une erreur de syntaxe CSS.

**Concepts à retenir** :
1. shadcn/ui "possède" le code : les composants sont copiés dans le repo, pas importés depuis `node_modules` — on peut les modifier librement sans attendre une nouvelle version upstream.
2. Base UI (`@base-ui/react`) est la suite de Radix UI Primitives par la même équipe — l'accessibilité (focus trap, rôles ARIA, navigation clavier) est gérée par la primitive, le composant shadcn n'ajoute que le style.
3. Tailwind v4 configure son thème directement en CSS (`@theme`) plutôt que via `tailwind.config.js` — moins de JS de configuration, plus proche des spécifications CSS natives.
4. Un linter qui ne connaît pas une syntaxe (ex. directives Tailwind dans le CSS) doit être explicitement configuré pour la reconnaître — sinon il la traite comme une erreur de parsing et bloque la CI pour de mauvaises raisons.
5. Une vérification visuelle (capture d'écran dans un navigateur réel) reste irremplaçable pour valider qu'un thème ou des styles utilitaires produisent le rendu attendu — `typecheck`/`lint`/`build` ne disent rien de l'apparence.

**Vérifier** :
```bash
pnpm typecheck   # aucune erreur de typage sur les nouveaux composants
pnpm lint        # biome lint . : règles CSS Tailwind reconnues, imports corrects
pnpm build       # bundle CSS généré (~24 kB) avec les classes utilitaires purgées
pnpm dev         # ouvrir http://localhost:5173 : Card avec bordure/coins arrondis,
                 # Skeleton avec animation, Button stylé selon le thème oklch
```

**Tag git** : step-03-ui-foundation
