"""pg.__main__ -- CLI entry point for permission-guard package.

Usage:
    python -m pg hook      Run the permission fallback hook (reads stdin)
    python -m pg show      Display effective config
    python -m pg analyze   Analyze audit log
    python -m pg apply     Apply optimization proposals
"""

import sys


def main():
    if len(sys.argv) < 2:
        print("Usage: python -m pg <command>", file=sys.stderr)
        print("Commands: hook, file-hook, show, analyze, apply", file=sys.stderr)
        sys.exit(1)

    command = sys.argv[1]
    # Remove the subcommand from argv so each module sees clean args
    sys.argv = [sys.argv[0]] + sys.argv[2:]

    if command == "hook":
        from pg.fallback import main as hook_main
        hook_main()
    elif command == "file-hook":
        from pg.file_guard import main as file_hook_main
        file_hook_main()
    elif command == "show":
        from pg.show import main as show_main
        show_main()
    elif command == "analyze":
        from pg.analyze import main as analyze_main
        analyze_main()
    elif command == "apply":
        from pg.apply import main as apply_main
        apply_main()
    else:
        print(f"Unknown command: {command}", file=sys.stderr)
        print("Commands: hook, file-hook, show, analyze, apply", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
