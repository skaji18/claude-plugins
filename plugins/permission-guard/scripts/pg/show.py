"""pg.show -- Display effective permission-guard config with 3-tier source attribution.

Source tags:
  [D] = defaults (plugin built-in)
  [G] = global   (~/.claude/permission-guard.yaml)
  [P] = project  (<project>/.claude/permission-guard.yaml)
"""

import os
import sys

from pg.config import load_defaults, load_global_config, load_project_config, merge_config, get_audit_log_path


def normalize_tools_add(cfg):
    ta = cfg.get("tools_add", {})
    if isinstance(ta, list):
        flat = {}
        for item in ta:
            if isinstance(item, dict):
                flat.update(item)
        return flat
    return ta


def main():
    defaults = load_defaults()
    global_cfg = load_global_config()
    project_cfg = load_project_config()

    intermediate = merge_config(defaults, global_cfg)
    effective = merge_config(intermediate, project_cfg)

    default_tools = defaults.get("tools", {})
    global_adds = normalize_tools_add(global_cfg)
    global_removes = set(global_cfg.get("tools_remove", []))
    project_adds = normalize_tools_add(project_cfg)
    project_removes = set(project_cfg.get("tools_remove", []))

    # --- Config sources ---
    plugin_root = os.environ.get("CLAUDE_PLUGIN_ROOT", "")
    if not plugin_root:
        # pg/ package is at scripts/pg/, so plugin root is two levels up
        plugin_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    defaults_path = os.path.join(plugin_root, "config", "defaults.yaml")
    home = os.path.expanduser("~")
    global_path = os.path.join(home, ".claude", "permission-guard.yaml")
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", "")
    project_path = (
        os.path.join(project_dir, ".claude", "permission-guard.yaml")
        if project_dir
        else "(CLAUDE_PROJECT_DIR not set)"
    )

    print("Effective permission-guard config")
    print()
    print("== config sources ==")
    print(f"  [D] {defaults_path}")
    g_exists = os.path.exists(global_path)
    g_n = len(global_adds) + len(global_removes)
    g_status = f"({g_n} overrides)" if g_exists else "(not found)"
    print(f"  [G] {global_path}  {g_status}")
    p_exists = project_dir and os.path.exists(project_path)
    p_n = len(project_adds) + len(project_removes)
    p_status = f"({p_n} overrides)" if p_exists else "(not found)"
    print(f"  [P] {project_path}  {p_status}")

    # --- Helpers ---
    def tool_source(name):
        if name in project_adds:
            return "P"
        if name in global_adds:
            return "G"
        return "D"

    # Classify effective tools
    simple_allow = {}  # source -> [names]
    simple_ask = {}
    rule_tools = []

    for name, val in sorted(effective.get("tools", {}).items()):
        src = tool_source(name)
        if isinstance(val, str):
            bucket = simple_allow if val == "allow" else simple_ask
            bucket.setdefault(src, []).append(name)
        else:
            rule_tools.append((name, val))

    # --- Tools (allow) ---
    print()
    print("== tools (allow) ==")
    for src in ["D", "G", "P"]:
        names = simple_allow.get(src, [])
        if names:
            print(f"  [{src}] {', '.join(sorted(names))}")

    # --- Tools (ask) ---
    print()
    print("== tools (ask) ==")
    for src in ["D", "G", "P"]:
        names = simple_ask.get(src, [])
        if names:
            print(f"  [{src}] {', '.join(sorted(names))}")

    # --- Removed ---
    all_removes = global_removes | project_removes
    if all_removes:
        print()
        print("== tools (removed) ==")
        for name in sorted(all_removes):
            src = "P" if name in project_removes else "G"
            print(f"  [{src}] {name}")

    # --- Rules ---
    print()
    print("== tools (rules) ==")
    for name, entry in rule_tools:
        print(f"  {name}:")

        # Per-layer raw entries for attribution
        d_entry = default_tools.get(name, {})
        if isinstance(d_entry, str):
            d_entry = {"default": d_entry}
        g_entry = global_adds.get(name, {})
        if isinstance(g_entry, str):
            g_entry = {"default": g_entry}
        p_entry = project_adds.get(name, {})
        if isinstance(p_entry, str):
            p_entry = {"default": p_entry}

        # Union keys (allow, ask, dangerous_flags)
        for key in ["allow", "ask", "dangerous_flags"]:
            vals = entry.get(key, [])
            if not vals:
                continue
            label = "flags" if key == "dangerous_flags" else key
            d_vals = set(d_entry.get(key, []))
            g_vals = set(g_entry.get(key, []))
            p_vals = set(p_entry.get(key, []))

            from_d = sorted(v for v in vals if v in d_vals)
            from_g = sorted(v for v in vals if v in g_vals and v not in d_vals)
            from_p = sorted(v for v in vals if v in p_vals and v not in d_vals and v not in g_vals)

            sources = []
            if from_d:
                sources.append("D")
            if from_g:
                sources.append("G")
            if from_p:
                sources.append("P")
            src_tag = "[" + "+".join(sources) + "]"

            if len(sources) <= 1:
                # All from one source
                print(f"    {label} = [{', '.join(vals)}]  {src_tag}")
            else:
                # Mixed: annotate non-default values
                annotated = []
                for v in vals:
                    if v in from_p:
                        annotated.append(f"{v} [P]")
                    elif v in from_g:
                        annotated.append(f"{v} [G]")
                    else:
                        annotated.append(v)
                print(f"    {label} = [{', '.join(annotated)}]  {src_tag}")

        # default key
        default_val = entry.get("default", "ask")
        if "default" in p_entry:
            d_src = "P"
        elif "default" in g_entry:
            d_src = "G"
        else:
            d_src = "D"
        print(f"    default = {default_val}  [{d_src}]")

    # --- pipe_deny_right ---
    print()
    print("== pipe_deny_right ==")
    default_pipes = set(defaults.get("pipe_deny_right", []))
    effective_pipes = sorted(effective.get("pipe_deny_right", []))
    global_pipe_add = set(global_cfg.get("pipe_deny_right_add", []))
    project_pipe_add = set(project_cfg.get("pipe_deny_right_add", []))

    from_d = sorted(p for p in effective_pipes if p in default_pipes)
    from_g = sorted(
        p for p in effective_pipes if p in global_pipe_add and p not in default_pipes
    )
    from_p = sorted(
        p
        for p in effective_pipes
        if p in project_pipe_add and p not in default_pipes and p not in global_pipe_add
    )

    if from_d:
        print(f"  [D] {', '.join(from_d)}")
    if from_g:
        print(f"  [G] {', '.join(from_g)}")
    if from_p:
        print(f"  [P] {', '.join(from_p)}")

    # --- Other ---
    print()
    print("== other ==")

    # allowed_dirs_extra (last non-empty layer wins entirely)
    dirs = effective.get("allowed_dirs_extra", [])
    delta_dirs_p = project_cfg.get("allowed_dirs_extra", [])
    delta_dirs_g = global_cfg.get("allowed_dirs_extra", [])
    if dirs:
        if delta_dirs_p:
            d_src = "P"
        elif delta_dirs_g:
            d_src = "G"
        else:
            d_src = "D"
        print(f"  allowed_dirs_extra:  [{d_src}]")
        for d in dirs:
            print(f"    {d}")
    else:
        print("  allowed_dirs_extra: (none)")

    # audit_log_path
    audit = get_audit_log_path()
    delta_audit_p = project_cfg.get("audit_log_path", "")
    delta_audit_g = global_cfg.get("audit_log_path", "")
    if audit:
        if delta_audit_p:
            a_src = "P"
        elif delta_audit_g:
            a_src = "G"
        else:
            a_src = "D"
        print(f"  audit_log: {audit}  [{a_src}]")
    else:
        print("  audit_log: (none)")


if __name__ == "__main__":
    main()
