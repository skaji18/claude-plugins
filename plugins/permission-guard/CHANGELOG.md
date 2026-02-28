# Changelog

## [Unreleased]

### Added
- **project-contained command auto-allow** — commands with a slash in the name (e.g., .venv/bin/pytest, scripts/deploy.sh) are resolved to absolute path via normpath and auto-allowed if within PROJECT_DIR or allowed_dirs_extra. No new config keys needed.
- **docs/DESIGN.md** — design document covering value proposition, architecture, and design principles
- **deny-by-default** — unknown commands now prompt user; tools dict contains 37 allow entries for auto-approval
- **safe-enumeration** — tools unified structure with allow/ask/default model and ask subcommand lists
- **flag decomposition** — compound short flags (-xeu) decomposed and checked individually against dangerous_flags

### Fixed
- **F-001** — shell quoting bypass in command name position
- **F-002** — flag-argument shifting bypass via fail-closed on leading flags
- **F-003** — python/python2 not in tools dict (triggers ask as unknown_command)
- **F-004** — dash/zsh/ksh/fish/csh/tcsh not in tools dict (triggers ask as unknown_command)
- **F-005** — nested /scripts/ substring match replaced with startswith
- **F-006** — symlink TOCTOU via normpath-to-realpath in canonicalize_path
- **F-007** — path variant ./  vs . normalization in subcommand matching
- **F-008** — long flag =value syntax via prefix match
- **F-009** — rule index counter bug with separate sub_idx
- **F-010** — command builtin not in tools dict (triggers ask as unknown_command)
- **F-013** — case-sensitive tools lookup means uppercase variants trigger ask as unknown_command
- **F-014** — special parameter expansion regex broadened
- **F-016** — Unicode whitespace rejection in Phase 1
- **NEW-5** — missing git subcommands added to ask list (rebase, reset, filter-branch, etc.)
- **NEW-6** — find/chmod/chown added as tools ask entries

### Changed
- **test suite** — expanded from 13 to 124 test cases covering all new features

## [1.0.0] - 2026-02-15

### Added
- Initial release: 8-phase Bash command validation pipeline
- Dual-mode support: Plugin mode ($CLAUDE_PLUGIN_ROOT) and inline mode
- 4-layer config merge (Hardcoded → Plugin → Project → Local)
- Security floors: sudo, su, rm, rmdir always require dialog
- Frozen keys: interpreters config cannot be overridden
- Test suite with 189+ test cases
