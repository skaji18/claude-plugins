---
description: Run permission-guard validation tests to verify hook functionality
---

Run the permission-guard E2E test suite to verify the hook is working correctly.

Execute the test script:
```
PYTHONPATH="${CLAUDE_PLUGIN_ROOT}/scripts" "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python3" "${CLAUDE_PLUGIN_ROOT}/scripts/test_e2e.py"
```

Report the results showing pass/fail count. If any tests fail, investigate the cause.
