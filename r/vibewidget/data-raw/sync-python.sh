#!/usr/bin/env bash
# Refresh the vendored copy of the Python engine (`src/vibe_widget`) and the
# host JS bundle inside this R package. Run from anywhere; paths are
# resolved relative to this script's location.
#
# The R package vendors the Python engine rather than depending on it being
# published to PyPI, so `library(vibewidget)` works with no separate Python
# package install step - `reticulate::py_require()` (see `R/zzz.R`) only
# needs to provision the *engine's own dependencies* (pandas, openai,
# websockets, ...), not `vibe_widget` itself.
#
# Run this after any change under `src/vibe_widget/` or after rebuilding the
# JS bundles (`npm run build-app-wrapper`), then commit the result.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$PKG_DIR/../.." && pwd)"

rsync -a --delete \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.pytest_cache' \
  --exclude='.ruff_cache' \
  --exclude='.mypy_cache' \
  "$REPO_ROOT/src/vibe_widget/" \
  "$PKG_DIR/inst/python/vibe_widget/"

echo "Synced $REPO_ROOT/src/vibe_widget -> $PKG_DIR/inst/python/vibe_widget"
du -sh "$PKG_DIR/inst/python/vibe_widget"
