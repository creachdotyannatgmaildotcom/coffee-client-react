## Étape 01 — Tooling

**Objectif** : verrouiller la qualité du code dès le départ — TypeScript en mode strict total, Biome comme linter/formatter unique, EditorConfig, hooks Git automatisés (Husky + lint-staged) et un script de vérification CI.

**Pourquoi (best practice 2026)** :
- **TypeScript strict total** (`strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`) : le scaffold Vite n'active que des règles de linting partielles (`noUnusedLocals`, etc.) sans `strict`. Sans lui, `strictNullChecks` et consorts sont désactivés — un trou béant pour une appli qui va manipuler des réponses API potentiellement absentes (`CoffeeDto | undefined`, erreurs 404…). `noUncheckedIndexedAccess` force à traiter `array[i]` comme potentiellement `undefined`, ce qui correspond à la réalité du JS.
- **Biome plutôt qu'ESLint + Prettier** : un seul binaire Rust, une seule config, formateur et linter alignés nativement (fini les guerres de règles entre les deux outils), et un gain de vitesse considérable sur de gros projets. C'est désormais le choix par défaut recommandé pour les nouveaux projets React/TS.
- **Husky + lint-staged** : empêche que du code mal formaté ou non conforme entre dans l'historique Git — le filet de sécurité tourne sur les fichiers *stagés* uniquement (rapide, pas de blocage sur tout le repo).
- **EditorConfig** : garantit une cohérence d'indentation/encodage entre éditeurs, indépendamment de la configuration personnelle de chacun.
- **Script `ci`** : un point d'entrée unique (`typecheck && lint && build`) repris tel quel par la pipeline GitHub Actions — la même commande tourne en local et en CI, donc "ça marche chez moi" devient impossible.

**Ce qui a été ajouté** :
- `tsconfig.app.json` / `tsconfig.node.json` : ajout de `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- `biome.json` : configuration Biome (formatter 2 espaces, quotes simples, points-virgules "as needed", organisation automatique des imports, linter recommandé).
- Suppression d'ESLint et de ses plugins (`eslint`, `@eslint/js`, `eslint-plugin-react-*`, `typescript-eslint`, `globals`) et de `eslint.config.js`.
- `package.json` : nouveaux scripts `lint` (biome lint), `format` (biome format --write), `check` (biome check --write), `ci` (typecheck && lint && build), `prepare` (husky).
- `.editorconfig` : règles d'indentation/encodage partagées.
- `.husky/pre-commit` : exécute `lint-staged` à chaque commit.
- `lint-staged` (config dans `package.json`) : lance `biome check --write` sur les fichiers stagés (`ts,tsx,js,jsx,json,css,md`).
- `.github/workflows/ci.yml` : pipeline GitHub Actions qui installe les dépendances avec pnpm (lockfile figé) et exécute `pnpm ci`.
- `src/main.tsx` : remplacement de l'assertion non-nulle `document.getElementById('root')!` (interdite par la règle `noNonNullAssertion` de Biome et par le brief "aucune assertion `as` non justifiée") par une garde explicite qui lève une erreur lisible.

**Concepts à retenir** :
1. Le scaffold Vite "react-ts" n'active **pas** `strict` par défaut malgré son nom — toujours vérifier le `tsconfig` généré plutôt que de lui faire confiance aveuglément.
2. Biome combine lint + format + organisation des imports dans un seul outil et une seule config — moins de surface de configuration, moins de désaccords entre outils.
3. Les hooks Git (`pre-commit`) doivent rester rapides : `lint-staged` ne traite que les fichiers stagés, pas tout le repo.
4. Un script `ci` unique partagé entre local et pipeline GitHub Actions élimine la dérive entre les deux environnements.
5. Préférer une garde explicite (`if (!x) throw …`) à une assertion non-nulle (`!`) : le typage reste sûr et l'erreur, si elle survient, est compréhensible.

**Vérifier** :
```bash
pnpm typecheck   # tsc -b --noEmit : strict total appliqué, aucune erreur
pnpm lint        # biome lint . : aucun avertissement
pnpm build       # build de prod généré dans dist/
pnpm ci          # enchaîne typecheck && lint && build (même commande que la CI GitHub Actions)
git commit       # déclenche .husky/pre-commit -> lint-staged -> biome check --write sur les fichiers stagés
```

**Tag git** : step-01-tooling
