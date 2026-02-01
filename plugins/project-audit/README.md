# project-audit

A comprehensive project audit skill for Claude Code. Analyzes 6 key areas of your project — structure, quality, DX, security, documentation, and dependencies — and delivers prioritized findings with actionable improvement proposals.

## Overview

**project-audit** performs a systematic health check of any software project by examining:

| Area | What it checks |
|------|---------------|
| **Structure** | Directory layout, naming conventions, architecture patterns |
| **Quality** | Linter/formatter config, tests, error handling, large files, code smells |
| **DX** | README quality, setup scripts, CI/CD, dev environment config |
| **Security** | Hardcoded secrets, .env exposure, dependency vulnerabilities |
| **Documentation** | README completeness, CHANGELOG, API docs, LICENSE |
| **Dependencies** | Lock files, outdated packages, unused dependencies, license compatibility |

No external tool dependencies — runs entirely with Claude Code's built-in tools (Read, Write, Glob, Grep, Bash).

## Installation

Add this plugin to your Claude Code configuration:

```bash
# In your project or global settings
claude plugin add github:skaji18/claude-plugins/plugins/project-audit
```

Or add it to `.claude/settings.json`:

```json
{
  "plugins": [
    "github:skaji18/claude-plugins/plugins/project-audit"
  ]
}
```

## Usage

```
/project-audit [project-path] [options]
```

### Parameters

| Parameter | Default | Options |
|-----------|---------|---------|
| `PROJECT_PATH` | Current directory | Any valid path |
| `--depth` | `standard` | `quick` / `standard` / `deep` |
| `--focus` | `all` | `structure` / `quality` / `dx` / `security` / `docs` / `deps` / `all` |
| `--out` | `{PROJECT_PATH}/.audit` | Any valid path |
| `--lang` | `ja` | `ja` / `en` |

### Depth Levels

| Depth | Scope | Files read | Competitive analysis |
|-------|-------|-----------|---------------------|
| `quick` | Directory structure + config files + README | ~20 key files | None |
| `standard` | quick + source code sampling + dependencies | ~50 key files | Brief comparison |
| `deep` | standard + exhaustive file analysis + detailed review | No limit | Detailed comparison |

## Output

Two files are generated in the output directory:

### audit-report.yaml

Structured YAML data for machine consumption and integration with other tools:

```yaml
meta:
  tool: project-audit
  version: "1.0.0"
  project_path: "/path/to/project"
  depth: standard
  timestamp: "2026-02-01T10:00:00"

project_structure:
  overview: "..."
  languages: [...]
  frameworks: [...]

issues:
  - id: ISS-001
    severity: high
    category: security
    title: "Hardcoded API key detected"

improvement_proposals:
  high: [...]
  medium: [...]
  low: [...]

overall_assessment:
  health_score: "B"
  scores:
    structure: "B+"
    quality: "A-"
    ...
```

### audit-summary.md

Human-readable Markdown report suitable for sharing with team members, clients, or management. Includes:

- Executive summary (non-technical language)
- Overall health score (S/A/B/C/D scale)
- Per-area score breakdown
- Issues sorted by severity
- Prioritized improvement proposals with effort estimates
- Recommended action plan (immediate / short-term / mid-term)

## Scoring

Each area is scored on an S-D scale:

| Score | Meaning |
|-------|---------|
| **S** | Exemplary. Minimal room for improvement |
| **A** | Good. Only minor issues |
| **B** | Standard. Some improvements recommended |
| **C** | Needs improvement. Multiple significant issues |
| **D** | Critical. Immediate action required |

Modifiers `+` / `-` provide finer granularity (e.g., `B+`, `A-`).

Overall score uses weighted average: security (x1.5), quality (x1.2), others (x1.0).

## Examples

### Quick audit of current directory

```
/project-audit --depth quick
```

Performs a fast scan of directory structure and config files. Ideal for a first look at an unfamiliar project.

### Standard audit with security focus

```
/project-audit /path/to/project --focus security,quality
```

Runs a standard-depth audit focusing on security and code quality areas only.

### Deep audit for refactoring planning

```
/project-audit /path/to/project --depth deep --lang en
```

Exhaustive analysis of the entire project with competitive comparison. Outputs in English. Best for creating a comprehensive refactoring roadmap.

### Natural language input

```
/project-audit I want to check if this project is ready for production
```

The AI interprets the intent and runs an appropriate audit (likely standard depth with focus on security and quality).

## Comparison with impact-analysis

| Aspect | impact-analysis | project-audit |
|--------|----------------|---------------|
| Purpose | Trace impact of code changes | Diagnose overall project health |
| Method | LSP + BFS mechanical tracing | AI-powered comprehensive analysis |
| External tools | lsprefs, LSP servers | None |
| Output | evidence.tsv + summary.md | audit-report.yaml + audit-summary.md |
| Granularity | Function/method level | Project level |

## License

See the repository root [LICENSE](../../LICENSE) for details.
