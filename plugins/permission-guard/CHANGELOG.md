# Changelog

## [1.0.0] - 2026-02-15

### Added
- Initial release: 8-phase Bash command validation pipeline
- Dual-mode support: Plugin mode ($CLAUDE_PLUGIN_ROOT) and inline mode
- 4-layer config merge (Hardcoded → Plugin → Project → Local)
- Security floors: sudo, su, rm, rmdir always require dialog
- Frozen keys: interpreters config cannot be overridden
- Test suite with 189+ test cases
