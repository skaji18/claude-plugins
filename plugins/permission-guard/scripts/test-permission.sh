#!/usr/bin/env bash
# test-permission.sh — Quick validation for permission-guard plugin
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK="$SCRIPT_DIR/permission-fallback"

if [ ! -x "$HOOK" ]; then
    echo "ERROR: $HOOK not found or not executable"
    exit 1
fi

PASS=0
FAIL=0

run_test() {
    local desc="$1" cmd="$2" expect="$3"
    local input
    input=$(printf '{"tool_name":"Bash","tool_input":{"command":"%s"},"hook_event_name":"PermissionRequest"}' "$cmd")
    local output
    output=$(echo "$input" | CLAUDE_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}" "$HOOK" 2>/dev/null) || true

    if [ "$expect" = "allow" ]; then
        if echo "$output" | grep -q '"allow"'; then
            echo "✓ $desc"
            PASS=$((PASS + 1))
        else
            echo "✗ $desc (expected allow, got dialog)"
            FAIL=$((FAIL + 1))
        fi
    else
        if echo "$output" | grep -q '"allow"'; then
            echo "✗ $desc (expected dialog, got allow)"
            FAIL=$((FAIL + 1))
        else
            echo "✓ $desc"
            PASS=$((PASS + 1))
        fi
    fi
}

echo "=== Permission Guard Quick Tests ==="
echo ""

# Basic allow
run_test "ls in project" "ls work/" "allow"
run_test "cat project file" "cat README.md" "allow"
run_test "script execution" "scripts/setup.sh" "allow"

# Basic deny (triggers dialog)
run_test "pipe blocked" "cat foo | grep bar" "dialog"
run_test "semicolon blocked" "echo a; echo b" "dialog"
run_test "rm triggers ask" "rm file.txt" "dialog"
run_test "sudo triggers ask" "sudo apt update" "dialog"
run_test "curl triggers ask" "curl http://example.com" "dialog"
run_test "git push triggers ask" "git push origin main" "dialog"

# Path containment
run_test "path traversal blocked" "cat ../../etc/passwd" "dialog"
run_test "absolute outside blocked" "cat /etc/hosts" "dialog"

# Interpreter safety
run_test "python3 -c blocked" "python3 -c print(1)" "dialog"
run_test "bash -c blocked" "bash -c whoami" "dialog"

echo ""
echo "=== Results ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"
[ "$FAIL" -eq 0 ] && echo "All tests passed!" || echo "Some tests failed."
exit "$FAIL"
