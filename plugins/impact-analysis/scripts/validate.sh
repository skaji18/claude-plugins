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

check_version() {
  local name="$1" current="$2" required="$3"
  local cur_major cur_minor req_major req_minor
  cur_major="${current%%.*}"
  cur_minor="${current#*.}"; cur_minor="${cur_minor%%.*}"
  req_major="${required%%.*}"
  req_minor="${required#*.}"; req_minor="${req_minor%%.*}"

  if [ "$cur_major" -gt "$req_major" ] 2>/dev/null; then
    return 0
  elif [ "$cur_major" -eq "$req_major" ] && [ "$cur_minor" -ge "$req_minor" ] 2>/dev/null; then
    return 0
  fi
  echo "[ERROR] $name $current < $required (minimum)"
  errors=$((errors + 1))
  return 1
}

echo "=== impact-analysis plugin: dependency check ==="

# --- Runtime version checks ---

echo ""
echo "--- Runtime versions ---"

if command -v go >/dev/null 2>&1; then
  go_version="$(go version | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1)"
  if check_version "Go" "$go_version" "1.21"; then
    echo "[OK] Go $go_version"
  fi
else
  echo "[ERROR] go が見つかりません"
  errors=$((errors + 1))
fi

if command -v node >/dev/null 2>&1; then
  node_version="$(node --version | sed 's/^v//')"
  if check_version "Node.js" "$node_version" "18.0"; then
    echo "[OK] Node.js $node_version"
  fi
else
  echo "[ERROR] node が見つかりません"
  errors=$((errors + 1))
fi

# --- Binary checks ---

echo ""
echo "--- Binaries ---"

check_binary "lsprefs"
check_binary "lsprefs-walk"
check_binary "intelephense"
check_binary "typescript-language-server"
check_binary "rg"

if [ "$errors" -gt 0 ]; then
  echo ""
  echo "ERROR: ${errors} 個の問題が見つかりました。"
  echo "以下のコマンドでセットアップしてください:"
  echo ""
  echo "  bash $(dirname "$0")/setup.sh"
  echo ""
  exit 1
fi

echo ""
echo "All dependencies OK."
exit 0
