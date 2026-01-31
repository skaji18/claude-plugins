> Japanese version / 日本語版 → [README.ja.md](README.ja.md)

# task-tracker

Obsidian-compatible task management plugin for [Claude Code](https://claude.com/claude-code). Captures, tracks, and completes work tasks using Markdown files with YAML front matter.

## Overview

When you receive a task request via chat, email, or meeting, this plugin lets you quickly capture it as a structured Markdown file and track it through completion. All data is stored as plain Markdown in an Obsidian vault, so you can browse, search, and link tasks naturally in Obsidian.

Key features:

- **AI-powered capture**: Paste raw chat messages and the AI extracts metadata (requester, type, tags, deadline, URLs)
- **Obsidian-native**: Tasks are plain Markdown files with YAML front matter, stored in your vault
- **Folder-based status**: `inbox/` = active, `done/` = completed (no status field needed)
- **Daily log**: Automatic daily summary of completed tasks in `daily/YYYY-MM-DD.md`

## Commands

| Command | Purpose |
|---------|---------|
| `/init` | Interactive setup — creates `~/.task-tracker.json` and directory structure |
| `/add` | Capture a new task from chat messages, URLs, or free text |
| `/done` | Mark a task as complete — moves to `done/`, appends result, updates daily log |
| `/list` | Display task list with filtering options |
| `/delete` | Remove a mistakenly registered task |

## Usage

### /init — Initial Setup

```
/init
```

Interactively creates the configuration file (`~/.task-tracker.json`) and sets up the directory structure in your Obsidian vault.

### /add — Capture a Task

```
/add
https://chat.google.com/room/xxx/thread/yyy

```
Tanaka here. Please review this PR.
https://github.com/org/repo/pull/123
Would appreciate it by end of this week.
```
```

The AI extracts:
- **Requester**: Tanaka
- **Type**: review/pr
- **Tags**: `#proj/repo` `#type/review`
- **Deadline**: End of week
- **URLs**: GitHub PR link

Supports three input patterns: chat URL + quoted message, quoted message only, or free text.

### /done — Complete a Task

```
/done
LGTM, just two minor comments.
- L42: missing null check
- L88: typo in variable name
```

Paste the reply you sent. The AI identifies the matching task, moves it to `done/`, and updates the daily log.

### /list — View Tasks

```
/list            # Show inbox (active tasks)
/list --all      # Show both inbox and done
/list --done     # Show completed tasks only
```

Displays a formatted table with ID, title, creation date, project, and tags. Sorted by newest first.

### /delete — Remove a Task

```
/delete            # Show list and choose
/delete a3f2b1c8   # Delete by ID
/delete a3f2       # Partial ID match
```

Physically removes the task file. For completed tasks, also adds a strikethrough to the daily log entry. Confirmation is required before deletion.

## Configuration

### ~/.task-tracker.json

Created by `/init`. This is the only configuration file.

```json
{
  "vault_path": "/path/to/obsidian-vault",
  "subfolder": "task-tracker",
  "tag_rules": {
    "github.com": "#type/review",
    "docs.google.com": "#type/doc"
  }
}
```

| Field | Description |
|-------|-------------|
| `vault_path` | Absolute path to your Obsidian vault |
| `subfolder` | Subdirectory within the vault for task-tracker data |
| `tag_rules` | Custom URL-to-tag mapping rules (domain → tag) |

### Data Directory Structure

Created inside `{vault_path}/{subfolder}/`:

```
{vault_path}/{subfolder}/
├── inbox/              # Active tasks (one .md file per task)
├── done/               # Completed tasks (moved from inbox/)
├── daily/              # Daily completion logs (YYYY-MM-DD.md)
└── attachments/        # Screenshots and attachments
```

### Task File Format

Each task is a Markdown file with YAML front matter:

```markdown
---
id: "a3f2b1c8"
from: "Tanaka"
type: review/pr
tags:
  - "#proj/backend"
  - "#type/review"
urls:
  - https://github.com/org/repo/pull/123
source: "https://chat.google.com/room/xxx/thread/yyy"
deadline: "end of week"
created: "2026-01-31T10:30:00"
---

# PR: auth-refactor review

## Request
> Tanaka here. Please review this PR...

## Next
- [ ] Check the PR diff
- [ ] Confirm deadline
```

- **ID**: UUID v4, first 8 characters (e.g., `a3f2b1c8`)
- **Filename**: `{id}-{slug}.md` (e.g., `a3f2b1c8-pr-auth-refactor.md`)
- **Status**: Determined by folder location (`inbox/` or `done/`), not by a field

## Plugin Structure

```
plugins/task-tracker/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata
├── skills/
│   ├── task-add/
│   │   └── SKILL.md          # /add command
│   ├── task-done/
│   │   └── SKILL.md          # /done command
│   ├── task-list/
│   │   └── SKILL.md          # /list command
│   ├── task-init/
│   │   └── SKILL.md          # /init command
│   └── task-delete/
│       └── SKILL.md          # /delete command
├── hooks/
│   └── hooks.json            # SessionStart hook for config validation
├── scripts/
│   ├── setup.sh              # Directory setup
│   └── validate.sh           # Config and directory validation
├── README.md                 # This file (English)
└── README.ja.md              # Japanese version
```

## License

[MIT](../../LICENSE)
