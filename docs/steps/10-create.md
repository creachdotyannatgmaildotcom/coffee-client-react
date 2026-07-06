# Étape 10 — Création : formulaire + boucle 400 → champ

**Objectif** : le formulaire « Nouveau café » — validation côté client (Zod + react-hook-form), POST au format wire via l'adapter, et la **boucle 400 → champ** : chaque erreur de validation renvoyée par le serveur atterrit sous le champ concerné, y compris pour une règle que le client ne connaît pas.

**Pourquoi (best practice 2026)** :
- **Le client valide pour l'UX, le serveur valide pour de vrai** : la validation client donne un retour immédiat (et évite des requêtes inutiles — testé : formulaire invalide = **zéro** appel réseau), mais elle ne fait pas autorité. Le serveur peut refuser pour des raisons que le client ignore (unicité du nom, règle métier ajoutée hier). Un front robuste **s'attend** à des 400 même après validation client, et sait les afficher au bon endroit.
- **Un seul schéma, deux formes** : `CoffeeCreateSchema` décrit la *saisie* (`name` string, `price` string en euros) et sa *sortie* domaine (`price: Money` en centimes). `z.input` type les champs du formulaire, `z.output` type ce que reçoit la mutation — la conversion euros → centimes vit dans le schéma, à la frontière, pas dans un `onSubmit` artisanal.
- **Messages hors schéma** : aucun texte d'erreur dans les schémas — la locale française de Zod (`z.config(z.locales.fr())`, chargée au démarrage et dans les tests) fournit les messages par défaut. Le jour du vrai catalogue i18n, on remplace la config, pas les schémas.
- **Cache mis à jour au bon prix** : après un POST réussi, les pages de liste sont périmées → `invalidateQueries(lists)` ; mais le détail du nouveau café est **déjà connu** (le body de la réponse 201 fait foi) → `setQueryData(detail)`. La navigation vers la page du café créé est instantanée, sans GET.
- **`isFormField`, le prédicat qui rembourse** : ventiler `fieldErrors` (des clés `string` venues du réseau) vers `setError` (qui exige `'name' | 'price'`) demande un rétrécissement de type. Doctrine : jamais de `as` — un prédicat (`key is FormField`) fait le travail en étant *vérifié à l'exécution*. Une clé inconnue (champ ajouté côté serveur) tombe proprement dans `setError('root')`.

**Ce qui a été ajouté** :
- `react-hook-form` + `@hookform/resolvers` ; composants shadcn `input` et `label` dans `shared/ui/`.
- `src/shared/config/zod-locale.ts` : locale fr de Zod, importée par `main.tsx` et le setup de test.
- `src/features/coffees/schemas/coffee.ts` : `CoffeeCreateSchema` (saisie euros → `Money`), types `CoffeeCreateInput` (= `z.input`) et `CoffeeCreate` (= `z.output`).
- `src/features/coffees/api/coffees.ts` : `createCoffee` — POST `/coffees` avec `toWirePrice(input.price)` (écriture symétrique de l'adapter) et parse du body 201 par `CoffeeSchema`.
- `src/features/coffees/hooks/use-create-coffee.ts` : la mutation avec sa stratégie de cache (invalidate lists + setQueryData detail).
- `src/features/coffees/components/coffee-create-form.tsx` : `useForm<Input, unknown, Output>` + `standardSchemaResolver`, champs accessibles (`Label htmlFor`, `aria-invalid`, erreurs en `role="alert"`), bouton désactivé pendant l'envoi, et le `catch` qui ventile : `ValidationError.fieldErrors` → `setError(champ)` via `isFormField`, tout le reste → `setError('root')`.
- `src/routes/$locale/coffees/new.tsx` : la page, qui navigue vers le détail du café créé ; lien « + Ajouter un café » sur la liste.
- `src/app/coffee-create.test.tsx` : les **tests signature** — formulaire vide soumis → messages affichés et **spy POST jamais appelé** ; serveur répondant 400 `{ name: "Un café porte déjà ce nom" }` (règle d'unicité inconnue du client) → le message s'affiche sous le champ Nom (`aria-invalid`) ; parcours nominal → le POST part **au format wire** (`{ name: 'Lungo', price: 310 }` pour une saisie « 3.10 ») et l'app navigue vers `/fr/coffees/42`.

**Décisions** :
- **`standardSchemaResolver` plutôt que `zodResolver`** : le resolver spécifique Zod de `@hookform/resolvers` se lie aux types internes d'une version précise de Zod — et notre arbre de dépendances contient deux Zod (le nôtre en 4.4, un 3.25 transitif via le CLI shadcn), ce qui faisait échouer le typage (`_zod.version.minor` incompatibles). Zod 4 implémente nativement **Standard Schema**, l'interface commune des librairies de validation : le resolver générique fonctionne sans aucun couplage de version. C'est aussi le choix le plus pérenne (changer de librairie de validation ne changerait pas le formulaire).
- **`price` saisi comme `string`** : c'est ce qu'émet réellement un `<input>`. Le schéma transforme (`string` → nombre, virgule acceptée → centimes `Money`) — pas de `valueAsNumber` ni de coercition implicite éparpillée.
- **Suppression Biome justifiée sur `label.tsx`** : `noLabelWithoutControl` ne peut pas savoir qu'un wrapper générique reçoit son `htmlFor` par props au point d'usage — `biome-ignore` avec raison explicite, la règle reste active partout ailleurs.

**Concepts à retenir** :
1. **La boucle 400 → champ est un contrat** : le backend répond `{ [champ]: message }` ; le front la traite comme une source de vérité de plus — pas comme une exception à cacher derrière un toast générique.
2. **`z.input` vs `z.output`** : un schéma avec `transform` a deux types ; le formulaire vit dans l'input, le domaine dans l'output. `useForm<Input, _, Output>` fait circuler les deux.
3. **Invalidate ce qui est périmé, écrire ce qui est connu** : après une mutation, chaque partie du cache reçoit le traitement adapté — ni refetch inutile, ni donnée obsolète.
4. **Un prédicat de type est un `as` remboursé** : même signature de rétrécissement, mais avec une vérification réelle à l'exécution.
5. **Standard Schema** : les librairies de validation convergent vers une interface commune — s'y accrocher plutôt qu'aux types internes d'une version évite des heures de débogage de dépendances.

**Vérifier** :
```bash
pnpm run verify   # typecheck ✓ · biome ci ✓ · eslint ✓ · 19 tests ✓ · build ✓
# Avec le backend (profil dev) :
pnpm dev          # /fr/coffees → « + Ajouter un café » → soumettre vide : erreurs sous
                  # les champs, aucun appel réseau (onglet Réseau) ; créer un café valide
                  # → navigation directe vers son détail, la liste se rafraîchit
```

**Tag git** : step-10-create
