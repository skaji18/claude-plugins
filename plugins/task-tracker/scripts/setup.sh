#!/usr/bin/env bash
set -euo pipefail

echo "=== task-tracker plugin: setup ==="

CONFIG_FILE="$HOME/.task-tracker.json"

# --- Config file ---

echo ""
echo "--- Config file ---"

if [ -f "$CONFIG_FILE" ]; then
  echo "[OK] $CONFIG_FILE already exists"
else
  echo "[INFO] $CONFIG_FILE not found. Creating template..."
  cat > "$CONFIG_FILE" <<'TMPL'
{
  "vault_path": "/path/to/your/obsidian-vault",
  "subfolder": "task-tracker",
  "tag_rules": {
    "github.com": "#type/review",
    "docs.google.com": "#type/doc"
  }
}
TMPL
  echo "  Created: $CONFIG_FILE"
  echo ""
  echo "  [ACTION REQUIRED] Edit $CONFIG_FILE and set vault_path to your Obsidian Vault path."
  echo "  Alternatively, use /init to set it up interactively."
fi

# --- Directory structure ---

echo ""
echo "--- Directory structure ---"

if [ -f "$CONFIG_FILE" ]; then
  # Parse vault_path and subfolder from JSON (portable: no jq dependency)
  vault_path="$(grep '"vault_path"' "$CONFIG_FILE" | sed 's/.*: *"\(.*\)".*/\1/')"
  subfolder="$(grep '"subfolder"' "$CONFIG_FILE" | sed 's/.*: *"\(.*\)".*/\1/')"

  if [ "$vault_path" = "/path/to/your/obsidian-vault" ]; then
    echo "[SKIP] vault_path is still the template default. Edit $CONFIG_FILE first."
  elif [ -d "$vault_path" ]; then
    base_dir="${vault_path}/${subfolder}"
    for dir in inbox done daily attachments; do
      target="${base_dir}/${dir}"
      if [ -d "$target" ]; then
        echo "[OK] $target"
      else
        mkdir -p "$target"
        echo "[CREATED] $target"
      fi
    done
  else
    echo "[ERROR] vault_path does not exist: $vault_path"
    echo "  Edit $CONFIG_FILE and set a valid path."
    exit 1
  fi
fi

echo ""
echo "=== Setup complete ==="
