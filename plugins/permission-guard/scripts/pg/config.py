"""
pg.config -- 3-layer configuration loader for permission-guard

Layer order (later overrides earlier):
  1. defaults: config/defaults.yaml (plugin built-in)
  2. global:   HOME/.claude/permission-guard.yaml (user-wide)
  3. project:  CLAUDE_PROJECT_DIR/.claude/permission-guard.yaml (per-project)

Each layer uses delta merging (tools_add, tools_remove, pipe_deny_right_add, etc.)
"""

import os
from pathlib import Path

import yaml


def load_defaults():
    """Load plugin defaults.yaml."""
    plugin_root = os.environ.get("CLAUDE_PLUGIN_ROOT", "")
    if not plugin_root:
        # pg/ package is at scripts/pg/, so plugin root is two levels up
        plugin_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    defaults_path = os.path.join(plugin_root, "config", "defaults.yaml")
    if os.path.exists(defaults_path):
        with open(defaults_path) as f:
            return yaml.safe_load(f) or dict()
    return dict()


def load_global_config():
    """Load global config from HOME/.claude/permission-guard.yaml.

    Returns empty dict if the file does not exist.
    """
    home = Path.home()
    global_config_path = home / ".claude" / "permission-guard.yaml"
    if global_config_path.exists():
        with open(global_config_path) as f:
            return yaml.safe_load(f) or dict()
    return dict()


def load_project_config():
    """Load project config from CLAUDE_PROJECT_DIR/.claude/permission-guard.yaml.

    Returns empty dict if CLAUDE_PROJECT_DIR is unset or the file does not exist.
    """
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", "")
    if not project_dir:
        return dict()
    project_config_path = os.path.join(project_dir, ".claude", "permission-guard.yaml")
    if os.path.exists(project_config_path):
        with open(project_config_path) as f:
            return yaml.safe_load(f) or dict()
    return dict()


def normalize_tools_add(raw):
    """Normalize tools_add from either dict or list-of-dicts format to a flat dict.

    YAML allows both formats:
      tools_add: {bun: "allow"}        # dict format
      tools_add: [{bun: "allow"}]      # list-of-dicts format
    """
    if isinstance(raw, list):
        flat = dict()
        for item in raw:
            if isinstance(item, dict):
                flat.update(item)
        return flat
    return raw if isinstance(raw, dict) else dict()


def merge_config(base, delta):
    """Merge base config + delta additions - delta removals.

    Delta keys:
      - tools_add: dict of tool entries to add/merge
      - tools_remove: list of tool names to remove
      - pipe_deny_right_add: list of commands to add to pipe_deny_right
      - allowed_dirs_extra: overrides base value if present
      - audit_log_path: overrides base value if present
    """
    effective_tools = dict(base.get("tools", dict()))

    tools_add = normalize_tools_add(delta.get("tools_add", dict()))
    for name, val in tools_add.items():
        if isinstance(val, str):
            effective_tools[name] = val
        else:
            existing = effective_tools.get(name, dict())
            if isinstance(existing, str):
                existing = dict(default=existing)
            for k, v in val.items():
                if k in ("ask", "dangerous_flags", "allow") and k in existing:
                    existing[k] = list(set(existing[k]) | set(v))
                else:
                    existing[k] = v
            effective_tools[name] = existing

    # tools_remove
    for name in delta.get("tools_remove", list()):
        effective_tools.pop(name, None)

    # pipe_deny_right
    effective_pipe = list(set(
        base.get("pipe_deny_right", list())
        + delta.get("pipe_deny_right_add", list())
    ))

    result = dict()
    result["tools"] = effective_tools
    result["pipe_deny_right"] = effective_pipe
    # allowed_dirs_extra: use delta only if non-empty, otherwise inherit base
    # This prevents an empty template (allowed_dirs_extra: []) from wiping global values
    delta_dirs = delta.get("allowed_dirs_extra", list())
    result["allowed_dirs_extra"] = delta_dirs if delta_dirs else base.get("allowed_dirs_extra", list())
    # audit_log_path: use delta only if non-empty
    delta_audit = delta.get("audit_log_path", "")
    result["audit_log_path"] = delta_audit if delta_audit else base.get("audit_log_path", "")
    # file_access_outside_project: use delta only if non-empty
    delta_fao = delta.get("file_access_outside_project", "")
    result["file_access_outside_project"] = delta_fao if delta_fao else base.get("file_access_outside_project", "ask")
    # phase_policy: shallow dict merge (delta keys override base keys)
    base_pp = dict(base.get("phase_policy", {}))
    base_pp.update({k: v for k, v in delta.get("phase_policy", {}).items() if v})
    result["phase_policy"] = base_pp
    return result


def load_config():
    """Load effective config: defaults -> global -> project (3-layer chain merge)."""
    defaults = load_defaults()
    global_cfg = load_global_config()
    project_cfg = load_project_config()

    # Chain merge: defaults + global delta -> intermediate + project delta
    intermediate = merge_config(defaults, global_cfg)
    effective = merge_config(intermediate, project_cfg)
    return effective


def get_audit_log_path():
    """Get effective audit log path (write target) from merged config."""
    config = load_config()
    audit_path = config.get("audit_log_path", "")
    if audit_path:
        return os.path.expanduser(audit_path)
    return None


def get_all_audit_log_paths():
    """Get all unique audit log paths across config layers (for reading/analysis).

    Returns paths from defaults, global, and project configs.
    Useful when the user changed paths over time and old logs remain at previous locations.
    """
    paths = []
    for loader in (load_defaults, load_global_config, load_project_config):
        cfg = loader()
        p = cfg.get("audit_log_path", "")
        if p:
            expanded = os.path.expanduser(p)
            if expanded not in paths:
                paths.append(expanded)
    return paths
