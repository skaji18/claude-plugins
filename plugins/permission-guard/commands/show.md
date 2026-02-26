---
description: Show effective permission-guard config — defaults merged with user overrides, with diff markers
---

Display the effective permission-guard configuration (defaults.yaml merged with
${CLAUDE_PROJECT_DIR}/.claude/permission-guard.yaml).

**Step 1: Read config files**

Read both files:
- Defaults: `${CLAUDE_PLUGIN_ROOT}/config/defaults.yaml`
- User config: `${CLAUDE_PROJECT_DIR}/.claude/permission-guard.yaml` (may not exist)

**Step 2: Compute diff**

Compare user config against defaults to identify:
- `tools_add` entries: mark as `[+name]` in allow/ask lists or `[user-added]` for rule entries
- `tools_remove` entries: mark as `[-name]` in allow/ask lists
- `pipe_deny_right_add` entries: mark as `[+name]`

**Step 3: Display in this format**

```
📋 Effective permission-guard config

━━ tools (allow) ━━
ls, cat, head, tail, wc, sort, uniq, cut, grep, rg, sed, awk, jq, yq, echo, printf,
date, basename, dirname, realpath, stat, file, which, type, whoami, uname, hostname,
pwd, tree, du, df, make, cargo, gcc, go, rustc, diff
[+bun] [-tee]   ← user additions/removals if any

━━ tools (ask) ━━
curl, wget, ssh, scp, rsync, nc, rm, rmdir, mv, cp, find, chmod, chown, pip, pip3
[+terraform]    ← user additions if any

━━ tools (rules) ━━
git:    ask=[push, clean, filter-branch, rebase, reset]  flags=[--force, -f, --hard, -D, --no-verify]  default=allow
docker: ask=[rm, kill, exec, run, build, push, system prune]  flags=[--force, -f]  default=ask
gh:     ask=[pr merge, pr close, ...]  default=ask
npm:    ask=[install, publish, uninstall]  flags=[--force]  default=ask
[user-added: bun: ask=[publish] default=ask]  ← if user added rule entries

━━ pipe_deny_right ━━
bash, sh, zsh, ksh, fish, csh, tcsh, python, python3, perl, ruby, node, eval, exec, xargs
[+lua]  ← user additions if any

━━ other ━━
allowed_dirs_extra: (none)
audit_log: ${CLAUDE_PLUGIN_ROOT}/logs/decisions.jsonl (default)
```

If no user config file exists, note: "(no user config — showing defaults only)"
