#!/usr/bin/env bash

errors=0

check_binary() {
  local name="$1"
  if command -v "$name" >/dev/null 2>&1; then
    echo "[OK] $name: $(command -v "$name")"
  else
    echo "[ERROR] $name が見つかりません"
    errors=$((errors + 1))
  fi
}

echo "=== impact-analysis plugin: dependency check ==="

check_binary "lsprefs"
check_binary "lsprefs-walk"
check_binary "intelephense"
check_binary "typescript-language-server"
check_binary "rg"

if [ "$errors" -gt 0 ]; then
  echo ""
  echo "ERROR: ${errors} 個の依存が不足しています。"
  echo "以下のコマンドでセットアップしてください:"
  echo ""
  echo "  bash $(dirname "$0")/setup.sh"
  echo ""
  exit 1
fi

echo ""
echo "All dependencies OK."
exit 0
