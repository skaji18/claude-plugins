# gantt-viewer

A Claude Code plugin that provides interactive Gantt chart visualization from YAML-defined project schedules. Supports critical path analysis, delay detection, assignee workload view, and responsive mobile display.

## Features

- **Interactive Gantt chart**: Browser-based HTML viewer with day/week/month zoom levels
- **Critical path analysis**: Automatically identifies and highlights the critical path
- **Delay detection**: Flags tasks past their end date with incomplete progress
- **Filters**: Filter by assignee, group, status (delayed / critical path only)
- **Summary panel**: At-a-glance metrics for overall progress, delayed tasks, and critical path remaining days
- **Assignee workload view**: Visualize per-person task load across the timeline
- **Dependency arrows**: Renders dependency links between tasks; double-click to highlight a full dependency chain
- **Milestone tracking**: Diamond markers with remaining-days badges
- **Responsive design**: Drawer-based sidebar and pinch-zoom on mobile devices
- **CLI checks**: `check` command for YAML validation, `show` command for text-based summary

## Installation

```
/plugin install gantt-viewer@skaji18-plugins
```

## Commands

### `/gantt-viewer:init`

Generates a `gantt.yaml` template file into your project directory. Interactively asks for the output directory and YAML filename. HTML/JS files are managed internally by the plugin -- you only need to maintain the YAML file.

### `/gantt-viewer:open <yaml-path> [--serve]`

Generates a self-contained HTML file from the specified YAML and opens it in the default browser. No HTTP server required -- the HTML includes all JavaScript and data inline, with no external dependencies.

With the `--serve` flag, instead of opening a browser directly, it starts an HTTP server via `npx serve` and displays the URL. This is useful when working over SSH or in environments where a local browser cannot be launched.

### `/gantt-viewer:show <yaml-path>`

Outputs a text-based status summary of the project including task count, overall progress, critical path, and delayed tasks.

### `/gantt-viewer:check <yaml-path>`

Runs integrity checks on the YAML file and reports errors/warnings:

- Dependency violations (task starts before its dependency ends)
- Date contradictions (start_date > end_date)
- Invalid references (depends_on references a non-existent ID)
- Delayed tasks (end_date past today with progress < 100%)
- Critical path calculation

## YAML Schema

```yaml
project:
  name: "Project Name"

tasks:
  - id: "task-id"           # string -- unique task identifier
    name: "Task Name"       # string -- display name
    assignee: "Name"        # string -- person responsible
    effort: 5               # number -- estimated effort in days
    start_date: "2026-04-01"  # string (YYYY-MM-DD) -- planned start
    end_date: "2026-04-10"    # string (YYYY-MM-DD) -- planned end
    progress: 50             # number (0-100) -- completion percentage
    depends_on: ["other-id"] # string[] -- IDs of prerequisite tasks
    group: "Group Name"      # string -- grouping label (displayed as collapsible sections)
    milestone: false         # boolean -- true renders a diamond marker instead of a bar
```

### Field details

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier used in `depends_on` references |
| `name` | string | Human-readable task name |
| `assignee` | string | Person assigned to the task; used for workload view and filters |
| `effort` | number | Estimated working days (informational) |
| `start_date` | string | Planned start date in `YYYY-MM-DD` format |
| `end_date` | string | Planned end date in `YYYY-MM-DD` format |
| `progress` | number | Completion percentage (0--100) |
| `depends_on` | string[] | List of task IDs that must complete before this task starts |
| `group` | string | Logical grouping; tasks with the same group are displayed together |
| `milestone` | boolean | When `true`, displayed as a diamond marker on the chart |

## Viewing the Chart

After running `/gantt-viewer:init`, use the `open` command to view the chart:

```
/gantt-viewer:open ./gantt/gantt.yaml
```

This generates a self-contained HTML file and opens it in your default browser. No HTTP server is needed.

## Requirements

- Node.js (for `check`, `show`, and `open` commands)
