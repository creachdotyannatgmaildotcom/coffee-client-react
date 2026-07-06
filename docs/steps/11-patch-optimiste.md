# Étape 11 — Édition : PATCH optimiste

**Objectif** : le formulaire d'édition d'un café, avec un **PATCH partiel** (seuls les champs modifiés voyagent) et une **mutation optimiste complète** : l'UI affiche la nouvelle valeur *avant* la réponse du serveur, la restaure si le serveur refuse, et se resynchronise dans tous les cas.

**Pourquoi (best practice 2026)** :
- **L'optimisme est une promesse tenue ou remboursée** : dans 99 % des cas le serveur dira oui — faire attendre l'utilisateur pour le 1 % restant est une mauvaise moyenne. On affiche donc la valeur spéculée immédiatement, et on assume le contrat : **rollback + alerte** si le serveur dit non. Les trois états (spéculation → rollback → alerte) sont testés avec un `delay()` MSW qui rend la fenêtre d'optimisme observable.
- **La chorégraphie en quatre temps est non négociable** :
  1. `onMutate` — `cancelQueries` (une réponse en vol écraserait la spéculation avec du périmé), **snapshot** du détail et de toutes les pages de liste, écriture spéculative des deux ;
  2. `onError` — restauration intégrale du snapshot ;
  3. `onSuccess` — la réponse du PATCH remplace la spéculation (vérité serveur) ;
  4. `onSettled` — invalidation détail + listes : succès ou échec, on finit resynchronisé.
  Sauter une étape produit les bugs classiques : donnée fantôme après échec, liste incohérente avec le détail, spéculation écrasée par un refetch tardif.
- **PATCH partiel piloté par `dirtyFields`** : react-hook-form sait exactement ce que l'utilisateur a touché. Un PATCH qui renvoie tout l'objet écraserait des champs modifiés par ailleurs ; n'envoyer que le diff est le contrat même de PATCH. Testé : modifier le prix seul envoie `{ price: 390 }` — pas de `name`.
- **`values:` plutôt que `defaultValues`** : le formulaire est *pré-rempli depuis l'état serveur* et reste synchronisé si le cache change ; `resetOptions: { keepDirtyValues: true }` préserve la saisie de l'utilisateur lors d'un rollback — il corrige et réessaie sans tout retaper.
- **Immutabilité partout** : les écritures spéculatives reconstruisent (`{ ...page, content: page.content.map(...) }`), ne modifient jamais en place — indispensable pour que React Query détecte les changements et que le React Compiler optimise sereinement.

**Ce qui a été ajouté** :
- `src/features/coffees/api/coffees.ts` : `patchCoffee(id, patch)` — ne sérialise que les champs présents, au format wire (`toWirePrice`).
- `src/features/coffees/hooks/use-update-coffee.ts` : la mutation optimiste complète (les quatre temps commentés un à un).
- `src/features/coffees/components/coffee-edit-form.tsx` : `values:` + `dirtyFields` → patch minimal ; même boucle 400 → champ que la création.
- `src/features/coffees/components/server-errors.ts` : `applyServerErrors` — la ventilation `ValidationError.fieldErrors` → `setError`, extraite et partagée entre création et édition (le prédicat `isFormField` y vit désormais).
- `src/routes/$locale/coffees/$coffeeId_.edit.tsx` : la route `/…/coffees/:id/edit` — le suffixe `_` du fichier la sort de l'imbrication sous la route détail (elle est *sœur*, pas enfant : elle remplace la page au lieu de s'afficher dedans). Mêmes gardes que le détail (id parsé → `notFound()`, loader 404 → `notFound()`). L'en-tête de la page affiche `nom — prix` **lus depuis le cache** : c'est là qu'on *voit* l'écriture optimiste.
- Lien « Modifier » sur la page détail.
- `src/app/coffee-edit.test.tsx` : les **tests signature**, sur un faux backend à état avec `delay(250)` — le nouveau prix s'affiche **avant** la réponse (URL encore sur /edit), puis navigation ; sur 500 : spéculation → rollback (2,50 € revient, 3,90 € disparaît) → alerte, sans navigation ; le PATCH ne transporte que `{ price: 390 }`.

**Décisions** :
- **Le prix « témoin » est affiché sur la page d'édition elle-même** (en-tête depuis le cache) plutôt que de naviguer optimistiquement vers le détail : la mutation reste possédée par le formulaire (pas de callbacks orphelins après démontage), l'alerte de rollback a un endroit naturel où vivre, et l'utilisateur garde sa saisie pour corriger. La navigation n'a lieu qu'à la confirmation serveur.
- **`applyServerErrors` extrait maintenant** (et pas à l'étape 10) : la règle « on factorise à la deuxième occurrence », pas avant — la duplication naissante entre les deux formulaires justifie l'extraction.

**Concepts à retenir** :
1. **Optimisme = spéculation + snapshot + rollback + resynchronisation** — les quatre ou rien. Un « optimisme » sans rollback est un bug différé.
2. **`cancelQueries` d'abord** : le pire ennemi d'une écriture optimiste est un refetch parti *avant* la mutation qui atterrit *après* elle.
3. **PATCH transporte un diff** : `dirtyFields` est la source de vérité de « ce que l'utilisateur a changé » — pas une comparaison manuelle des valeurs.
4. **Tester le temps** : un `delay()` MSW transforme une course invisible en fenêtre observable — c'est ce qui permet d'affirmer « affiché AVANT la réponse » dans un test déterministe.
5. **Factoriser à la deuxième occurrence** : extraire `applyServerErrors` quand l'édition en a eu besoin, pas spéculativement à la création.

**Vérifier** :
```bash
pnpm run verify   # typecheck ✓ · biome ci ✓ · eslint ✓ · 22 tests ✓ · build ✓
# Avec le backend (profil dev) — throttler le réseau (DevTools) pour voir l'optimisme :
pnpm dev          # détail → Modifier → changer le prix → Enregistrer :
                  # l'en-tête change instantanément, puis navigation au retour serveur ;
                  # backend coupé : le prix revient + alerte, la saisie est conservée
```

**Tag git** : step-11-patch-optimiste
