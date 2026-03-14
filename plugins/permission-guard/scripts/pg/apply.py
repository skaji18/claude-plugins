"""pg.apply -- Merge proposed tools_add entries into a permission-guard config file."""

import argparse
import json
import os
import sys

import yaml

from pg.config import normalize_tools_add


def main():
    parser = argparse.ArgumentParser(description="Apply optimization proposals to permission-guard config")
    parser.add_argument("--target", required=True, choices=["global", "project"],
                        help="Config layer to write to")
    parser.add_argument("--proposals", required=True,
                        help="JSON string of tools_add entries to merge")
    args = parser.parse_args()

    # Resolve target path
    if args.target == "global":
        home = os.path.expanduser("~")
        config_path = os.path.join(home, ".claude", "permission-guard.yaml")
    else:
        project_dir = os.environ.get("CLAUDE_PROJECT_DIR", "")
        if not project_dir:
            print("Error: CLAUDE_PROJECT_DIR not set", file=sys.stderr)
            sys.exit(1)
        config_path = os.path.join(project_dir, ".claude", "permission-guard.yaml")

    # Parse proposals
    try:
        proposals = json.loads(args.proposals)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in --proposals: {e}", file=sys.stderr)
        sys.exit(1)

    # Read existing config
    if os.path.exists(config_path):
        with open(config_path) as f:
            config = yaml.safe_load(f) or {}
    else:
        config = {}

    # Ensure tools_add exists as dict
    tools_add = normalize_tools_add(config.get("tools_add", {}))

    # Merge proposals (don't overwrite existing entries)
    added = []
    skipped = []
    for name, val in proposals.items():
        if name in tools_add:
            skipped.append(name)
        else:
            tools_add[name] = val
            added.append(name)

    config["tools_add"] = tools_add

    # Ensure other keys exist
    config.setdefault("tools_remove", [])
    config.setdefault("pipe_deny_right_add", [])
    config.setdefault("allowed_dirs_extra", [])
    config.setdefault("audit_log_path", "")

    # Write back
    os.makedirs(os.path.dirname(config_path), exist_ok=True)

    # Add header comment
    if args.target == "global":
        header = "# permission-guard GLOBAL config\n# Applies to ALL projects. Project config overrides these settings.\n"
    else:
        header = "# permission-guard PROJECT config\n# Applies to THIS project only. Overrides global config.\n"

    with open(config_path, "w") as f:
        f.write(header)
        yaml.dump(config, f, default_flow_style=False, allow_unicode=True, sort_keys=False)

    # Report
    if added:
        print(f"Added to {args.target} config: {', '.join(added)}")
    if skipped:
        print(f"Skipped (already exists): {', '.join(skipped)}")
    print(f"Config file: {config_path}")


if __name__ == "__main__":
    main()
