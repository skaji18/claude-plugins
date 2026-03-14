# Changelog

## [2.1.0] - 2026-03-14

### Added
- **Configurable shell_syntax_policy** — each dangerous AST node phase (cmd_substitution, var_expansion, env_assignment, glob_chars, background_execution, backtick_substitution) can be independently set to allow/ask/deny via config
- **Most restrictive wins** — when multiple dangerous nodes are present, all are evaluated and the strictest policy applies (deny > ask > allow)

### Changed
- **Default phase policies changed to "ask"** — all phases now default to "ask" instead of hardcoded deny. Users can tighten to "deny" per phase if desired

## [2.0.0] - 2026-03-14

### Added
- **File access guard** — new PreToolUse hook for Read/Write/Edit/Glob/Grep. Checks file paths against PROJECT_DIR and allow_paths_outside_project using realpath resolution
- **`file_access_outside_project` config** — controls decision for file access outside allowed directories (default: "ask", can be set to "deny")
- **`path_check.py` module** — shared path normalization and containment logic used by both Bash and file access hooks
- **`boot-file` entry point** — lightweight bootstrap for file access hook
- 19 file access E2E tests

### Changed
- **`detect_project_dir` uses realpath** — fixes symlink comparison mismatch (e.g., macOS `/tmp` → `/private/tmp`)
- **`allow_paths_outside_project` resolved with realpath** — consistent with file path resolution
- **`fallback.py` refactored** — imports shared functions from `path_check.py`

## [1.4.0] - 2026-03-09

### Changed
- **tree-sitter-bash migration** — replaced bashlex with tree-sitter-bash for AST parsing
- **P5 demoted** — `variable_assignment` now produces ask instead of deny
- **P7 improved** — glob detection uses tree-sitter quoting context
- **Safe special variables** — `$?`, `$#`, `$!`, `$-`, `$0`, `$_`, `$@`, `$$` recognized as safe

### Added
- **cp** added to defaults as allow
- **gh** added with read-only subcommand allow list

## [1.3.0] - 2026-03-07

### Changed
- **bashlex AST parsing** — replaced regex-based analysis with proper AST parsing
- **Test suite rewritten in Python** — 144 test cases via subprocess

## [1.2.0] - 2026-03-04

### Changed
- **Python package structure** — migrated to `python -m pg <subcmd>` dispatch

## [1.0.0] - 2026-02-15

### Added
- Initial release: 8-phase Bash command validation pipeline
- 3-layer config merge, deny-by-default, NEVER_SAFE hardcoding
- Project-contained command auto-allow
