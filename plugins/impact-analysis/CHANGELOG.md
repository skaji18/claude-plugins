# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-01-31

### Added

- Multi-language support: JavaScript and TypeScript via `typescript-language-server --stdio`
- Language auto-detection from entry point file extension
- Go and Node.js version checks in `setup.sh` (Go 1.21+, Node.js 18+)
- Plugin README in English and Japanese
- Pattern B: Spec origin analysis (STEP 0 — natural language to code mapping)
- Pattern C: Cross-language tracing across PHP and JS/TS via API endpoints
- Multiple origin support with `lsprefs-walk merge`
- `--resolve-implementations` flag for interface method tracing
- `.impact-profile.json` for project-specific configuration
- `confidence` and `severity` columns in evidence.tsv
- Dynamic dispatch detection (`dynamic:` warnings in `note` column)
- `graph` subcommand for Graphviz DOT visualization

### Changed

- Migrated skill definition from `skills/impact-analysis/SKILL.md` to `commands/impact-analysis.md` for official Claude Code plugin schema compliance
- Simplified `plugin.json` to match official schema
- Updated `hooks.json` to official schema format

## [1.0.0] - 2026-01-31

### Added

- Initial release with PHP support via `intelephense --stdio`
- LSP-based BFS traversal using `lsprefs` and `lsprefs-walk`
- Pattern A: Code origin analysis (single origin)
- `evidence.tsv` output (machine-readable trace log)
- `summary.md` output (human-readable report)
- `setup.sh` for dependency installation
- `validate.sh` for dependency verification
- SessionStart hook for automatic dependency validation
- MIT license
