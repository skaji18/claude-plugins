#!/usr/bin/env bash

errors=0

echo "=== task-tracker plugin: validation ==="

CONFIG_FILE="$HOME/.task-tracker.json"

# --- Config file check ---

echo ""
echo "--- Config file ---"

if [ -f "$CONFIG_FILE" ]; then
  echo "[OK] $CONFIG_FILE"
else
  echo "[WARN] $CONFIG_FILE が見つかりません"
  echo "  /init を実行するか、以下のコマンドでセットアップしてください:"
  echo ""
  echo "  bash $(dirname "$0")/setup.sh"
  echo ""
  errors=$((errors + 1))
fi

# --- Directory structure check ---

echo ""
echo "--- Directory structure ---"

if [ -f "$CONFIG_FILE" ]; then
  vault_path="$(grep '"vault_path"' "$CONFIG_FILE" | sed 's/.*: *"\(.*\)".*/\1/')"
  subfolder="$(grep '"subfolder"' "$CONFIG_FILE" | sed 's/.*: *"\(.*\)".*/\1/')"

  if [ "$vault_path" = "/path/to/your/obsidian-vault" ]; then
    echo "[WARN] vault_path がテンプレートのままです。$CONFIG_FILE を編集してください"
    errors=$((errors + 1))
  elif [ ! -d "$vault_path" ]; then
    echo "[ERROR] vault_path が存在しません: $vault_path"
    errors=$((errors + 1))
  else
    base_dir="${vault_path}/${subfolder}"
    for dir in inbox done daily attachments; do
      target="${base_dir}/${dir}"
      if [ -d "$target" ]; then
        echo "[OK] $target"
      else
        echo "[WARN] $target が見つかりません"
        errors=$((errors + 1))
      fi
    done
  fi
fi

# --- Result ---

if [ "$errors" -gt 0 ]; then
  echo ""
  echo "WARNING: ${errors} 個の問題が見つかりました。"
  echo "/init を実行するか、以下のコマンドでセットアップしてください:"
  echo ""
  echo "  bash $(dirname "$0")/setup.sh"
  echo ""
  # Exit 0 intentionally: missing config is not fatal for session start.
  # The /init or /add skill will guide the user through setup.
  exit 0
fi

echo ""
echo "All checks OK."
exit 0
