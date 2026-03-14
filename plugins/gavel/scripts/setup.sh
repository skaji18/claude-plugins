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

# Add or override tool permissions (built-in defaults stay active):
#   simple:       bun: "allow"          — always auto-approve
#   confirm:      my-deploy: "ask"      — always ask first
#   fine-grained:
#     terraform:
#       ask: ["apply", "destroy"]
#       dangerous_flags: ["--force"]
#       default: "allow"
tools_add: {}

# Remove tools from built-in defaults:
tools_remove: []

# Block additional commands from receiving piped input:
no_pipe_to_add: []

# Directories outside the project where file access is auto-allowed:
allow_paths_outside_project: []

# audit_log_path: ~/.claude/gavel-audit.jsonl

# Shell syntax restrictions (allow / ask / deny):
# shell_syntax_policy:
#   var_expansion: "allow"
#   cmd_substitution: "ask"
#   glob_chars: "allow"
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

# Add or override tool permissions:
#   bun: "allow"
#   terraform: { ask: ["apply", "destroy"], default: "allow" }
tools_add: {}

# Remove tools from defaults for this project:
tools_remove: []

# Block additional commands from receiving piped input:
no_pipe_to_add: []

# Directories outside the project where file access is auto-allowed:
allow_paths_outside_project: []

# audit_log_path: inherited from global/defaults

# Shell syntax restrictions (allow / ask / deny):
# shell_syntax_policy:
#   var_expansion: "allow"
#   glob_chars: "allow"
YAML
    echo "[created] $PROJECT_CONFIG"
fi
echo ""

# Step 3: tests
echo "--- Step 3: running tests ---"
PYTHONPATH="$PLUGIN_ROOT/scripts" "$PLUGIN_ROOT/.venv/bin/python3" "$PLUGIN_ROOT/scripts/test_e2e.py"
