"""
gavel.file_guard -- file access guard hook for Read/Write/Edit/Glob/Grep.

Checks that file_path (or path) stays within PROJECT_DIR or allowed_dirs_extra.
Outside paths always produce "ask".
"""

import sys
import json

from gavel.config import load_config
from gavel.path_check import detect_project_dir, check_path_containment


def _output(decision, reason):
    """Output hook decision JSON and exit."""
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": decision,
            "permissionDecisionReason": reason
        }
    }))
    sys.exit(0)


def main():
    input_str = sys.stdin.read()
    try:
        input_data = json.loads(input_str)
    except json.JSONDecodeError:
        _output("ask", "file_guard:json_parse_error")
        return

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    # Extract path
    if tool_name in ("Read", "Write", "Edit"):
        file_path = tool_input.get("file_path", "")
    elif tool_name in ("Glob", "Grep"):
        file_path = tool_input.get("path", "")
        if not file_path:
            # path is optional for Glob/Grep; omitted means cwd → allow
            _output("allow", f"file_guard:{tool_name}:default_cwd")
            return
    else:
        _output("allow", f"file_guard:unknown_tool:{tool_name}")
        return

    if not file_path:
        _output("ask", f"file_guard:{tool_name}:empty_path")
        return

    # Normalize and check containment
    config = load_config()
    project_dir = detect_project_dir()
    allowed_dirs = config.get("allowed_dirs_extra", [])

    contained, resolved = check_path_containment(file_path, project_dir, allowed_dirs)

    if contained:
        _output("allow", f"file_guard:{tool_name}:project_contained")
    else:
        _output("ask", f"file_guard:{tool_name}:outside_project:{resolved}")
