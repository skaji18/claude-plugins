"""
gavel.path_check -- shared path normalization and containment checking.

Used by both the Bash command hook (fallback.py) and the file access hook (file_guard.py).
"""

import os


def detect_project_dir():
    """Detect project directory. Works in both Plugin and inline modes.

    Uses realpath to resolve symlinks (e.g. macOS /tmp -> /private/tmp)
    so that comparisons with realpath-resolved file paths are consistent.
    """
    env_dir = os.environ.get("CLAUDE_PROJECT_DIR")
    if env_dir:
        return os.path.realpath(env_dir)

    file_based = os.path.realpath(os.path.join(os.path.dirname(__file__), "../.."))
    if os.path.isdir(os.path.join(file_based, ".claude")):
        return file_based

    return os.path.realpath(os.getcwd())


def canonicalize_path(path):
    """Portable path normalization with symlink resolution."""
    return os.path.realpath(path).replace(os.sep, '/')


def is_path_within(abs_path, base_dir):
    """Check if abs_path is within base_dir (or is base_dir itself).

    Both paths should already be normalized/absolute.
    """
    norm_base = os.path.normpath(base_dir)
    norm_path = os.path.normpath(abs_path)
    return norm_path == norm_base or norm_path.startswith(norm_base + "/")


def check_path_containment(file_path, project_dir, allowed_dirs_extra):
    """Check if file_path is within project_dir or any allowed_dirs_extra.

    Args:
        file_path: The raw path to check (relative or absolute).
        project_dir: The project root directory (absolute).
        allowed_dirs_extra: List of additional allowed directories.

    Returns:
        (is_contained: bool, resolved_path: str)
    """
    if file_path.startswith('/'):
        resolved = canonicalize_path(file_path)
    else:
        resolved = canonicalize_path(os.path.join(project_dir, file_path))

    if is_path_within(resolved, project_dir):
        return True, resolved

    for extra_dir in (allowed_dirs_extra or []):
        if not extra_dir:
            continue
        resolved_extra = canonicalize_path(extra_dir)
        if is_path_within(resolved, resolved_extra):
            return True, resolved

    return False, resolved
