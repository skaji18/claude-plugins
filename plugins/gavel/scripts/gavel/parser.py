"""
gavel.parser -- tree-sitter-bash based shell command parser.

Uses tree-sitter-bash for proper AST analysis including heredocs,
quoted strings, and special variables.

Parse failure → returns None (caller should fall back to "ask").
"""

import re
from dataclasses import dataclass, field
from typing import List, Optional

import tree_sitter_bash as tsbash
from tree_sitter import Language, Parser

# --- Parser setup ---

_BASH_LANGUAGE = Language(tsbash.language())
_parser = Parser(_BASH_LANGUAGE)


# --- Data structures (same interface as before) ---

@dataclass
class CommandInfo:
    """A single simple command extracted from the AST."""
    words: List[str]  # command name + args (quotes stripped)
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
    dangerous_nodes: List[str] = field(default_factory=list)
    is_compound: bool = False
    pipe_commands: List[List[CommandInfo]] = field(default_factory=list)


# --- Safe special variables ---

# These shell special variables are safe (read-only, no injection risk)
_SAFE_SPECIAL_VARS = {"?", "#", "$", "!", "-", "0", "_", "@", "*"}

# --- Glob detection ---

_GLOB_CHARS_RE = re.compile(r"[*?]")
_BRACKET_GLOB_RE = re.compile(r"\[.+\]")


def _has_unquoted_glob(node, source: bytes) -> bool:
    """Check if a node contains unquoted glob characters.

    tree-sitter-bash preserves quoting info:
    - raw_string ('...') and string ("...") nodes contain quoted text
    - plain word nodes contain unquoted text

    Only flag globs in plain word nodes, not in quoted strings.
    """
    t = node.type

    # Quoted strings: never glob
    if t in ("raw_string", "string"):
        return False

    # concatenation: check children individually
    if t == "concatenation":
        return any(_has_unquoted_glob(child, source) for child in node.children)

    # word node
    if t == "word":
        # If has children (expansions etc.), recurse
        if node.children:
            return any(_has_unquoted_glob(child, source) for child in node.children)
        # Pure word — check for glob chars
        text = source[node.start_byte:node.end_byte].decode()
        if _GLOB_CHARS_RE.search(text):
            return True
        if _BRACKET_GLOB_RE.search(text):
            return True

    return False


# --- Word text extraction ---

def _extract_word_text(node, source: bytes) -> str:
    """Extract the effective text from a word/string node, stripping quotes."""
    t = node.type
    text = source[node.start_byte:node.end_byte].decode()
    if t == "raw_string":
        return text[1:-1] if len(text) >= 2 else text
    if t == "string":
        return text[1:-1] if len(text) >= 2 else text
    if t == "concatenation":
        return "".join(_extract_word_text(c, source) for c in node.children)
    return text


# --- AST walker ---

def _walk(node, source: bytes, result: ParseResult):
    """Recursively walk tree-sitter AST."""
    t = node.type

    if t == "program":
        for child in node.children:
            if child.type == "&":
                result.dangerous_nodes.append("P1:background_execution")
            else:
                _walk(child, source, result)

    elif t == "command":
        _extract_command(node, source, result)

    elif t == "pipeline":
        result.is_compound = True
        pipe_group = []
        for child in node.children:
            if child.type == "command":
                cmd = _extract_command(child, source, result)
                if cmd:
                    pipe_group.append(cmd)
            elif child.type == "redirected_statement":
                cmd = _handle_redirected_statement(child, source, result)
                if cmd:
                    pipe_group.append(cmd)
            elif child.type not in ("|", "|&"):
                _walk(child, source, result)
        if pipe_group:
            result.pipe_commands.append(pipe_group)

    elif t == "list":
        result.is_compound = True
        for child in node.children:
            text = source[child.start_byte:child.end_byte].decode()
            if child.type in ("&&", "||", ";"):
                pass
            elif text == "&":
                result.dangerous_nodes.append("P1:background_execution")
            else:
                _walk(child, source, result)

    elif t == "redirected_statement":
        _handle_redirected_statement(node, source, result)

    elif t == "subshell":
        result.is_compound = True
        for child in node.children:
            if child.type not in ("(", ")"):
                _walk(child, source, result)

    elif t in ("if_statement", "while_statement", "for_statement",
               "compound_statement", "case_statement"):
        result.is_compound = True
        for child in node.children:
            _walk(child, source, result)

    else:
        for child in node.children:
            _walk(child, source, result)


def _handle_redirected_statement(node, source: bytes, result: ParseResult) -> Optional[CommandInfo]:
    """Handle a redirected_statement node (command + redirects)."""
    cmd_info = None
    for child in node.children:
        if child.type == "command":
            cmd_info = _extract_command(child, source, result)
        elif child.type == "file_redirect":
            _extract_file_redirect(child, source, result)
        elif child.type == "heredoc_redirect":
            pass  # Heredocs are inline input, not dangerous
        elif child.type == "pipeline":
            _walk(child, source, result)
        else:
            _walk(child, source, result)
    return cmd_info


def _extract_command(node, source: bytes, result: ParseResult) -> Optional[CommandInfo]:
    """Extract a command node into CommandInfo."""
    words = []

    for child in node.children:
        t = child.type

        if t == "command_name":
            for name_child in child.children:
                words.append(_extract_word_text(name_child, source))
                _check_dangerous_in_node(name_child, source, result)

        elif t in ("word", "raw_string", "string", "concatenation", "number"):
            words.append(_extract_word_text(child, source))
            _check_dangerous_in_node(child, source, result)
            if _has_unquoted_glob(child, source):
                if "P7:glob_chars" not in result.dangerous_nodes:
                    result.dangerous_nodes.append("P7:glob_chars")

        elif t == "variable_assignment":
            if "P5:env_assignment" not in result.dangerous_nodes:
                result.dangerous_nodes.append("P5:env_assignment")

        elif t == "simple_expansion":
            _check_expansion(child, source, result)

        elif t == "expansion":
            result.dangerous_nodes.append("P4:var_expansion")

        elif t == "command_substitution":
            text = source[child.start_byte:child.end_byte].decode()
            if text.startswith("`"):
                result.dangerous_nodes.append("P1:backtick_substitution")
            else:
                result.dangerous_nodes.append("P3:cmd_substitution")

        elif t == "file_redirect":
            _extract_file_redirect(child, source, result)

        elif t == "heredoc_redirect":
            pass  # Safe

    if not words:
        return None

    raw = source[node.start_byte:node.end_byte].decode().strip()
    cmd = CommandInfo(words=words, raw=raw)
    result.commands.append(cmd)
    return cmd


def _check_dangerous_in_node(node, source: bytes, result: ParseResult):
    """Recursively check a node for dangerous sub-nodes."""
    for child in node.children:
        t = child.type
        if t == "simple_expansion":
            _check_expansion(child, source, result)
        elif t == "expansion":
            result.dangerous_nodes.append("P4:var_expansion")
        elif t == "command_substitution":
            text = source[child.start_byte:child.end_byte].decode()
            if text.startswith("`"):
                result.dangerous_nodes.append("P1:backtick_substitution")
            else:
                result.dangerous_nodes.append("P3:cmd_substitution")
        elif child.children:
            _check_dangerous_in_node(child, source, result)


def _check_expansion(node, source: bytes, result: ParseResult):
    """Check a simple_expansion ($VAR, $?, etc.) for safety."""
    for child in node.children:
        if child.type == "special_variable_name":
            var_name = source[child.start_byte:child.end_byte].decode()
            if var_name in _SAFE_SPECIAL_VARS:
                return  # Safe: $?, $#, $!, etc.
            result.dangerous_nodes.append("P4:var_expansion")
            return
        elif child.type == "variable_name":
            result.dangerous_nodes.append("P4:var_expansion")
            return
        elif child.type == "$":
            pass  # The $ sign itself
        else:
            result.dangerous_nodes.append("P4:var_expansion")
            return


def _extract_file_redirect(node, source: bytes, result: ParseResult):
    """Extract redirect info from a file_redirect node."""
    redir_type = None
    path = None
    fd_dup = False

    for child in node.children:
        t = child.type
        if t in (">", ">>", "<", ">&", "<&", ">|"):
            redir_type = t
        elif t in ("word", "raw_string", "string", "concatenation"):
            text = _extract_word_text(child, source)
            if redir_type == ">&" and text.isdigit():
                fd_dup = True
                path = ""
            else:
                path = text
            _check_dangerous_in_node(child, source, result)
        elif t == "number":
            pass  # fd number before operator (e.g., 2>)
        elif t == "simple_expansion":
            _check_expansion(child, source, result)
            path = source[child.start_byte:child.end_byte].decode()

    if redir_type and path is not None:
        result.redirects.append(RedirectInfo(
            redirect_type=redir_type, path=path, fd_dup=fd_dup
        ))
    elif redir_type and fd_dup:
        result.redirects.append(RedirectInfo(
            redirect_type=redir_type, path="", fd_dup=True
        ))


# --- Public API ---

def parse_command(command: str) -> Optional[ParseResult]:
    """Parse a shell command string into a structured ParseResult.

    Returns None if the command cannot be parsed.
    """
    if not command or not command.strip():
        return None

    source = command.encode()

    try:
        tree = _parser.parse(source)
    except Exception:
        return None

    root = tree.root_node

    # tree-sitter has error recovery, but if there are errors
    # fall back to ask for safety
    if root.has_error:
        return None

    result = ParseResult()
    _walk(root, source, result)

    return result
