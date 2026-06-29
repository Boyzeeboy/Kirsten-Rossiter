#!/usr/bin/env bash
# sync-tokens.sh
# Copies the latest pipeline build into vendor/ for deployment.
# Run after `npm run build` in the KR Token Pipeline sibling repo.

PIPELINE="../KR Token Pipeline/dist/light/variables.css"
DEST="vendor/tokens.css"

if [ ! -f "$PIPELINE" ]; then
  echo "Error: pipeline output not found at $PIPELINE"
  echo "Run 'npm run build' in the KR Token Pipeline repo first."
  exit 1
fi

cp "$PIPELINE" "$DEST"
echo "✓ Synced tokens → $DEST"
