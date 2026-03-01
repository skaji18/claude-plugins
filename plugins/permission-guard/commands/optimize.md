---
description: Analyze permission-guard decision log and suggest config optimizations
---

**Step 1: Run analysis script**

```bash
"${CLAUDE_PLUGIN_ROOT}/.venv/bin/python3" "${CLAUDE_PLUGIN_ROOT}/scripts/analyze-log" --format=json
```

If the script exits with code 1, display the error message and stop.

**Step 2: Present results**

Parse the JSON output and display the analysis to the user:
- Period, total decisions, allow/ask/deny breakdown
- Optimization candidates (commands asked 5+ times)

**Step 3: Ask the user for each candidate**

For each candidate, ask: "Apply to [G]lobal (~/.claude/) or [P]roject (.claude/) config? Or [S]kip?"

**Step 4: Apply selections**

For each non-skipped candidate, run:

```bash
"${CLAUDE_PLUGIN_ROOT}/.venv/bin/python3" "${CLAUDE_PLUGIN_ROOT}/scripts/apply-config" \
  --target <global|project> \
  --proposals '<json of selected proposals>'
```

Display the script's output. Suggest running `/permission-guard:show` to verify.
