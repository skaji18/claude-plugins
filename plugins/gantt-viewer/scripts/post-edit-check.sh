#!/usr/bin/env bash
#
# PostToolUse hook for gantt-viewer plugin.
# Runs check.js after gantt.yaml is edited via Write or Edit tool.
#
# Input: JSON on stdin with tool_input.file_path
# Output: JSON with validation results as additionalContext
#

set -euo pipefail

SCRIPTS_DIR="$(dirname "$0")"

# Read stdin (hook payload)
INPUT="$(cat)"

# Extract file_path from tool_input
FILE_PATH="$(echo "$INPUT" | node -e "
  const chunks = [];
  process.stdin.on('data', c => chunks.push(c));
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(chunks.join(''));
      const fp = (data.tool_input || {}).file_path || '';
      process.stdout.write(fp);
    } catch(e) {
      process.stdout.write('');
    }
  });
")"

# Only proceed if the edited file is gantt.yaml
BASENAME="$(basename "$FILE_PATH" 2>/dev/null || echo "")"
if [ "$BASENAME" != "gantt.yaml" ]; then
  exit 0
fi

# Resolve the gantt.yaml path (use the actual edited file)
GANTT_YAML="$FILE_PATH"

if [ ! -f "$GANTT_YAML" ]; then
  echo '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"[gantt-viewer] WARNING: gantt.yaml not found at '"$GANTT_YAML"'"}}'
  exit 0
fi

# Run check.js and capture output
CHECK_OUTPUT="$(node "$SCRIPTS_DIR/check.js" "$GANTT_YAML" 2>&1)" || true

# Count errors and warnings
ERROR_COUNT="$(echo "$CHECK_OUTPUT" | grep -c '^\[ERROR\]' || true)"
WARN_COUNT="$(echo "$CHECK_OUTPUT" | grep -c '^\[WARN\]' || true)"

# Build response
if [ "$ERROR_COUNT" -gt 0 ]; then
  # Errors found - report them clearly
  CONTEXT="[gantt-viewer] gantt.yaml validation completed with ${ERROR_COUNT} ERROR(s) and ${WARN_COUNT} WARNING(s). Please fix the ERROR(s) before proceeding.\n\n${CHECK_OUTPUT}"
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PostToolUse\",\"additionalContext\":$(node -e "process.stdout.write(JSON.stringify(process.argv[1]))" "$CONTEXT")}}"
  exit 1
elif [ "$WARN_COUNT" -gt 0 ]; then
  # Warnings only - report but don't fail
  CONTEXT="[gantt-viewer] gantt.yaml validation passed with ${WARN_COUNT} WARNING(s).\n\n${CHECK_OUTPUT}"
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PostToolUse\",\"additionalContext\":$(node -e "process.stdout.write(JSON.stringify(process.argv[1]))" "$CONTEXT")}}"
  exit 0
else
  # All clean
  CONTEXT="[gantt-viewer] gantt.yaml validation passed. No errors or warnings."
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PostToolUse\",\"additionalContext\":$(node -e "process.stdout.write(JSON.stringify(process.argv[1]))" "$CONTEXT")}}"
  exit 0
fi
