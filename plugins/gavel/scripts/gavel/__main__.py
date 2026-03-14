"""gavel.__main__ -- CLI entry point.

Usage:
    python -m gavel hook      Run the Bash validation hook (reads stdin)
    python -m gavel show      Display effective config
    python -m gavel analyze   Analyze audit log
    python -m gavel apply     Apply optimization proposals
"""

import sys


def main():
    if len(sys.argv) < 2:
        print("Usage: python -m gavel <command>", file=sys.stderr)
        print("Commands: hook, file-hook, show, analyze, apply", file=sys.stderr)
        sys.exit(1)

    command = sys.argv[1]
    # Remove the subcommand from argv so each module sees clean args
    sys.argv = [sys.argv[0]] + sys.argv[2:]

    if command == "hook":
        from gavel.fallback import main as hook_main
        hook_main()
    elif command == "file-hook":
        from gavel.file_guard import main as file_hook_main
        file_hook_main()
    elif command == "show":
        from gavel.show import main as show_main
        show_main()
    elif command == "analyze":
        from gavel.analyze import main as analyze_main
        analyze_main()
    elif command == "apply":
        from gavel.apply import main as apply_main
        apply_main()
    else:
        print(f"Unknown command: {command}", file=sys.stderr)
        print("Commands: hook, file-hook, show, analyze, apply", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
