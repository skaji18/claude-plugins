# claude-plugins

> Japanese version / 日本語版 → [README.ja.md](README.ja.md)

Claude Code plugins collection by skaji18.

## Plugins

| Plugin | Description | Version |
|--------|-------------|---------|
| [impact-analysis](plugins/impact-analysis/) | Code impact analysis skill (PHP / JS / TS) | 1.1.0 |
| [task-tracker](plugins/task-tracker/) | Obsidian-compatible task management plugin | 1.0.0 |

## Prerequisites

- [Claude Code](https://claude.com/claude-code) CLI

### impact-analysis

- [Go](https://go.dev/dl/) 1.21+ (for lsprefs, lsprefs-walk)
- [Node.js](https://nodejs.org/) 18+ (for intelephense, typescript-language-server)
- [ripgrep](https://github.com/BurntSushi/ripgrep) (`rg`)

### task-tracker

- [Obsidian](https://obsidian.md/) vault (local directory)

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

## Contributing

Issues and pull requests are welcome at [github.com/skaji18/claude-plugins](https://github.com/skaji18/claude-plugins).

## License

[MIT](LICENSE)
