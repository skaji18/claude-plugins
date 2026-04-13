#!/usr/bin/env bash

SCRIPTS_DIR="$(dirname "$0")"

echo "=== gantt plugin: validation ==="

echo ""
echo "--- npm dependencies ---"

if [ ! -d "${SCRIPTS_DIR}/node_modules" ]; then
  echo "[INFO] node_modules が見つかりません。npm install を実行します..."
  if (cd "${SCRIPTS_DIR}" && npm install --no-fund --no-audit 2>&1); then
    echo "[OK] npm install 完了"
  else
    echo "[ERROR] npm install に失敗しました"
    echo "  手動で以下を実行してください:"
    echo ""
    echo "  cd \"${SCRIPTS_DIR}\" && npm install"
    echo ""
    exit 1
  fi
fi

if [ -d "${SCRIPTS_DIR}/node_modules/js-yaml" ]; then
  echo "[OK] js-yaml installed"
else
  echo "[ERROR] js-yaml が見つかりません。npm install を再実行します..."
  if (cd "${SCRIPTS_DIR}" && npm install --no-fund --no-audit 2>&1); then
    echo "[OK] npm install 完了"
  else
    echo "[ERROR] npm install に失敗しました"
    echo "  手動で以下を実行してください:"
    echo ""
    echo "  cd \"${SCRIPTS_DIR}\" && npm install"
    echo ""
    exit 1
  fi
fi

echo ""
echo "All checks OK."
exit 0
