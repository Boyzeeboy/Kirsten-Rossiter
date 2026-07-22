#!/usr/bin/env bash
# sync-tokens.sh
#
# Copies the PINNED token build into vendor/ for deployment.
#
# The source is the installed tokens package — pinned to an exact git tag in
# package.json — NOT a sibling folder on disk. Run `npm install` first.
#
# vendor/tokens.css is committed, so deploys never need access to the tokens
# repo; this sync is a dev-time step only.
#
# Usage: npm run sync-tokens

set -euo pipefail

PKG="node_modules/kirsten-rossiter-tokens"
SRC="$PKG/dist/light/variables.css"
DEST="vendor/tokens.css"

if [ ! -f "$SRC" ]; then
  echo "Error: tokens not found at $SRC"
  echo "Run 'npm install' first — the tokens package is pinned in package.json."
  echo "If install failed, check the tag in package.json exists on the tokens repo."
  exit 1
fi

VERSION=$(node -p "require('./$PKG/package.json').version" 2>/dev/null || echo "unknown")

cp "$SRC" "$DEST"
echo "✓ Synced tokens v$VERSION → $DEST"
echo "  (light mode only — dark is built upstream but not shipped to the site)"
