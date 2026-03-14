#!/usr/bin/env bash
# setup.sh — Set up gavel: venv, configs, tests
set -euo pipefail

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

echo "=== Setting up gavel ==="
echo ""

# Step 1: venv
echo "--- Step 1: venv and dependencies ---"
cd "$PLUGIN_ROOT"
if [ ! -d .venv ]; then
    python3 -m venv .venv
    echo "[created] .venv"
else
    echo "[skip] .venv already exists"
fi
.venv/bin/pip install --quiet pyyaml tree-sitter tree-sitter-bash
chmod +x "$PLUGIN_ROOT/scripts/boot"
echo ""

# Step 2a: global config
echo "--- Step 2a: global config ---"
GLOBAL_CONFIG="$HOME/.claude/gavel.yaml"
if [ -f "$GLOBAL_CONFIG" ]; then
    echo "[skip] Global config already exists: $GLOBAL_CONFIG"
else
    mkdir -p "$HOME/.claude"
    cat > "$GLOBAL_CONFIG" << 'YAML'
# gavel GLOBAL config
# Applies to ALL projects. Project config overrides these settings.
# Run /gavel:show to see effective settings.

tools_add: {}
tools_remove: []
pipe_deny_right_add: []
allowed_dirs_extra: []
# Default: ~/.claude/gavel-audit.jsonl (from plugin defaults)
# Uncomment to override:
# audit_log_path: "~/.claude/gavel-audit.jsonl"
YAML
    echo "[created] $GLOBAL_CONFIG"
fi
echo ""

# Step 2b: project config
echo "--- Step 2b: project config ---"
PROJECT_CONFIG="$PROJECT_DIR/.claude/gavel.yaml"
if [ -f "$PROJECT_CONFIG" ]; then
    echo "[skip] Project config already exists: $PROJECT_CONFIG"
else
    mkdir -p "$PROJECT_DIR/.claude"
    cat > "$PROJECT_CONFIG" << 'YAML'
# gavel PROJECT config
# Applies to THIS project only. Overrides global config.
# Run /gavel:show to see effective settings.

tools_add: {}
tools_remove: []
pipe_deny_right_add: []
allowed_dirs_extra: []
# audit_log_path: inherited from global/defaults
YAML
    echo "[created] $PROJECT_CONFIG"
fi
echo ""

# Step 3: tests
echo "--- Step 3: running tests ---"
PYTHONPATH="$PLUGIN_ROOT/scripts" "$PLUGIN_ROOT/.venv/bin/python3" "$PLUGIN_ROOT/scripts/test_e2e.py"
