"""
pg.fallback -- Bash command permission hook.

Automatically approves PROJECT_DIR-scoped execution (+ allowed_dirs_extra) with validation.
Uses tree-sitter-bash for proper shell AST parsing.
"""

import sys
import json
import re
import os

from pg.config import load_config, get_audit_log_path
from pg.parser import parse_command, ParseResult
from pg.path_check import detect_project_dir, canonicalize_path, is_path_within


class RejectException(Exception):
    def __init__(self, reason):
        self.reason = reason


# --- Configuration ---
PROJECT_DIR = detect_project_dir()
DEBUG = os.getenv("PERMISSION_DEBUG", "0") == "1"


def reject(reason="unknown"):
    raise RejectException(reason)


NEVER_SAFE = {"sudo", "su"}


def phase_s0_null_byte_check(input_str, command):
    """Phase S0: Reject null bytes and empty commands."""
    if '\x00' in input_str:
        reject("S0:null_byte")
    if '\\u0000' in input_str:
        reject("S0:json_null")
    if not command:
        reject("S0:empty_command")


def phase_1_sanitize(input_data, command):
    """Phase 1: Control chars, tool_name validation, Unicode whitespace."""
    if re.search(r'[\x00-\x08\x0b-\x1f\x7f]', command):
        reject("S1:control_chars")

    if re.search(r'[\u0085\u00a0\u2000-\u200b\u2028\u2029\u202f\u205f\u3000\ufeff]', command):
        reject("S1:unicode_whitespace")

    tool_name = input_data.get("tool_name", "")
    if tool_name != "Bash":
        reject("S2:tool_name")


def phase_5_normalize_path(script_path):
    """Phase 5: Resolve to absolute path and check project containment."""
    if not script_path:
        reject("P4:no_script_path")

    if script_path.startswith('/'):
        abs_path = canonicalize_path(script_path)
    else:
        abs_path = canonicalize_path(os.path.join(PROJECT_DIR, script_path))

    if not abs_path:
        reject("P5:empty_abs_path")

    project_prefix = PROJECT_DIR + "/"
    if abs_path != PROJECT_DIR and not abs_path.startswith(project_prefix):
        reject("P5:path_traversal_escape")

    return abs_path


# --- Command validation ---

def validate_single_command_words(words, config):
    """Validate a single command given its word list (from tree-sitter-bash AST).

    Returns: ("allow"|"ask"|"reject", reason)
    """
    if not words:
        return ("reject", "empty_segment")

    cmd_name = words[0]
    cmd_basename = os.path.basename(cmd_name)

    # NEVER_SAFE hardcoded
    if cmd_basename in NEVER_SAFE:
        return ("ask", f"never_safe:{cmd_basename}")

    # Project-contained command path -> auto-allow
    if '/' in cmd_name:
        if cmd_name.startswith('/'):
            abs_cmd = os.path.normpath(cmd_name)
        else:
            abs_cmd = os.path.normpath(os.path.join(PROJECT_DIR, cmd_name))
        norm_project = os.path.normpath(PROJECT_DIR)
        if abs_cmd == norm_project or abs_cmd.startswith(norm_project + "/"):
            return ("allow", f"project_contained_cmd:{cmd_basename}")
        for extra_dir in config.get("allowed_dirs_extra", []):
            if not extra_dir:
                continue
            norm_extra = os.path.normpath(extra_dir)
            if abs_cmd == norm_extra or abs_cmd.startswith(norm_extra + "/"):
                return ("allow", f"project_contained_cmd:{cmd_basename}")

    tools = config.get("tools", {})
    tool_entry = tools.get(cmd_basename)

    if tool_entry is None:
        return ("ask", f"unknown_command:{cmd_basename}")

    if isinstance(tool_entry, str):
        return (tool_entry, f"tools:{cmd_basename}")

    # Complex entry (map)
    # 1. dangerous_flags check
    dangerous_flags = tool_entry.get("dangerous_flags", [])
    for word in words[1:]:
        if word in dangerous_flags:
            return ("ask", f"dangerous_flag:{cmd_basename}:{word}")
        if word.startswith("-") and not word.startswith("--") and len(word) > 2:
            for ch in word[1:]:
                if f"-{ch}" in dangerous_flags:
                    return ("ask", f"dangerous_flag:{cmd_basename}:-{ch}")

    # 2. allow subcommand check (evaluated before ask)
    allow_subs = tool_entry.get("allow", [])
    subcommands = [w for w in words[1:] if not w.startswith("-")]
    for allow_sub in allow_subs:
        allow_parts = allow_sub.split()
        if len(allow_parts) == 1:
            if subcommands and subcommands[0] == allow_parts[0]:
                return ("allow", f"allow_subcommand:{cmd_basename}:{allow_sub}")
        elif len(allow_parts) == 2:
            if (len(subcommands) >= 2
                    and subcommands[0] == allow_parts[0]
                    and subcommands[1] == allow_parts[1]):
                return ("allow", f"allow_subcommand:{cmd_basename}:{allow_sub}")

    # 3. ask subcommand check
    ask_subs = tool_entry.get("ask", [])
    for ask_sub in ask_subs:
        ask_parts = ask_sub.split()
        if len(ask_parts) == 1:
            if subcommands and subcommands[0] == ask_parts[0]:
                return ("ask", f"ask_subcommand:{cmd_basename}:{ask_sub}")
        elif len(ask_parts) == 2:
            if (len(subcommands) >= 2
                    and subcommands[0] == ask_parts[0]
                    and subcommands[1] == ask_parts[1]):
                return ("ask", f"ask_subcommand:{cmd_basename}:{ask_sub}")

    # 4. default
    default_action = tool_entry.get("default", "ask")
    return (default_action, f"tools_default:{cmd_basename}")


def validate_parsed_result(parsed, config):
    """Validate a parsed command result against config.

    Checks:
    1. Dangerous AST nodes (from tree-sitter-bash)
    2. Dangerous pipe targets (config-based)
    3. Each command segment against tools config
    4. Redirect paths for project containment
    """
    # 1. Dangerous nodes from AST (variable expansion, cmd substitution, etc.)
    #    Decision is driven by phase_policy config (defaults: all=ask).
    #    Evaluate ALL nodes; most restrictive policy wins (deny > ask > allow).
    phase_policy = config.get("phase_policy", {})
    if parsed.dangerous_nodes:
        worst_decision = "allow"
        worst_node = parsed.dangerous_nodes[0]
        for node in parsed.dangerous_nodes:
            phase_key = node.split(":", 1)[1] if ":" in node else node
            policy = phase_policy.get(phase_key, "ask")
            if policy == "deny":
                return ("deny", node)
            elif policy == "ask" and worst_decision != "deny":
                worst_decision = "ask"
                worst_node = node
        if worst_decision != "allow":
            return (worst_decision, worst_node)
        # All nodes are "allow" → fall through to tools/pipes/redirects validation

    results = []

    # 2. Dangerous pipe targets
    if parsed.pipe_commands:
        pipe_deny_right = config.get("pipe_deny_right", [])
        for pipe_group in parsed.pipe_commands:
            # Check all non-first commands in each pipe group
            for cmd_info in pipe_group[1:]:
                if cmd_info.words:
                    basename = os.path.basename(cmd_info.words[0])
                    if basename in pipe_deny_right:
                        return ("reject", f"dangerous_pipe_target:{basename}")

    # 3. Validate each command segment
    for cmd_info in parsed.commands:
        decision, reason = validate_single_command_words(cmd_info.words, config)
        results.append((decision, reason))

    # 4. Validate redirect paths
    for redir in parsed.redirects:
        if redir.fd_dup:
            results.append(("allow", "redirect:fd_dup"))
            continue
        if redir.path == "/dev/null":
            results.append(("allow", "redirect:/dev/null"))
            continue
        if redir.path:
            try:
                phase_5_normalize_path(redir.path)
                results.append(("allow", "redirect:project_contained"))
            except (RejectException, Exception):
                results.append(("reject", f"redirect:outside_project:{redir.path}"))

    if not results:
        return ("reject", "no_segments")

    # Any reject/ask -> return the first one
    non_allows = [(d, r) for d, r in results if d != "allow"]
    if non_allows:
        return non_allows[0]

    reasons = [r for _, r in results]
    if parsed.is_compound:
        return ("allow", f"compound:{'+'.join(reasons)}")
    return ("allow", reasons[0] if reasons else "allowed")


# --- Audit & Output ---

def _write_audit_log(decision, reason, command=""):
    """Write a single JSONL line to the audit log."""
    if os.environ.get("PG_NO_AUDIT") == "1":
        return
    try:
        audit_path = get_audit_log_path()
        if not audit_path:
            return
        import datetime
        log_entry = json.dumps({
            "ts": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "decision": decision,
            "command": command,
            "phase": reason.split(":")[0] if ":" in reason else reason,
            "reason": reason
        })
        os.makedirs(os.path.dirname(audit_path), exist_ok=True)
        with open(audit_path, "a") as f:
            f.write(log_entry + "\n")
    except Exception:
        pass


def _output(decision, reason, command=""):
    """Output hook decision JSON, write audit log, and exit."""
    if DEBUG and decision != "allow":
        print(f"{decision.upper()}[{reason}]", file=sys.stderr)
    _write_audit_log(decision, reason, command)
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": decision,
            "permissionDecisionReason": reason
        }
    }))
    sys.exit(0)


def main():
    """Main entry point."""
    input_str = sys.stdin.read()
    try:
        config = load_config()
    except RejectException as e:
        _output("deny", e.reason)
        return

    try:
        input_data = json.loads(input_str)
    except json.JSONDecodeError:
        _output("deny", "json_parse_error")
        return

    command = input_data.get("tool_input", {}).get("command", "")

    # Pre-parse validation (before tree-sitter)
    try:
        phase_s0_null_byte_check(input_str, command)
        phase_1_sanitize(input_data, command)
    except RejectException as e:
        _output("deny", e.reason, command)
        return

    # Strip bash line continuations (backslash + newline -> join lines)
    command = command.replace('\\\n', '')

    # Parse with tree-sitter-bash
    parsed = parse_command(command)

    if parsed is None:
        _output("ask", "parse_failure", command)
        return

    # Validate parsed result against config
    decision, reason = validate_parsed_result(parsed, config)
    _output(decision, reason, command)


if __name__ == "__main__":
    main()
