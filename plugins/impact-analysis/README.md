> Japanese version / 日本語版 → [README.ja.md](README.ja.md)

# impact-analysis

LSP-based code impact analysis plugin for [Claude Code](https://claude.com/claude-code). Mechanically traces the impact scope of code changes using BFS traversal of LSP reference chains.

**Supported languages**: PHP, JavaScript, TypeScript

## Overview

When modifying a function, method, or class, this plugin answers the question: *"What else is affected by this change?"*

It uses `lsprefs` (LSP reference server) and `lsprefs-walk` (BFS traversal walker) to recursively follow reference chains from a starting point, producing:

- **evidence.tsv** — Machine-readable trace log of all discovered impact paths
- **summary.md** — Human-readable report highlighting critical impacts

## Analysis Patterns

### Pattern A: Code Origin

Start from a specific function/method/class name and trace all references.

```
/impact-analysis Investigate the impact of deleting the getSignature method
```

- Supports **single origin** (one starting symbol) and **multiple origins** (several symbols, merged into one evidence file)
- Interface methods can be traced with `--resolve-implementations` to include concrete implementations

### Pattern B: Spec Origin (STEP 0)

Start from a natural language description of a feature change. The AI first maps the spec to code locations, then runs the mechanical trace.

```
/impact-analysis What is the impact of changing the Fixer execution order logic?
```

1. AI analyzes project architecture and searches for relevant code
2. Candidate entry points are identified and presented with a confidence level
3. After confirmation, the standard BFS trace (Pattern A) is executed

### Pattern C: Cross-Language

Trace impact across language boundaries (e.g., PHP backend → TypeScript frontend).

```
/impact-analysis The /api/users endpoint response format is changing. Trace impact on both PHP and frontend TS.
```

1. Run impact trace on the first language (e.g., PHP)
2. AI identifies bridge points (API endpoints, response schemas, shared constants)
3. Search for corresponding code in the second language (e.g., TypeScript)
4. Run impact trace on the second language
5. Merge results with `lsprefs-walk merge`

## Output Files

### evidence.tsv

A tab-separated file containing every step of the BFS traversal. Each row represents a discovery event.

| Column | Description |
|--------|-------------|
| `step` | Sequential number |
| `depth` | BFS depth (0 = origin) |
| `kind` | `NODE` (function registered), `REF` (reference found), `DEF` (enclosing caller identified) |
| `node_id` | Node identifier (N0, N1, ...) |
| `parent_node_id` | Parent node (`-` for origin) |
| `ref_id` | Reference ID within a node (r1, r2, ...) |
| `from_ref_id` | Which REF produced this DEF |
| `file` | File path (relative to repo root) |
| `line` | Line number (1-based) |
| `col` | Column number (1-based) |
| `snippet` | One-line code snippet |
| `status` | `ok` / `merged` / `excluded` / `notfound` / `error` / `truncated` |
| `note` | Additional info (enclosing callable name, class, etc.) |

For multi-origin merges, an `origin_id` column (O1, O2, ...) is added after `step`.

### summary.md

A structured Markdown report including:

- Investigation overview (target, pattern, parameters)
- Impact scope summary (file count, node count, max depth)
- Critical impact highlights
- Impact breakdown by category/directory
- Risks and caveats

## Supported Languages

| Language | LSP Server | File Extensions |
|----------|-----------|-----------------|
| PHP | `intelephense --stdio` | `.php` |
| JavaScript | `typescript-language-server --stdio` | `.js`, `.jsx`, `.mjs`, `.cjs` |
| TypeScript | `typescript-language-server --stdio` | `.ts`, `.tsx` |

The LSP server is auto-detected from the entry point file extension. Use the `--server` flag in `lsprefs start` and `lsprefs-walk run` to override.

## Configuration

Key parameters (configurable via config.json or CLI flags):

| Parameter | Default | Description |
|-----------|---------|-------------|
| `root` | — | Target repository path (required) |
| `max_depth` | `4` | Maximum BFS traversal depth |
| `max_nodes` | `2000` | Maximum number of nodes to discover |
| `max_refs_per_node` | `300` | Maximum references per node |
| `exclude` | `vendor/**`, `.git/**`, `.cache/**`, `node_modules/**`, `tests/**` | Glob patterns to exclude |
| `server` | (auto-detected) | LSP server command |
| `resolve_implementations` | `false` | Resolve interface method implementations via LSP |

## Usage

Invoke the `/impact-analysis` skill in Claude Code:

```bash
# Pattern A: Code origin
/impact-analysis Investigate the impact of deleting the getSignature method

# Pattern B: Spec origin
/impact-analysis What is the impact of changing the Fixer execution order logic?

# Pattern C: Cross-language
/impact-analysis The /api/users endpoint response format is changing. Trace impact on both PHP and frontend TS.
```

### Execution Flow

```
Pattern A: STEP 1 → 2 → 3 → 4 → (4.5) → 5 → 6
Pattern B: STEP 0 → 1 → 2 → 3 → 4 → (4.5) → 5 → 6
```

| Step | Description |
|------|-------------|
| STEP 0 | Spec → code mapping (Pattern B only) |
| STEP 1 | Parse request, identify entry point, detect language |
| STEP 2 | Start lsprefs daemon with appropriate LSP server |
| STEP 3 | Generate config.json for lsprefs-walk |
| STEP 4 | Run BFS traversal via lsprefs-walk |
| STEP 4.5 | Merge multiple evidence files (multi-origin only) |
| STEP 5 | Analyze evidence.tsv, generate summary.md |
| STEP 6 | Report results to user |

## Dependencies

| Tool | Install Method | Purpose |
|------|---------------|---------|
| `lsprefs` | `go install github.com/skaji18/devtools/lsprefs@latest` | LSP reference/definition daemon |
| `lsprefs-walk` | `go install github.com/skaji18/devtools/lsprefs-walk@latest` | BFS impact traversal |
| `intelephense` | `npm install -g intelephense` | PHP LSP server |
| `typescript-language-server` | `npm install -g typescript-language-server typescript` | JS/TS LSP server |
| `rg` (ripgrep) | [github.com/BurntSushi/ripgrep](https://github.com/BurntSushi/ripgrep) | Code search |

Run the setup script to install all dependencies:

```bash
bash scripts/setup.sh
```

Verify installation:

```bash
bash scripts/validate.sh
```

## Plugin Structure

```
plugins/impact-analysis/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata (name, version, dependencies)
├── skills/
│   └── impact-analysis/
│       └── SKILL.md          # Skill prompt (all patterns, STEP 0-6)
├── hooks/
│   └── hooks.json            # SessionStart hook for dependency validation
├── scripts/
│   ├── setup.sh              # Install all dependencies
│   └── validate.sh           # Verify all dependencies exist
├── README.md                 # This file (English)
└── README.ja.md              # Japanese version
```

## License

[MIT](../../LICENSE)
