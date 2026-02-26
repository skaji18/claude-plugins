#!/usr/bin/env bash
set -euo pipefail

echo "=== smart-commit plugin: validation ==="

echo ""
echo "--- git command check ---"
if command -v git >/dev/null 2>&1; then
  echo "[OK] git is available: $(git --version)"
else
  echo "[WARN] git command not found. smart-commit requires git."
fi

echo ""
echo "=== Validation complete ==="
