# claude-plugins

> Japanese version / 日本語版 → [README.ja.md](README.ja.md)

Claude Code plugins collection by skaji18.

## Plugins

| Plugin | Description | Version |
|--------|-------------|---------|
| [impact-analysis](plugins/impact-analysis/) | Code impact analysis skill (PHP / JS / TS) | 1.1.0 |

## Prerequisites

- [Go](https://go.dev/dl/) 1.21+ (for lsprefs, lsprefs-walk)
- [Node.js](https://nodejs.org/) 18+ (for intelephense, typescript-language-server)
- [ripgrep](https://github.com/BurntSushi/ripgrep) (`rg`)
- [Claude Code](https://claude.com/claude-code) CLI

## Installation

### 1. Run setup script

```bash
bash plugins/impact-analysis/scripts/setup.sh
```

This installs the following tools:

| Tool | Install method | Purpose |
|------|---------------|---------|
| `lsprefs` | `go install` | LSP-based reference/definition lookup daemon |
| `lsprefs-walk` | `go install` | BFS-based impact analysis walker |
| `intelephense` | `npm install -g` | PHP LSP server |
| `typescript-language-server` | `npm install -g` | JS/TS LSP server |

### 2. Verify installation

```bash
bash plugins/impact-analysis/scripts/validate.sh
```

All checks should show `[OK]`. If any dependency is missing, run `setup.sh` again.

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

Invoke the `/impact-analysis` skill in Claude Code:

```bash
# Pattern A: Code origin — specify a function/method name
/impact-analysis Investigate the impact of deleting the getSignature method

# Pattern B: Spec origin — describe a feature change in natural language
/impact-analysis What is the impact of changing the Fixer execution order logic?

# Pattern C: Cross-language — trace impact across PHP and JS/TS
/impact-analysis The /api/users endpoint response format is changing. Trace impact on both PHP and frontend TS.
```

### Plugin Structure

```
plugins/impact-analysis/
├── .claude-plugin/
│   └── plugin.json          # Plugin definition (name, version, dependencies)
├── skills/
│   └── impact-analysis/
│       └── SKILL.md          # Skill prompt (STEP 0-6, all patterns)
├── hooks/
│   └── hooks.json            # SessionStart hook for dependency validation
└── scripts/
    ├── setup.sh              # Install all dependencies
    └── validate.sh           # Check all dependencies exist
```

## Contributing

Issues and pull requests are welcome at [github.com/skaji18/claude-plugins](https://github.com/skaji18/claude-plugins).

## License

[MIT](LICENSE)
