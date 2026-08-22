#!/usr/bin/env bash
# Bulk-crea issues en un repo de GitHub a partir de roadmap_github.csv
# y los agrega a un GitHub Project (v2), usando GitHub CLI (gh).
#
# Requisitos:
#   1. Instalar GitHub CLI: https://cli.github.com/
#   2. Autenticarte:        gh auth login
#   3. Tener el repo y el Project ya creados en GitHub.
#
# Uso:
#   ./bulk_upload_github.sh <owner>/<repo> <numero-del-project>
#
# Ejemplo:
#   ./bulk_upload_github.sh nilsonaldair/torre-central-hub 3

set -euo pipefail

REPO="${1:?Uso: ./bulk_upload_github.sh <owner>/<repo> <numero-del-project>}"
PROJECT_NUMBER="${2:?Falta el numero del project (ej: 3)}"
CSV_FILE="roadmap_github.csv"

# Crear las labels si no existen (una por fase/incremento)
LABELS=("fase-1" "fase-2" "incremento-1" "incremento-2" "incremento-3" "incremento-4" "incremento-5" "fase-4")
for label in "${LABELS[@]}"; do
  gh label create "$label" --repo "$REPO" --color "5319e7" --force 2>/dev/null || true
done

# Leer el CSV (salta encabezado) y crear cada issue
tail -n +2 "$CSV_FILE" | while IFS=, read -r title body labels milestone; do
  # Quitar comillas envolventes si el CSV las trae
  title="${title%\"}"; title="${title#\"}"
  body="${body%\"}"; body="${body#\"}"
  labels="${labels%\"}"; labels="${labels#\"}"

  echo "Creando issue: $title"

  ISSUE_URL=$(gh issue create \
    --repo "$REPO" \
    --title "$title" \
    --body "$(echo -e "$body")" \
    --label "$labels")

  echo "  -> $ISSUE_URL"

  # Agregar el issue recien creado al Project (organizacion o usuario)
  gh project item-add "$PROJECT_NUMBER" --owner "${REPO%%/*}" --url "$ISSUE_URL"
done

echo "Listo: 15 issues creados y agregados al Project #$PROJECT_NUMBER"
