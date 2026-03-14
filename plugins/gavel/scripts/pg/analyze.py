"""pg.analyze -- Parse gavel audit log and identify optimization candidates."""

import json
import os
import sys
from collections import Counter

from pg.config import get_all_audit_log_paths

MIN_ENTRIES = 10
MIN_ASK_COUNT = 5


def _collect_log_paths():
    """Collect all unique audit log paths from defaults/global/project configs."""
    return get_all_audit_log_paths()


def _read_log(path):
    """Read JSONL entries from a single log file."""
    entries = []
    if not path or not os.path.exists(path):
        return entries
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return entries


def main():
    fmt = "text"
    if "--format=json" in sys.argv:
        fmt = "json"

    log_paths = _collect_log_paths()
    entries = []
    sources = []
    for p in log_paths:
        found = _read_log(p)
        if found:
            entries.extend(found)
            sources.append(f"{p} ({len(found)} entries)")

    if not entries:
        if fmt == "json":
            print(json.dumps({"error": "log_not_found", "paths": log_paths}))
        else:
            print(f"No log files found. Checked: {', '.join(log_paths) or '(no path configured)'}")
        sys.exit(1)

    if len(entries) < MIN_ENTRIES:
        if fmt == "json":
            print(json.dumps({"error": "insufficient_data", "count": len(entries), "min": MIN_ENTRIES}))
        else:
            print(f"Insufficient data ({len(entries)} entries, need at least {MIN_ENTRIES}). Use Claude Code for a while first.")
        sys.exit(1)

    # Compute statistics
    timestamps = [e.get("ts", "") for e in entries if e.get("ts")]
    period_from = min(timestamps) if timestamps else ""
    period_to = max(timestamps) if timestamps else ""

    allow_count = sum(1 for e in entries if e.get("decision") == "allow")
    ask_count = sum(1 for e in entries if e.get("decision") == "ask")
    deny_count = sum(1 for e in entries if e.get("decision") == "deny")

    # Group ask decisions by command (first word)
    ask_commands = Counter()
    ask_reasons = {}
    for e in entries:
        if e.get("decision") != "ask":
            continue
        cmd = e.get("command", "")
        first_word = cmd.split()[0] if cmd.strip() else ""
        if not first_word:
            continue
        basename = os.path.basename(first_word)
        ask_commands[basename] += 1
        reason = e.get("reason", "")
        if basename not in ask_reasons:
            ask_reasons[basename] = Counter()
        ask_reasons[basename][reason] += 1

    # Build candidates (asked >= MIN_ASK_COUNT times)
    candidates = []
    for cmd, count in ask_commands.most_common():
        if count < MIN_ASK_COUNT:
            break
        reasons = ask_reasons.get(cmd, {})
        # Check if it's a subcommand pattern
        subcommand_reasons = [r for r in reasons if "ask_subcommand:" in r]
        if subcommand_reasons:
            # Extract subcommands from reasons
            subs = set()
            for r in subcommand_reasons:
                parts = r.split(":")
                if len(parts) >= 3:
                    subs.add(parts[2])
            proposal = {cmd: {"ask": sorted(subs), "default": "ask"}}
            candidates.append({
                "command": cmd,
                "count": count,
                "type": "subcommand",
                "proposal": proposal,
            })
        else:
            proposal = {cmd: "allow"}
            candidates.append({
                "command": cmd,
                "count": count,
                "type": "simple",
                "proposal": proposal,
            })

    result = {
        "period": {"from": period_from[:10], "to": period_to[:10]},
        "total": len(entries),
        "breakdown": {"allow": allow_count, "ask": ask_count, "deny": deny_count},
        "candidates": candidates,
    }

    if sources:
        result["sources"] = sources

    if fmt == "json":
        print(json.dumps(result, indent=2))
    else:
        print(f"Permission log analysis")
        for s in sources:
            print(f"  source: {s}")
        print(f"Period: {result['period']['from']} -> {result['period']['to']}  ({result['total']} decisions)")
        print(f"allow: {allow_count} / ask: {ask_count} / deny: {deny_count}")
        print()
        if candidates:
            print(f"Optimization suggestions (commands asked {MIN_ASK_COUNT}+ times):")
            print()
            for i, c in enumerate(candidates, 1):
                if c["type"] == "simple":
                    print(f"  {i}. {c['command']} -- asked {c['count']} times -> suggest adding as allow")
                else:
                    subs = c["proposal"][c["command"]].get("ask", [])
                    print(f"  {i}. {c['command']} -- asked {c['count']} times (subcommand pattern) -> suggest ask list: [{', '.join(subs)}]")
            print()
            print("Proposed tools_add:")
            print("---")
            print("tools_add:")
            for c in candidates:
                name = c["command"]
                val = c["proposal"][name]
                if isinstance(val, str):
                    print(f'  {name}: "{val}"')
                else:
                    print(f"  {name}:")
                    if val.get("ask"):
                        print(f"    ask: {json.dumps(val['ask'])}")
                    if val.get("default"):
                        print(f'    default: "{val["default"]}"')
            print("---")
        else:
            print("No optimization suggestions (no command was asked 5+ times).")


if __name__ == "__main__":
    main()
