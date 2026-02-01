# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-01

### Added

- Initial release
- `/init` command: Interactive setup wizard for `~/.task-tracker.json` and directory structure
- `/add` command: AI-powered task capture from chat messages, URLs, or free text
  - Auto-extraction of requester, type, tags, deadline, URLs
  - Three input patterns: chat URL + quoted message, quoted message only, free text
  - Custom tag rules via `~/.task-tracker.json`
- `/done` command: Task completion with daily log
  - 3-stage task identification (explicit ID, single task confirmation, candidate list)
  - Automatic daily log update in `daily/YYYY-MM-DD.md`
  - File movement from `inbox/` to `done/`
- `/list` command: Task list display with filtering
  - `--all`, `--done` options
  - Table format with ID, title, created date, project, tags
- `/delete` command: Task deletion with daily log strikethrough
  - Full ID and partial ID matching
  - Confirmation before deletion
- Obsidian-compatible Markdown task files with YAML front matter
- Folder-based status management (`inbox/` = active, `done/` = completed)
- `setup.sh` for directory creation
- `validate.sh` for config and directory validation
- SessionStart hook for automatic config validation
- Plugin README in English and Japanese
- MIT license
