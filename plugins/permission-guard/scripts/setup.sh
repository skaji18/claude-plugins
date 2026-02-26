#!/usr/bin/env bash
# setup.sh — Verify permission-guard dependencies
set -euo pipefail

echo "=== Permission Guard Setup ==="

# Check Python3
if command -v python3 &>/dev/null; then
    echo "✓ python3 found: $(python3 --version)"
else
    echo "✗ python3 not found (required)"
    exit 1
fi

# Check PyYAML (optional)
if python3 -c "import yaml" 2>/dev/null; then
    echo "✓ PyYAML installed (config customization enabled)"
else
    echo "⚠ PyYAML not installed (hardcoded defaults will be used)"
    echo "  Install: pip3 install pyyaml"
fi

# Verify hook script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK="$SCRIPT_DIR/permission-fallback"
if [ -x "$HOOK" ]; then
    echo "✓ permission-fallback is executable"
else
    echo "✗ permission-fallback not found or not executable"
    chmod +x "$HOOK" 2>/dev/null && echo "  Fixed: made executable" || exit 1
fi

# Create venv and install dependencies
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "${SCRIPT_DIR}"
python3 -m venv .venv
.venv/bin/pip install --quiet pyyaml
echo "venv created and pyyaml installed"

echo ""
echo "Setup complete. Run 'bash scripts/test-permission.sh' to verify."
