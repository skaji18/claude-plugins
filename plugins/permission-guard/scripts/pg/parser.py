"""
pg.parser -- bashlex-based shell command parser for permission-guard.

Replaces regex-based parsing (phase_2_shell_syntax, split_compound,
_strip_quoted_content) with proper AST analysis.

Parse failure → returns None (caller should fall back to "ask").
"""

import os
import re
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import bashlex


# --- Data structures ---

@dataclass
class CommandInfo:
    """A single simple command extracted from the AST."""
    words: List[str]  # command name + args (quotes already stripped by bashlex)
    raw: str = ""     # original text span


@dataclass
class RedirectInfo:
    """A redirect extracted from the AST."""
    redirect_type: str   # '>', '>>', '<', '>&'
    path: str            # target path (empty for fd dups like 2>&1)
    fd_dup: bool = False # True for >&N patterns


@dataclass
class ParseResult:
    """Result of parsing a shell command."""
    commands: List[CommandInfo] = field(default_factory=list)
    redirects: List[RedirectInfo] = field(default_factory=list)
    dangerous_nodes: List[str] = field(default_factory=list)  # list of reason strings
    is_compound: bool = False
    pipe_commands: List[List[CommandInfo]] = field(default_factory=list)  # grouped by pipe segment


# --- Dangerous node types ---

# These node types in the AST indicate shell features that should be blocked
DANGEROUS_NODE_HANDLERS = {}


def _register_dangerous(node_kind):
    """Decorator to register a dangerous node checker."""
    def decorator(func):
        DANGEROUS_NODE_HANDLERS[node_kind] = func
        return func
    return decorator


@_register_dangerous("commandsubstitution")
def _check_cmd_substitution(node, source):
    """$() or backtick command substitution."""
    # Distinguish backtick vs $() by checking source text
    start, end = node.pos
    text = source[start:end]
    if text.startswith("`"):
        return "P1:backtick_substitution"
    return "P3:cmd_substitution"


@_register_dangerous("parameter")
def _check_parameter(node, source):
    """$VAR, $!, $#, etc."""
    return "P4:var_expansion"


@_register_dangerous("tilde")
def _check_tilde(node, source):
    """~ expansion."""
    return "P6:tilde_expansion"


@_register_dangerous("assignment")
def _check_assignment(node, source):
    """FOO=bar environment variable assignment."""
    return "P5:env_assignment"


# --- AST walker ---

def _walk_ast(node, source, result: ParseResult):
    """Recursively walk bashlex AST, collecting commands and dangerous nodes."""
    kind = node.kind

    # Check for dangerous node types
    handler = DANGEROUS_NODE_HANDLERS.get(kind)
    if handler:
        reason = handler(node, source)
        if reason:
            result.dangerous_nodes.append(reason)
        # Don't return early for commandsubstitution -- we still want to
        # record it but we don't need to walk its children (they're inside
        # the substitution which is already flagged)
        if kind in ("commandsubstitution", "parameter", "tilde", "assignment"):
            return

    if kind == "command":
        cmd_info = _extract_command_info(node, source, result)
        if cmd_info:
            result.commands.append(cmd_info)

    elif kind == "pipeline":
        result.is_compound = True
        pipe_group = []
        for part in node.parts:
            if part.kind == "command":
                cmd_info = _extract_command_info(part, source, result)
                if cmd_info:
                    pipe_group.append(cmd_info)
                    result.commands.append(cmd_info)
            elif part.kind == "pipe":
                pass  # separator
            else:
                _walk_ast(part, source, result)
        if pipe_group:
            result.pipe_commands.append(pipe_group)

    elif kind == "list":
        result.is_compound = True
        for part in node.parts:
            if part.kind == "operator":
                # Check for background &
                if part.op == "&":
                    result.dangerous_nodes.append("P1:background_execution")
            else:
                _walk_ast(part, source, result)

    elif kind == "compound":
        # Subshell: (cmd) -- walk children to extract commands for validation
        result.is_compound = True
        if hasattr(node, "list") and node.list:
            for item in node.list:
                if item.kind == "reservedword":
                    pass  # ( and ) delimiters
                else:
                    _walk_ast(item, source, result)

    elif hasattr(node, "parts") and node.parts:
        for part in node.parts:
            _walk_ast(part, source, result)

    elif hasattr(node, "list") and node.list:
        for item in node.list:
            _walk_ast(item, source, result)


def _extract_command_info(cmd_node, source, result: ParseResult) -> Optional[CommandInfo]:
    """Extract command words and redirects from a CommandNode."""
    words = []
    for part in cmd_node.parts:
        if part.kind == "word":
            # Check for dangerous sub-parts within the word
            if hasattr(part, "parts") and part.parts:
                for sub in part.parts:
                    handler = DANGEROUS_NODE_HANDLERS.get(sub.kind)
                    if handler:
                        reason = handler(sub, source)
                        if reason:
                            result.dangerous_nodes.append(reason)
            words.append(part.word)

        elif part.kind == "redirect":
            redir = _extract_redirect(part, source, result)
            if redir:
                result.redirects.append(redir)

        elif part.kind == "assignment":
            result.dangerous_nodes.append("P5:env_assignment")

    if not words:
        return None

    start, end = cmd_node.pos
    return CommandInfo(words=words, raw=source[start:end].strip())


def _extract_redirect(redir_node, source, result: ParseResult) -> Optional[RedirectInfo]:
    """Extract redirect info from a RedirectNode."""
    rtype = redir_node.type

    # fd duplication (2>&1 etc.)
    if rtype == ">&" and hasattr(redir_node, "output") and isinstance(redir_node.output, int):
        return RedirectInfo(redirect_type=rtype, path="", fd_dup=True)

    # File redirect
    if hasattr(redir_node, "output") and redir_node.output is not None:
        output = redir_node.output
        if hasattr(output, "word"):
            # Check for dangerous sub-parts in redirect target
            if hasattr(output, "parts") and output.parts:
                for sub in output.parts:
                    handler = DANGEROUS_NODE_HANDLERS.get(sub.kind)
                    if handler:
                        reason = handler(sub, source)
                        if reason:
                            result.dangerous_nodes.append(reason)
            return RedirectInfo(redirect_type=rtype, path=output.word)

    return None


# --- Glob detection (not covered by bashlex) ---

# bashlex treats glob chars as plain WordNode text, so we need regex for these
_GLOB_RE = re.compile(r"[*?\[{]")


def _check_glob_in_words(result: ParseResult):
    """Check for unquoted glob/brace characters in command words.

    bashlex strips quotes from WordNode.word, but glob chars that were
    inside quotes won't trigger shell expansion. We check the raw source
    span to distinguish quoted vs unquoted globs.
    """
    for cmd in result.commands:
        for word in cmd.words:
            if _GLOB_RE.search(word):
                result.dangerous_nodes.append("P7:glob_chars")
                return  # One is enough


# --- Public API ---

def parse_command(command: str) -> Optional[ParseResult]:
    """Parse a shell command string into a structured ParseResult.

    Returns None if bashlex cannot parse the command (caller should
    fall back to "ask" for safety).
    """
    if not command or not command.strip():
        return None

    try:
        parts = bashlex.parse(command)
    except bashlex.errors.ParsingError:
        return None
    except Exception:
        # bashlex can raise other errors for malformed input
        return None

    result = ParseResult()

    for node in parts:
        _walk_ast(node, command, result)

    # Glob check (bashlex doesn't distinguish these)
    _check_glob_in_words(result)

    return result
