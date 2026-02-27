# Changelog

## [Unreleased]

### Added
- **project-contained command auto-allow** — commands with `/` in the name (e.g., `.venv/bin/pytest`, `scripts/deploy.sh`) are resolved to absolute path and auto-allowed if within `PROJECT_DIR` or `allowed_dirs_extra`. No new config keys needed.
- **docs/DESIGN.md** — design document covering value proposition, architecture, and design principles
- **deny-by-default** — unknown commands now prompt user; known_safe list (~63 commands) for auto-approval
- **safe-enumeration** — subcommand_rules replaces subcommand_ask with allow/ask/default_action model
- **flag decomposition** — compound short flags (-xeu) decomposed and checked individually
- **interpreter expansion** — node, perl, ruby, php added with flag definitions; bash/sh safe_flags expanded
- **interpreters_extra** — user-extensible interpreter config key
- **known_safe_extra** — user-extensible safe command list (security floor enforced)
- **all-arg path candidacy** — all non-flag positional args treated as path candidates

### Fixed
- **F-001** — shell quoting bypass in command name position
- **F-002** — flag-argument shifting bypass via fail-closed on leading flags
- **F-003** — python/python2 missing from always_ask
- **F-004** — dash/zsh/ksh/fish/csh/tcsh missing from always_ask
- **F-005** — nested /scripts/ substring match replaced with startswith
- **F-006** — symlink TOCTOU via normpath→realpath in canonicalize_path
- **F-007** — path variant ./  vs . normalization in subcommand matching
- **F-008** — long flag =value syntax via prefix match
- **F-009** — rule index counter bug with separate sub_idx
- **F-010** — command builtin bypass added to always_ask
- **F-013** — case-insensitive always_ask matching
- **F-014** — special parameter expansion regex broadened
- **F-016** — Unicode whitespace rejection in Phase 1
- **NEW-5** — missing git subcommands (stash drop, rebase, branch -D, etc.)
- **NEW-6** — find/chmod/chown added to always_ask

### Changed
- **test suite** — expanded from 13 to 117 test cases covering all new features

## [1.0.0] - 2026-02-15

### Added
- Initial release: 8-phase Bash command validation pipeline
- Dual-mode support: Plugin mode ($CLAUDE_PLUGIN_ROOT) and inline mode
- 4-layer config merge (Hardcoded → Plugin → Project → Local)
- Security floors: sudo, su, rm, rmdir always require dialog
- Frozen keys: interpreters config cannot be overridden
- Test suite with 189+ test cases
