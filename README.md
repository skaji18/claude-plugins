# claude-plugins

> Japanese version / 日本語版 → [README.ja.md](README.ja.md)

Claude Code plugins collection by skaji18.

## Plugins

| Plugin | Description | Version |
|--------|-------------|---------|
| [impact-analysis](plugins/impact-analysis/) | Code impact analysis skill (PHP / JS / TS) | 1.1.0 |
| [task-tracker](plugins/task-tracker/) | Obsidian-compatible task management plugin | 1.0.0 |
| [permission-guard](plugins/permission-guard/) | 8-phase Bash command validation hook | 1.0.0 |

## Prerequisites

- [Claude Code](https://claude.com/claude-code) CLI

### impact-analysis

- [Go](https://go.dev/dl/) 1.21+ (for lsprefs, lsprefs-walk)
- [Node.js](https://nodejs.org/) 18+ (for intelephense, typescript-language-server)
- [ripgrep](https://github.com/BurntSushi/ripgrep) (`rg`)

### task-tracker

- [Obsidian](https://obsidian.md/) vault (local directory)

### permission-guard

- [Python 3](https://www.python.org/) (required)
- [PyYAML](https://pypi.org/project/PyYAML/) (optional, for config customization)

## Installation

### impact-analysis

```bash
# Install dependencies
bash plugins/impact-analysis/scripts/setup.sh

# Verify installation
bash plugins/impact-analysis/scripts/validate.sh
```

### task-tracker

```bash
# Create config and directories
bash plugins/task-tracker/scripts/setup.sh

# Verify setup
bash plugins/task-tracker/scripts/validate.sh
```

### permission-guard

```bash
# Verify dependencies
bash plugins/permission-guard/scripts/setup.sh

# Run tests
bash plugins/permission-guard/scripts/test-permission.sh
```

Alternatively, use the `/init` command in Claude Code for interactive setup.

## Plugin: impact-analysis

Mechanically traces the impact scope of code changes using LSP-based BFS traversal. Outputs `evidence.tsv` (machine-readable trace log) and `summary.md` (human-readable report).

### Supported Languages

| Language | LSP Server Command | File Extensions |
|----------|-------------------|-----------------|
| PHP | `intelephense --stdio` | `.php` |
| JavaScript | `typescript-language-server --stdio` | `.js`, `.jsx` |
| TypeScript | `typescript-language-server --stdio` | `.ts`, `.tsx` |

The LSP server is auto-detected from the entry point file extension.

### Features

- BFS traversal via `lsprefs` / `lsprefs-walk` for automated impact tracing
- Three analysis patterns:
  - **Pattern A (Code origin)**: Start from a specific function/method/class name
  - **Pattern B (Spec origin)**: Start from a natural language description of a feature change
  - **Pattern C (Cross-language)**: Trace impact across PHP ↔ JS/TS boundaries via API endpoints
- Single origin, multiple origins, and interface method resolution
- Outputs `evidence.tsv` + `summary.md`

### Usage

```bash
/impact-analysis Investigate the impact of deleting the getSignature method
/impact-analysis What is the impact of changing the Fixer execution order logic?
/impact-analysis The /api/users endpoint response format is changing. Trace impact on both PHP and frontend TS.
```

See [plugins/impact-analysis/README.md](plugins/impact-analysis/) for full documentation.

## Plugin: task-tracker

Obsidian-compatible task management plugin. Captures work tasks from chat messages, tracks them as Markdown files, and manages completion with daily logs.

### Features

- **AI-powered capture**: Paste raw chat messages and the AI extracts metadata (requester, type, tags, deadline, URLs)
- **Obsidian-native**: Tasks are plain Markdown files with YAML front matter, stored in your vault
- **Folder-based status**: `inbox/` = active, `done/` = completed
- **Daily log**: Automatic daily summary of completed tasks

### Commands

| Command | Purpose |
|---------|---------|
| `/init` | Interactive setup |
| `/add` | Capture a new task |
| `/done` | Mark a task as complete |
| `/list` | Display task list |
| `/delete` | Remove a task |

See [plugins/task-tracker/README.md](plugins/task-tracker/) for full documentation.

## Plugin: permission-guard

8-phase Bash command validation hook that intercepts `PermissionRequest` events. Auto-approves safe commands and blocks dangerous patterns before they reach the user dialog.

### Features

- **8-phase validation pipeline**: Null byte check, sanitization, shell syntax rejection, command parsing, flag normalization, path resolution, scripts/hooks auto-approval, general command rules
- **4-layer config merge**: Hardcoded defaults → Plugin config → Project config → Local overlay
- **Security floors**: `sudo`, `su`, `rm`, `rmdir` always require dialog (cannot be overridden)
- **Frozen keys**: `interpreters` config cannot be modified by project or local configs
- **Subcommand rules**: Block destructive subcommands like `git push`, `git reset --hard`, `gh pr merge`
- **Dual-mode**: Works as a plugin (`$CLAUDE_PLUGIN_ROOT`) or inline (`.claude/hooks/`)

### Commands

| Command | Purpose |
|---------|---------|
| `/permission-guard:permission-test` | Run validation test suite |

See [plugins/permission-guard/README.md](plugins/permission-guard/) for full documentation.

## Contributing

Issues and pull requests are welcome at [github.com/skaji18/claude-plugins](https://github.com/skaji18/claude-plugins).

## License

[MIT](LICENSE)
