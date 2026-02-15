> Japanese version / 日本語版 → [README.ja.md](README.ja.md)

# permission-guard

8-phase Bash command validation hook for [Claude Code](https://claude.com/claude-code). Auto-approves safe commands in `scripts/` and `.claude/hooks/`, blocks shell injection, path traversal, and dangerous patterns.

## Overview

When Claude Code requests permission to run a Bash command, this plugin intercepts the request and runs it through an 8-phase validation pipeline. Safe commands (project scripts, read-only file operations within the project) are auto-approved. Dangerous patterns (shell injection, path traversal, destructive operations) trigger the standard permission dialog.

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
| 6 | Scripts/hooks check | Auto-approve if path is in `scripts/` or `.claude/hooks/` |
| 7 | General command | ALWAYS_ASK list, subcommand rules, path containment for all arguments |

## Installation

```bash
/plugin install permission-guard@skaji18-plugins
```

Or verify dependencies manually:

```bash
bash scripts/setup.sh
```

## Configuration

### 4-Layer Config Merge

The plugin uses a 4-layer configuration merge strategy:

| Layer | Source | Priority |
|-------|--------|----------|
| 0 | Hardcoded defaults (in script) | Lowest |
| 1 | Plugin config (`config/permission-config.yaml`) | |
| 2 | Project config (`.claude/permission-config.yaml`) | |
| 3 | Local overlay (`local/hooks/permission-config.yaml`) | Highest |

### Customizable Keys

| Key | Type | Merge Strategy | Description |
|-----|------|----------------|-------------|
| `always_ask` | array | Union (append-only) | Commands that always trigger the permission dialog |
| `subcommand_ask` | array | Union (append-only) | Subcommand patterns that trigger dialog (e.g., `git:push`) |
| `allowed_dirs_extra` | array | Union (append-only) | Additional directories outside the project to allow access |

### Security Floors

These items can never be removed from `always_ask`, regardless of config overrides:

- `sudo`, `su`, `rm`, `rmdir`

These subcommand rules can never be removed from `subcommand_ask`:

- `git:push`, `git:reset:--hard`, `gh:pr:merge`

### Frozen Keys

The `interpreters` configuration key is frozen and cannot be overridden by project or local configs. This prevents malicious projects from whitelisting dangerous interpreter flags.

## Testing

Run the built-in test suite:

```bash
/permission-guard:permission-test
```

Or run directly:

```bash
bash scripts/test-permission.sh
```

## Dependencies

| Tool | Required | Purpose |
|------|----------|---------|
| Python 3 | Yes | Hook script runtime |
| PyYAML | Optional | Config file loading (falls back to hardcoded defaults) |

## Plugin Structure

```
plugins/permission-guard/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata (name, version, author)
├── hooks/
│   └── hooks.json           # PermissionRequest hook definition
├── scripts/
│   ├── permission-fallback  # Main hook script (8-phase validator)
│   ├── test-permission.sh   # Quick validation test suite
│   └── setup.sh             # Dependency verification
├── config/
│   └── permission-config.yaml  # Default configuration
├── commands/
│   └── permission-test.md   # /permission-guard:permission-test command
├── README.md                # This file (English)
├── README.ja.md             # Japanese version
└── CHANGELOG.md             # Version history
```

## License

[MIT](../../LICENSE)
