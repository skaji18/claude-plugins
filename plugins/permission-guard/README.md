# permission-guard

Permission validation hook for [Claude Code](https://claude.com/claude-code). Guards Bash commands and file access (Read/Write/Edit/Glob/Grep) with configurable policies and path containment.

## Installation

```bash
/plugin install permission-guard@skaji18-plugins
/permission-guard:setup
```

## What it does

- **Bash commands**: Parses with tree-sitter-bash AST, auto-approves safe commands, blocks dangerous patterns
- **File access**: Checks Read/Write/Edit/Glob/Grep paths against project directory and allowed directories
- **Configurable**: 3-layer config merge (defaults → global → project), per-phase policy overrides

## Bash command validation

Commands pass through pre-validation (null bytes, control chars, unicode whitespace) then AST-based analysis:

| Construct | Default decision | Configurable via |
|-----------|-----------------|------------------|
| Command substitution `$(cmd)` | ask | `phase_policy.cmd_substitution` |
| Backtick substitution `` `cmd` `` | ask | `phase_policy.backtick_substitution` |
| Variable expansion `$VAR` | ask | `phase_policy.var_expansion` |
| Env assignment `FOO=bar cmd` | ask | `phase_policy.env_assignment` |
| Background `&` | ask | `phase_policy.background_execution` |
| Unquoted glob `*.py` | ask | `phase_policy.glob_chars` |

Per-command validation uses a tools dictionary with three entry types:

```yaml
tools:
  ls: "allow"                    # simple allow
  curl: "ask"                    # simple ask
  git:                           # rule entry
    ask: ["push", "rebase"]
    dangerous_flags: ["--force"]
    default: "allow"
```

When multiple dangerous constructs are present, **most restrictive policy wins** (deny > ask > allow).

## File access guard

Read/Write/Edit/Glob/Grep tool calls are checked for path containment:

```
file_path → realpath() resolve
  ├─ Within PROJECT_DIR → allow
  ├─ Within allowed_dirs_extra → allow
  └─ Otherwise → file_access_outside_project (default: "ask")
```

## Configuration

### 3-layer merge

| Layer | Source |
|-------|--------|
| Defaults | `config/defaults.yaml` |
| Global | `~/.claude/permission-guard.yaml` |
| Project | `$CLAUDE_PROJECT_DIR/.claude/permission-guard.yaml` |

### Config keys

| Key | Type | Description |
|-----|------|-------------|
| `tools_add` | map | Add or override tool entries |
| `tools_remove` | list | Remove tool names from defaults |
| `pipe_deny_right_add` | list | Add to pipe deny list |
| `allowed_dirs_extra` | list | Additional allowed directories (shared by Bash and file access) |
| `audit_log_path` | string | Override audit log path |
| `file_access_outside_project` | string | Decision for file access outside project: `"ask"` or `"deny"` |
| `phase_policy` | map | Per-phase AST validation decisions (see table above) |

### Example

```yaml
tools_add:
  bun: "allow"
allowed_dirs_extra:
  - "/Users/me/shared-libs"
file_access_outside_project: "ask"
phase_policy:
  glob_chars: "allow"
  var_expansion: "ask"
```

## Commands

| Command | Description |
|---------|-------------|
| `/permission-guard:setup` | Create venv, install deps, generate config, run tests |
| `/permission-guard:show` | Display effective config with source attribution |
| `/permission-guard:optimize` | Analyze decision log and suggest config changes |
| `/permission-guard:permission-test` | Run E2E test suite |

## Dependencies

- Python 3, PyYAML, tree-sitter, tree-sitter-bash

## License

[MIT](../../LICENSE)
