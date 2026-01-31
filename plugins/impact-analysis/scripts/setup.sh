#!/usr/bin/env bash
set -euo pipefail

echo "=== impact-analysis plugin: setup ==="

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
