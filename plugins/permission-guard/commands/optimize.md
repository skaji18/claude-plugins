---
description: Analyze permission-guard decision log and suggest config optimizations
---

Analyze the permission-guard decision log to identify frequently-asked commands
and suggest config changes to reduce unnecessary prompts.

**Step 1: Read the decision log**

Log path (in priority order):
1. `audit_log_path` from `${CLAUDE_PROJECT_DIR}/.claude/permission-guard.yaml` (if set)
2. `${CLAUDE_PLUGIN_ROOT}/logs/decisions.jsonl` (default)

If the log file does not exist or has fewer than 10 entries:
→ Report "Insufficient data (need at least 10 log entries). Use Claude Code for a while first."
→ Stop here.

**Step 2: Analyze**

Parse each JSONL line (fields: ts, decision, command, phase, reason).

Compute:
- Total entries, period (first ts → last ts)
- Breakdown: allow / ask / deny counts
- For `decision=ask`: group by `command` (first word), count occurrences

Identify candidates (command appeared as `ask` 5 or more times):
- Simple commands (no subcommands in reason): propose `tools_add: {cmd: "allow"}`
- Commands with subcommand pattern in reason: propose map entry with `ask` list

**Step 3: Display analysis and proposal**

```
📊 Permission log analysis
Period: 2026-02-01 → 2026-02-27  (312 decisions)
allow: 280 / ask: 30 / deny: 2

🔧 Optimization suggestions (commands asked 5+ times):

1. bun — asked 12 times → suggest adding as allow
2. deno — asked 8 times → suggest adding as allow
3. terraform destroy — asked 6 times (subcommand pattern) → suggest adding to ask list

Proposed tools_add for .claude/permission-guard.yaml:
---
tools_add:
  bun: "allow"
  deno: "allow"
  terraform:
    ask: ["destroy", "apply"]
    default: "ask"
---
```

**Step 4: Apply (with user approval)**

Ask the user: "Apply these suggestions to .claude/permission-guard.yaml? (yes/no)"

If yes:
- Read current `${CLAUDE_PROJECT_DIR}/.claude/permission-guard.yaml`
- Merge proposed entries into `tools_add` section (don't overwrite existing entries)
- Write updated file
- Report: "Updated. Run /permission-guard:show to verify."

If no:
- Report: "No changes made."
