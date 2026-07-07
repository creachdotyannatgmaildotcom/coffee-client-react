#!/usr/bin/env bash
# Génère le dossier pédagogique `coffee-client-base` à partir de ce repo.
#
# La base = l'outillage complet (Vite, TS strict, Biome, ESLint, Tailwind,
# kit UI shadcn, Vitest/MSW, toutes les dépendances) SANS le code applicatif :
# l'apprenant le reconstruit en suivant docs/TUTORIEL-APP.md (seul document
# conservé dans docs/). Point de départ assumé : `pnpm typecheck` est rouge,
# car src/main.tsx et src/test/setup.ts importent des modules à écrire.
#
# Usage :
#   scripts/make-base.sh [--force] [destination]
#
#   destination  dossier à créer (défaut : ../coffee-client-base)
#   --force      supprime la destination si elle existe déjà
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST=""
FORCE=0

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    -*)
      echo "option inconnue : $arg" >&2
      exit 1
      ;;
    *) DEST="$arg" ;;
  esac
done
DEST="${DEST:-$REPO_DIR/../coffee-client-base}"

if [ -e "$DEST" ]; then
  if [ "$FORCE" -eq 1 ]; then
    rm -rf "$DEST"
  else
    echo "✖ $DEST existe déjà — relancer avec --force pour le remplacer." >&2
    exit 1
  fi
fi

echo "→ Export des fichiers versionnés du repo (HEAD)…"
mkdir -p "$DEST"
git -C "$REPO_DIR" archive HEAD | tar -x -C "$DEST"

echo "→ Retrait de l'outillage propre au repo de référence…"
rm -rf "$DEST/.github" "$DEST/.husky" "$DEST/scripts"
rm -f "$DEST/.editorconfig"

echo "→ Docs : seul TUTORIEL-APP.md est conservé…"
find "$DEST/docs" -mindepth 1 ! -name 'TUTORIEL-APP.md' -delete

echo "→ Retrait du code applicatif (ce que l'apprenant va écrire)…"
rm -rf "$DEST/src/app" "$DEST/src/routes"
rm -f "$DEST/src/routeTree.gen.ts"
rm -rf "$DEST/src/shared/api" "$DEST/src/shared/money" "$DEST/src/shared/config"
rm -rf "$DEST/src/features/coffees/api" "$DEST/src/features/coffees/components" \
  "$DEST/src/features/coffees/queries" "$DEST/src/features/coffees/schemas"
rm -f "$DEST/src/features/coffees/index.ts"
rm -f "$DEST/src/features/coffees/hooks/"*.ts
rm -f "$DEST/src/test/server.ts" "$DEST/src/test/render.tsx"

# Matérialiser le squelette des dossiers vides (.gitkeep, cf. fiche 02) :
# l'apprenant voit l'architecture cible avant d'écrire la première ligne.
for dir in \
  src/app \
  src/routes \
  src/features/coffees/api \
  src/features/coffees/components \
  src/features/coffees/hooks \
  src/features/coffees/queries \
  src/features/coffees/schemas \
  src/shared/api \
  src/shared/config \
  src/shared/money; do
  mkdir -p "$DEST/$dir"
  touch "$DEST/$dir/.gitkeep"
done

echo "→ Initialisation d'un dépôt git vierge (sans l'historique des solutions)…"
git -C "$DEST" init -q -b main
git -C "$DEST" add -A
git -C "$DEST" commit -q -m "chore: base pédagogique générée depuis coffee-client" ||
  echo "  (commit initial ignoré — configurer git user.name/user.email puis committer)"

# Garde-fous : la base doit contenir ses points d'entrée pédagogiques.
for f in src/main.tsx src/test/setup.ts docs/TUTORIEL-APP.md package.json pnpm-lock.yaml; do
  if [ ! -f "$DEST/$f" ]; then
    echo "✖ fichier attendu manquant dans la base : $f" >&2
    exit 1
  fi
done

echo
echo "✔ Base générée : $DEST"
echo "  Prochaine étape pour l'apprenant :"
echo "    cd $(basename "$DEST") && pnpm install"
echo "    puis suivre docs/TUTORIEL-APP.md (pnpm typecheck est rouge : c'est voulu)."
