> Japanese version / 日本語版 → [README.ja.md](README.ja.md)

# permission-guard

8-phase Bash command validation hook for [Claude Code](https://claude.com/claude-code). Auto-approves safe commands in `scripts/` and `.claude/hooks/`, blocks shell injection, path traversal, and dangerous patterns.

## Overview

When Claude Code requests permission to run a Bash command, this plugin intercepts the request via a `PreToolUse` hook and runs it through an 8-phase validation pipeline. Safe commands (project scripts, read-only file operations within the project) are auto-approved. Dangerous patterns (shell injection, path traversal, destructive operations) trigger the standard permission dialog.

The goal is to reduce permission fatigue for routine operations while maintaining strong security boundaries.

## Validation Phases

| Phase | Name | Description |
|-------|------|-------------|
| S0 | Null byte check | Reject null bytes and empty commands |
| 1 | Sanitize | Control character rejection, tool_name validation |
| 1.5 | Strip safe suffixes | Remove safe trailing patterns (`2>&1`, `\|\| true`, etc.) |
| 2 | Shell syntax | Reject dangerous operators: `;`, `\|`, `&`, `` ` ``, `$()`, redirections, globs |
| 3 | Parse command | Split into words, identify interpreter vs. direct execution |
| 4 | Normalize flags | Classify interpreter flags as safe/dangerous |
| 5 | Normalize path | Resolve to absolute path, check project containment |
| 6 | Project containment | Auto-approve if command path resolves within project or `allowed_dirs_extra` |
| 7 | General command | Tool lookup (allow/ask/rules), subcommand matching, path containment for all arguments |

## Installation

```bash
/plugin install permission-guard@skaji18-plugins
```

After installation, run the setup skill to create a venv, install dependencies, and generate your user config template:

```bash
/permission-guard:setup
```

## Configuration

### 2-Layer Config Merge

The plugin uses a 2-layer configuration merge:

| Layer | Source | Purpose |
|-------|--------|---------|
| 1 | `config/defaults.yaml` (plugin defaults) | Base rules for all tools |
| 2 | `.claude/permission-guard.yaml` (user overrides) | Project-specific additions/removals |

### Plugin Defaults (`config/defaults.yaml`)

The `tools` key uses a unified structure with three value types:

**Simple entries** — a single string: `"allow"` or `"ask"`

```yaml
tools:
  ls: "allow"     # always auto-approved
  rm: "ask"       # always triggers dialog
```

**Rule entries** — a map for tools that need subcommand-level control:

```yaml
tools:
  git:
    ask: ["push", "clean", "filter-branch", "rebase", "reset"]
    dangerous_flags: ["--force", "-f", "--hard", "-D", "--no-verify"]
    default: "allow"
```

**`pipe_deny_right`** — commands that are always blocked when appearing as the right side of a pipe:

```yaml
pipe_deny_right:
  - bash
  - sh
  - python
  - node
  # ...
```

### User Overrides (`.claude/permission-guard.yaml`)

Created automatically by `/permission-guard:setup`. Supports the following keys:

| Key | Type | Description |
|-----|------|-------------|
| `tools_add` | map | Add tools (simple or rule entries) on top of defaults |
| `tools_remove` | array | Remove tool names from the defaults |
| `pipe_deny_right_add` | array | Add entries to the `pipe_deny_right` list |
| `allowed_dirs_extra` | array | Additional directories outside the project to allow |
| `audit_log_path` | string | Override the decision log path (default: `logs/decisions.jsonl`) |

Example:

```yaml
tools_add:
  bun: "allow"
  terraform:
    ask: ["destroy", "apply"]
    default: "ask"
tools_remove:
  - tee
pipe_deny_right_add:
  - lua
allowed_dirs_extra: []
audit_log_path: ""
```

## Commands

| Command | Description |
|---------|-------------|
| `/permission-guard:setup` | Create venv, install deps, generate user config template, and run tests |
| `/permission-guard:show` | Display effective config (defaults merged with user overrides, with diff markers) |
| `/permission-guard:optimize` | Analyze decision log and suggest config changes to reduce unnecessary prompts |
| `/permission-guard:permission-test` | Run the validation test suite to verify hook functionality |

## Dependencies

| Tool | Required | Purpose |
|------|----------|---------|
| Python 3 | Yes | Hook script runtime |
| PyYAML | Required | Config file loading |

## Plugin Structure

```
plugins/permission-guard/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata (name, version, author)
├── hooks/
│   └── hooks.json           # PreToolUse hook definition
├── scripts/
│   ├── permission-fallback  # Main hook script (8-phase validator)
│   └── test-permission.sh   # Validation test suite
├── config/
│   └── defaults.yaml        # Default tool rules (allow/ask/rules structure)
├── commands/
│   ├── setup.md             # /permission-guard:setup skill
│   ├── show.md              # /permission-guard:show skill
│   ├── optimize.md          # /permission-guard:optimize skill
│   └── permission-test.md   # /permission-guard:permission-test skill
├── docs/
│   └── DESIGN.md            # Architecture and design notes
├── logs/                    # Decision audit log (auto-created)
├── README.md                # This file (English)
├── README.ja.md             # Japanese version
└── CHANGELOG.md             # Version history
```

## License

[MIT](../../LICENSE)
