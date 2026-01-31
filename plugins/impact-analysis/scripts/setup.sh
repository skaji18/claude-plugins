#!/usr/bin/env bash
set -euo pipefail

echo "=== impact-analysis plugin: setup ==="

# --- Version checks (must pass before installing) ---

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
  echo "ERROR: $name $current is below the minimum required version $required"
  return 1
}

echo "[pre] Checking runtime versions..."

# Go version check (>= 1.21)
if ! command -v go >/dev/null 2>&1; then
  echo "ERROR: go is not installed. Install Go 1.21+ from https://go.dev/dl/"
  exit 1
fi
go_version="$(go version | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1)"
if ! check_version "Go" "$go_version" "1.21"; then
  echo "  Install Go 1.21+ from https://go.dev/dl/"
  exit 1
fi
echo "  [OK] Go $go_version"

# Node.js version check (>= 18)
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is not installed. Install Node.js 18+ from https://nodejs.org/"
  exit 1
fi
node_version="$(node --version | sed 's/^v//')"
if ! check_version "Node.js" "$node_version" "18.0"; then
  echo "  Install Node.js 18+ from https://nodejs.org/"
  exit 1
fi
echo "  [OK] Node.js $node_version"

echo ""

# --- Install dependencies ---

# Install lsprefs
echo "[1/4] Installing lsprefs..."
go install github.com/skaji18/devtools/lsprefs@latest
echo "  lsprefs installed: $(which lsprefs)"

# Install lsprefs-walk
echo "[2/4] Installing lsprefs-walk..."
go install github.com/skaji18/devtools/lsprefs-walk@latest
echo "  lsprefs-walk installed: $(which lsprefs-walk)"

# Install intelephense (PHP LSP, only if not already installed)
echo "[3/4] Checking intelephense..."
if command -v intelephense >/dev/null 2>&1; then
  echo "  intelephense already installed: $(which intelephense)"
else
  echo "  Installing intelephense..."
  npm install -g intelephense
  echo "  intelephense installed: $(which intelephense)"
fi

# Install typescript-language-server (JS/TS LSP, only if not already installed)
echo "[4/4] Checking typescript-language-server..."
if command -v typescript-language-server >/dev/null 2>&1; then
  echo "  typescript-language-server already installed: $(which typescript-language-server)"
else
  echo "  Installing typescript-language-server and typescript..."
  npm install -g typescript-language-server typescript
  echo "  typescript-language-server installed: $(which typescript-language-server)"
fi

echo ""
echo "=== Setup complete ==="
echo "All dependencies are installed."
