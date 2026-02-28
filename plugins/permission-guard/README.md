> Japanese version / 日本語版 → [README.ja.md](README.ja.md)

# permission-guard

Bash command validation hook for [Claude Code](https://claude.com/claude-code) that auto-approves safe commands, blocks shell injection, and prompts for everything else.

## Overview

When Claude Code requests permission to run a Bash command, this plugin intercepts the request via a `PreToolUse` hook and validates it through a multi-stage pipeline. Safe commands (read-only file operations, project-local scripts) are auto-approved without user interaction. Dangerous patterns (shell injection, path traversal, destructive operations) are either blocked outright or escalated to the standard permission dialog.

The goal is to reduce permission fatigue for routine operations while maintaining strong security boundaries.

## Validation Flow

Every command passes through two stages: **pre-validation** (before compound detection) and **post-validation** (after compound detection).

### Pre-validation

| Step | What it does |
|------|-------------|
| **S0 -- Null byte check** | Rejects null bytes and empty commands |
| **Phase 1 -- Sanitize** | Rejects control characters (0x00-0x1F, 0x7F), Unicode whitespace (U+0085, U+00A0, U+2000-U+200B, etc.), and non-Bash tool names |
| **Phase 1.5 -- Strip safe suffixes** | Iteratively removes safe trailing patterns (e.g. `2>/dev/null`) so they do not interfere with later checks |
| **Phase 2 -- Shell syntax** | Rejects dangerous shell constructs: backtick substitution, background execution, command substitution, variable expansion, environment variable assignment, tilde expansion, glob/brace expansion, interpreter-path concatenation, and quoted command names |

### Compound detection

After pre-validation, a regex determines whether the command is compound (contains pipes, chains, semicolons, or redirections).

**Simple commands** go to `validate_single_command`:

| Check | Result |
|-------|--------|
| Command is in the NEVER_SAFE set (`sudo`, `su`) | ask |
| Command path resolves within the project directory (via `normpath`) | allow |
| Command found in `tools` dict as a simple `"allow"` or `"ask"` entry | that value |
| Command found in `tools` dict as a rule entry -- check `dangerous_flags`, `ask` subcommands, then fall back to `default` | allow or ask |
| Command not in `tools` dict at all | ask (`unknown_command`) |

**Compound commands** go to `validate_compound_command`:

1. **Pipe right-side check** -- if any command after a pipe is in `pipe_deny_right` (shells, interpreters, `eval`, `exec`, `xargs`), deny immediately
2. **Segment split** -- break into command segments and redirect segments
3. **Per-segment validation** -- each command segment is validated via `validate_single_command`; each redirect target is checked for project containment (`/dev/null` is always allowed)
4. **Aggregation** -- if any segment is non-allow, that result is returned; if all segments are allow, the compound command is allowed

### Decision outputs

| Decision | Meaning |
|----------|---------|
| **allow** | Auto-approved, no user prompt |
| **ask** | Escalated to Claude Code's permission dialog |
| **deny** | Hard-blocked, command cannot run |

Pre-validation failures and dangerous pipe targets produce **deny**. NEVER_SAFE and unknown commands produce **ask**. Everything else follows the tools configuration.

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

| Layer | Source | Purpose |
|-------|--------|---------|
| 1 | `config/defaults.yaml` | Base rules shipped with the plugin |
| 2 | `.claude/permission-guard.yaml` | Project-specific user overrides |

### tools -- Unified Structure (3 entry types)

**Simple allow** -- auto-approved unconditionally:

```yaml
tools:
  ls: "allow"
  cat: "allow"
```

**Simple ask** -- always triggers the permission dialog:

```yaml
tools:
  curl: "ask"
  rm: "ask"
```

**Rule entry** -- subcommand and flag-level control:

```yaml
tools:
  git:
    ask: ["push", "clean", "filter-branch", "rebase", "reset"]
    dangerous_flags: ["--force", "-f", "--hard", "-D", "--no-verify"]
    default: "allow"
```

The `ask` list supports multi-word subcommands (e.g., `"pr merge"`). The `dangerous_flags` list supports compound short-flag decomposition (`-rf` checks `-r` and `-f` individually).

### pipe_deny_right

Commands blocked when they appear on the right side of a pipe. Defaults include: `bash`, `sh`, `zsh`, `ksh`, `fish`, `csh`, `tcsh`, `python`, `python3`, `perl`, `ruby`, `node`, `eval`, `exec`, `xargs`.

### User Overrides (`.claude/permission-guard.yaml`)

Created automatically by `/permission-guard:setup`.

| Key | Type | Description |
|-----|------|-------------|
| `tools_add` | map | Add or override tool entries on top of defaults |
| `tools_remove` | list | Remove tool names from defaults |
| `pipe_deny_right_add` | list | Add entries to the pipe deny list |
| `allowed_dirs_extra` | list | Additional directories outside the project to allow |
| `audit_log_path` | string | Override the audit log path |

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

- **Python 3** -- hook script runtime
- **PyYAML** -- config file loading

## Plugin Structure

```
plugins/permission-guard/
├── .claude-plugin/
│   └── plugin.json            # Plugin metadata
├── hooks/
│   └── hooks.json             # PreToolUse hook definition
├── scripts/
│   ├── permission-fallback    # Main validation script
│   └── test-permission.sh     # Validation test suite
├── config/
│   └── defaults.yaml          # Default tool rules
├── commands/
│   ├── setup.md               # /permission-guard:setup
│   ├── show.md                # /permission-guard:show
│   ├── optimize.md            # /permission-guard:optimize
│   └── permission-test.md     # /permission-guard:permission-test
├── docs/
│   └── DESIGN.md              # Architecture and design notes
├── logs/                      # Decision audit log (auto-created)
├── README.md                  # This file (English)
├── README.ja.md               # Japanese version
└── CHANGELOG.md               # Version history
```

## License

[MIT](../../LICENSE)
