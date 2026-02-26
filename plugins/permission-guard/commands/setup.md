---
description: Set up permission-guard — create venv, install deps, and generate user config template
---

Set up permission-guard for this project.

**Step 1: Create venv and install dependencies**
```bash
cd "${CLAUDE_PLUGIN_ROOT}"
python3 -m venv .venv
.venv/bin/pip install --quiet pyyaml
chmod +x "${CLAUDE_PLUGIN_ROOT}/scripts/permission-fallback"
```

**Step 2: Generate user config template**

Check if `${CLAUDE_PROJECT_DIR}/.claude/permission-guard.yaml` already exists.
- If it exists: skip this step and report "User config already exists".
- If not: create it with the following content:

```yaml
# permission-guard user config
# Run /permission-guard:show to see effective settings (defaults + your overrides)

tools_add: {}
tools_remove: []
pipe_deny_right_add: []
allowed_dirs_extra: []
audit_log_path: ""
```

**Step 3: Run tests**
```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/test-permission.sh"
```

Report the test results (pass/fail count). Setup is complete when all tests pass.
