#!/usr/bin/env bash

errors=0
SCRIPTS_DIR="$(dirname "$0")"

echo "=== gantt-viewer plugin: validation ==="

echo ""
echo "--- npm dependencies ---"

if [ -d "${SCRIPTS_DIR}/node_modules/js-yaml" ]; then
  echo "[OK] js-yaml installed"
else
  echo "[ERROR] js-yaml が見つかりません"
  echo "  以下のコマンドでインストールしてください:"
  echo ""
  echo "  npm install --prefix \"${SCRIPTS_DIR}\""
  echo ""
  errors=$((errors + 1))
fi

if [ "$errors" -gt 0 ]; then
  echo ""
  echo "WARNING: ${errors} 個の問題が見つかりました。"
  exit 0
fi

echo ""
echo "All checks OK."
exit 0
