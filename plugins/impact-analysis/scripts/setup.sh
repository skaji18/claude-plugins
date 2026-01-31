#!/usr/bin/env bash
set -euo pipefail

echo "=== impact-analysis plugin: setup ==="

# Install phprefs
echo "[1/3] Installing phprefs..."
go install github.com/skaji18/devtools/phprefs@latest
echo "  phprefs installed: $(which phprefs)"

# Install phprefs-walk
echo "[2/3] Installing phprefs-walk..."
go install github.com/skaji18/devtools/phprefs-walk@latest
echo "  phprefs-walk installed: $(which phprefs-walk)"

# Install intelephense (only if not already installed)
echo "[3/3] Checking intelephense..."
if command -v intelephense >/dev/null 2>&1; then
  echo "  intelephense already installed: $(which intelephense)"
else
  echo "  Installing intelephense..."
  npm install -g intelephense
  echo "  intelephense installed: $(which intelephense)"
fi

echo ""
echo "=== Setup complete ==="
echo "All dependencies are installed."
