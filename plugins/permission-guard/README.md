> Japanese version / 日本語版 → [README.ja.md](README.ja.md)

# permission-guard

Bash command validation hook for [Claude Code](https://claude.com/claude-code) that auto-approves safe commands, blocks shell injection, and prompts for everything else.

## Overview

When Claude Code requests permission to run a Bash command, this plugin intercepts the request via a `PreToolUse` hook and validates it through a multi-stage pipeline. Safe commands (read-only file operations, project-local scripts) are auto-approved without user interaction. Dangerous patterns (shell injection, path traversal, destructive operations) are either blocked outright or escalated to the standard permission dialog.

The goal is to reduce permission fatigue for routine operations while maintaining strong security boundaries.

## Validation Flow

Every command passes through two stages: **pre-validation** (input sanitization) and **AST-based validation** (structural analysis via tree-sitter-bash).

### Pre-validation

| Step | What it does |
|------|-------------|
| **S0 -- Null byte check** | Rejects null bytes and empty commands |
| **Phase 1 -- Sanitize** | Rejects control characters (0x00-0x1F, 0x7F), Unicode whitespace (U+0085, U+00A0, U+2000-U+200B, etc.), and non-Bash tool names |

### AST parsing (tree-sitter-bash)

After pre-validation, the command is parsed into an AST using [tree-sitter-bash](https://github.com/tree-sitter/tree-sitter-bash). This provides proper structural analysis with full support for heredocs, quoted strings, and special variables.

The AST walker detects dangerous constructs by node type:

| AST node | Detected construct | Decision |
|----------|-------------------|----------|
| `command_substitution` | `` `cmd` `` or `$(cmd)` | deny |
| `simple_expansion` / `expansion` | `$VAR`, `${VAR}`, etc. | deny |
| `variable_assignment` | `FOO=bar` | ask |
| Background `&` | Background execution | deny |
| Unquoted glob chars in `word` | `*`, `?`, `[` | deny |

Safe special variables (`$?`, `$#`, `$!`, `$-`, `$0`, `$_`, `$@`, `$$`) are recognized and allowed. Quoted strings (`'...'`, `"..."`) are not flagged for glob characters.

If tree-sitter-bash cannot parse the command (or the AST contains errors), the decision falls back to **ask** (safe default).

Pipes, chains (`&&`, `||`, `;`), subshells (`(cmd)`), and redirects are decomposed into individual commands for per-command validation.

### Per-command validation

Each extracted command is validated against the tools configuration:

| Check | Result |
|-------|--------|
| Command is in the NEVER_SAFE set (`sudo`, `su`) | ask |
| Command path resolves within the project directory (via `normpath`) | allow |
| Command found in `tools` dict as a simple `"allow"` or `"ask"` entry | that value |
| Command found in `tools` dict as a rule entry -- check `dangerous_flags`, `ask` subcommands, then fall back to `default` | allow or ask |
| Command not in `tools` dict at all | ask (`unknown_command`) |

For compound commands, pipe right-side commands are checked against `pipe_deny_right`, and redirect targets are checked for project containment (`/dev/null` is always allowed).

### Decision outputs

| Decision | Meaning |
|----------|---------|
| **allow** | Auto-approved, no user prompt |
| **ask** | Escalated to Claude Code's permission dialog |
| **deny** | Hard-blocked, command cannot run |

Pre-validation failures and dangerous AST nodes produce **deny** (except `variable_assignment` which produces **ask**). NEVER_SAFE and unknown commands produce **ask**. Everything else follows the tools configuration.

## Installation

```bash
/plugin install permission-guard@skaji18-plugins
```

After installation, run the setup skill to create a venv, install dependencies, and generate your config templates:

```bash
/permission-guard:setup
```

## Configuration

### 3-Layer Config Merge

| Layer | Source | Purpose |
|-------|--------|---------|
| 1 | `config/defaults.yaml` | Base rules shipped with the plugin |
| 2 | `~/.claude/permission-guard.yaml` | User-wide global overrides |
| 3 | `CLAUDE_PROJECT_DIR/.claude/permission-guard.yaml` | Project-specific overrides |

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

### User Overrides

Created automatically by `/permission-guard:setup` at both global and project levels.

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
| `/permission-guard:setup` | Create venv, install deps, generate config templates, and run tests |
| `/permission-guard:show` | Display effective config (defaults merged with overrides, with diff markers) |
| `/permission-guard:optimize` | Analyze decision log and suggest config changes to reduce unnecessary prompts |
| `/permission-guard:permission-test` | Run the E2E test suite to verify hook functionality |

## Dependencies

- **Python 3** -- hook script runtime
- **PyYAML** -- config file loading
- **tree-sitter** / **tree-sitter-bash** -- shell command AST parsing

## Plugin Structure

```
plugins/permission-guard/
├── .claude-plugin/
│   └── plugin.json            # Plugin metadata
├── hooks/
│   └── hooks.json             # PreToolUse hook definition
├── scripts/
│   ├── boot                   # Hook entry point (shell wrapper)
│   ├── pg/                    # Python package
│   │   ├── __init__.py
│   │   ├── __main__.py        # CLI dispatch
│   │   ├── parser.py          # tree-sitter-bash AST parser
│   │   ├── fallback.py        # Main hook logic
│   │   ├── config.py          # 3-layer config loader
│   │   ├── show.py            # /permission-guard:show
│   │   ├── analyze.py         # /permission-guard:optimize
│   │   └── apply.py           # Config proposal applier
│   ├── setup.sh               # /permission-guard:setup
│   └── test_e2e.py            # E2E test suite (144 cases)
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
