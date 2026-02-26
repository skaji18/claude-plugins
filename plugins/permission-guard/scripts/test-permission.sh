#!/usr/bin/env bash
# test-permission.sh — Comprehensive validation for permission-guard plugin
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

# run_test_raw: accepts pre-formed JSON for cases where command contains
# characters that would break printf-based JSON construction (quotes, backslashes, unicode)
run_test_raw() {
    local desc="$1" raw_json="$2" expect="$3"
    local output
    output=$(printf '%s' "$raw_json" | CLAUDE_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}" "$HOOK" 2>/dev/null) || true

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

echo "=== Permission Guard Comprehensive Tests ==="
echo ""

# ============================================================
# Section 1: Original baseline tests
# ============================================================
echo "--- Baseline Tests ---"

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

# ============================================================
# Section 2: P0 Tests — Urgent list additions
# ============================================================
echo ""
echo "--- P0: Urgent List Additions ---"

# F-001: Command name with quotes/backslashes → ask
# Use raw JSON because the command itself contains quote/backslash chars
run_test_raw "F-001: single-quoted command name" \
    '{"tool_name":"Bash","tool_input":{"command":"'\''rm'\'' file.txt"},"hook_event_name":"PermissionRequest"}' \
    "dialog"
run_test_raw "F-001: backslash in command name" \
    '{"tool_name":"Bash","tool_input":{"command":"\\rm file.txt"},"hook_event_name":"PermissionRequest"}' \
    "dialog"
run_test_raw "F-001: double-quoted command name" \
    '{"tool_name":"Bash","tool_input":{"command":"\"rm\" file.txt"},"hook_event_name":"PermissionRequest"}' \
    "dialog"

# F-003: python, python2 → ask
run_test "F-003: python triggers ask" "python scripts/test.py" "dialog"
run_test "F-003: python2 triggers ask" "python2 scripts/test.py" "dialog"

# F-004: shell interpreter variants → ask
run_test "F-004: dash triggers ask" "dash scripts/test.sh" "dialog"
run_test "F-004: zsh triggers ask" "zsh scripts/test.sh" "dialog"
run_test "F-004: ksh triggers ask" "ksh scripts/test.sh" "dialog"
run_test "F-004: fish triggers ask" "fish scripts/test.sh" "dialog"
run_test "F-004: csh triggers ask" "csh scripts/test.sh" "dialog"
run_test "F-004: tcsh triggers ask" "tcsh scripts/test.sh" "dialog"

# F-010: command → ask
run_test "F-010: command builtin triggers ask" "command ls" "dialog"

# NEW-6: find, chmod, chown → ask
run_test "NEW-6: find triggers ask" "find ." "dialog"
run_test "NEW-6: chmod triggers ask" "chmod 755 scripts/test.sh" "dialog"
run_test "NEW-6: chown triggers ask" "chown user scripts/test.sh" "dialog"

# ============================================================
# Section 3: P1 Tests — Logic fixes
# ============================================================
echo ""
echo "--- P1: Logic Fixes ---"

# F-002: Leading flags before subcommand → ask (fail-closed)
run_test "F-002: git with leading flag -C triggers ask" "git -C /tmp status" "dialog"
run_test "F-002: git with leading flag -c triggers ask" "git -c user.name=x commit" "dialog"
run_test "F-002: git status without leading flags → allow" "git status" "allow"

# F-005: vendor/scripts/evil.sh is within PROJECT_DIR
# Phase 6 now auto-approves path-based execution ("/") anywhere in project
run_test "F-005: vendor/scripts path auto-approved (in PROJECT_DIR)" "vendor/scripts/evil.sh" "allow"

# F-009: Subcommand rule matching with correct index separation
run_test "F-009: git stash drop detected" "git stash drop" "dialog"
run_test "F-009: git branch -D detected" "git branch -D feature" "dialog"
run_test "F-009: git tag -d detected" "git tag -d v1.0" "dialog"

# NEW-5: Destructive git operations → ask
run_test "NEW-5: git rebase triggers ask" "git rebase main" "dialog"
run_test "NEW-5: git stash clear triggers ask" "git stash clear" "dialog"
run_test "NEW-5: git filter-branch triggers ask" "git filter-branch --all" "dialog"

# ============================================================
# Section 4: Architecture Tests — deny-by-default
# ============================================================
echo ""
echo "--- Architecture: deny-by-default ---"

# Unknown command (not in known_safe) → ask
run_test "deny-by-default: unknown command triggers ask" "unknowncmd123 foo" "dialog"
run_test "deny-by-default: another unknown triggers ask" "mycustomtool arg1" "dialog"

# known_safe commands → allow (within project)
run_test "known_safe: ls → allow" "ls" "allow"
run_test "known_safe: cat file → allow" "cat README.md" "allow"
run_test "known_safe: grep pattern → allow" "grep hello README.md" "allow"
run_test "known_safe: head file → allow" "head README.md" "allow"
run_test "known_safe: wc file → allow" "wc README.md" "allow"
run_test "known_safe: stat file → allow" "stat README.md" "allow"
run_test "known_safe: diff files → allow" "diff file1.txt file2.txt" "allow"

# ============================================================
# Section 5: Architecture Tests — subcommand_rules (safe enumeration)
# ============================================================
echo ""
echo "--- Architecture: subcommand_rules ---"

# git subcommand allow list
run_test "subcommand_rules: git status → allow" "git status" "allow"
run_test "subcommand_rules: git log → allow" "git log" "allow"
run_test "subcommand_rules: git diff → allow" "git diff" "allow"
run_test "subcommand_rules: git add → allow" "git add file.txt" "allow"
run_test "subcommand_rules: git commit → allow" "git commit" "allow"
run_test "subcommand_rules: git fetch → allow" "git fetch" "allow"
run_test "subcommand_rules: git branch → allow" "git branch" "allow"
run_test "subcommand_rules: git show → allow" "git show" "allow"

# git subcommand ask list
run_test "subcommand_rules: git push → ask" "git push origin main" "dialog"
run_test "subcommand_rules: git pull → ask" "git pull" "dialog"
run_test "subcommand_rules: git merge → ask" "git merge feature" "dialog"
run_test "subcommand_rules: git reset → ask" "git reset HEAD" "dialog"
run_test "subcommand_rules: git clean → ask" "git clean -fd" "dialog"

# git subcommand default (unknown sub) → ask
run_test "subcommand_rules: git unknown-sub → ask" "git xyzunknown" "dialog"

# ============================================================
# Section 6: Architecture Tests — Flag decomposition
# ============================================================
echo ""
echo "--- Architecture: Flag Decomposition ---"

# Compound safe flags → allow
run_test "flag decomp: bash -xeu (all safe) → allow" "bash -xeu scripts/test.sh" "allow"
run_test "flag decomp: bash -x (single safe) → allow" "bash -x scripts/test.sh" "allow"
run_test "flag decomp: python3 -u (safe) → allow" "python3 -u scripts/test.py" "allow"
run_test "flag decomp: python3 -uB (compound safe) → allow" "python3 -uB scripts/test.py" "allow"

# Compound flags with dangerous flag → ask
run_test "flag decomp: bash -xc (has dangerous c) → ask" "bash -xc whoami" "dialog"
run_test "flag decomp: python3 -uc (has dangerous c) → ask" "python3 -uc code" "dialog"

# ============================================================
# Section 7: Architecture Tests — All-arg path candidacy
# ============================================================
echo ""
echo "--- Architecture: All-Arg Path Candidacy ---"

# Relative path without "/" → treated as path candidate, resolves to project dir
run_test "all-arg-path: bare filename in project → allow" "cat somefile.txt" "allow"
run_test "all-arg-path: multiple bare args in project → allow" "diff file1.txt file2.txt" "allow"
run_test "all-arg-path: path outside project → ask" "cat /etc/passwd" "dialog"

# ============================================================
# Section 8: Architecture Tests — Interpreter expansion
# ============================================================
echo ""
echo "--- Architecture: Interpreter Expansion ---"

# node
run_test "interpreter: node -e → ask" "node -e console.log(1)" "dialog"
run_test "interpreter: node script.js in project → allow" "node scripts/test.js" "allow"
run_test "interpreter: node -p → ask" "node -p process.env" "dialog"

# perl
run_test "interpreter: perl -e → ask" "perl -e print(1)" "dialog"
run_test "interpreter: perl script in project → allow" "perl scripts/test.pl" "allow"
run_test "interpreter: perl -w (safe) → allow" "perl -w scripts/test.pl" "allow"

# ruby
run_test "interpreter: ruby -e → ask" "ruby -e puts(1)" "dialog"
run_test "interpreter: ruby script in project → allow" "ruby scripts/test.rb" "allow"

# php
run_test "interpreter: php -r → ask" "php -r phpinfo()" "dialog"
run_test "interpreter: php script in project → allow" "php scripts/test.php" "allow"

# bash safe flags expanded
run_test "interpreter: bash -n (safe) → allow" "bash -n scripts/test.sh" "allow"
run_test "interpreter: bash -v (safe) → allow" "bash -v scripts/test.sh" "allow"

# ============================================================
# Section 9: Remaining fix tests (F-006, F-008, F-013, F-016)
# ============================================================
echo ""
echo "--- Remaining Fixes ---"

# F-006: Symlink path resolution via realpath
# We test that path traversal using .. is resolved correctly
run_test "F-006: traversal in path resolved" "cat scripts/../../../etc/passwd" "dialog"

# F-008: --init-file=value matches --init-file dangerous flag
run_test_raw "F-008: --init-file=value prefix match" \
    '{"tool_name":"Bash","tool_input":{"command":"bash --init-file=/tmp/evil scripts/test.sh"},"hook_event_name":"PermissionRequest"}' \
    "dialog"
run_test_raw "F-008: --rcfile=value prefix match" \
    '{"tool_name":"Bash","tool_input":{"command":"bash --rcfile=/tmp/evil scripts/test.sh"},"hook_event_name":"PermissionRequest"}' \
    "dialog"
run_test_raw "F-008: --eval=code node prefix match" \
    '{"tool_name":"Bash","tool_input":{"command":"node --eval=console.log(1)"},"hook_event_name":"PermissionRequest"}' \
    "dialog"

# F-013: Case-insensitive always_ask
run_test "F-013: SUDO (uppercase) → ask" "SUDO apt update" "dialog"
run_test "F-013: Curl (mixed case) → ask" "Curl http://example.com" "dialog"
run_test "F-013: WGET (uppercase) → ask" "WGET http://example.com" "dialog"
run_test "F-013: RM (uppercase) → ask" "RM file.txt" "dialog"

# F-016: Unicode whitespace in command → reject
# Use raw JSON with Unicode escape sequences
run_test_raw "F-016: non-breaking space (U+00A0) → reject" \
    '{"tool_name":"Bash","tool_input":{"command":"ls\u00a0-la"},"hook_event_name":"PermissionRequest"}' \
    "dialog"
run_test_raw "F-016: em space (U+2003) → reject" \
    '{"tool_name":"Bash","tool_input":{"command":"ls\u2003-la"},"hook_event_name":"PermissionRequest"}' \
    "dialog"
run_test_raw "F-016: ideographic space (U+3000) → reject" \
    '{"tool_name":"Bash","tool_input":{"command":"ls\u3000-la"},"hook_event_name":"PermissionRequest"}' \
    "dialog"

# ============================================================
# Section 10: Phase 6/7 拡大テスト + セキュリティ境界
# ============================================================
echo ""
echo "--- Phase 6/7 Expanded Scope & Security Boundary ---"

# Phase 6 拡大: インタプリタ + プロジェクト内任意パス → allow (scripts/外でもOK)
run_test "Phase6-expand: python3 src/app.py → allow" "python3 src/app.py" "allow"
run_test "Phase6-expand: bash src/tool.sh → allow" "bash src/tool.sh" "allow"
run_test "Phase6-expand: node src/index.js → allow" "node src/index.js" "allow"

# Phase 6 拡大: インタプリタ + プロジェクト外 → dialog
run_test "Phase6-expand: python3 /tmp/outside.py → dialog" "python3 /tmp/outside.py" "dialog"

# Phase 7 拡大: パスベース直接実行 + プロジェクト内 → allow (scripts/外でもOK)
run_test "Phase7-expand: src/tool.sh direct exec → allow" "src/tool.sh" "allow"
run_test "Phase7-expand: vendor/scripts/evil.sh direct exec → allow" "vendor/scripts/evil.sh" "allow"

# Phase 7 拡大: パスベース直接実行 + プロジェクト外 → dialog
run_test "Phase7-expand: /tmp/outside.sh → dialog" "/tmp/outside.sh" "dialog"
run_test "Phase7-expand: /usr/local/bin/evil → dialog" "/usr/local/bin/evil" "dialog"

# セキュリティ境界: インタプリタ + プロジェクト外 → dialog
run_test "security-boundary: bash /etc/evil.sh → dialog" "bash /etc/evil.sh" "dialog"
run_test "security-boundary: node /tmp/evil.js → dialog" "node /tmp/evil.js" "dialog"
run_test "security-boundary: python3 /var/tmp/hack.py → dialog" "python3 /var/tmp/hack.py" "dialog"

# エッジケース: ./path は "/" を含むのでパスベース実行として Phase 6 で処理
run_test "edge: ./scripts/setup.sh direct exec → allow" "./scripts/setup.sh" "allow"

echo ""
echo "=== Results ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"
[ "$FAIL" -eq 0 ] && echo "All tests passed!" || echo "Some tests failed."
exit "$FAIL"
