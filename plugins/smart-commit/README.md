# smart-commit

A Claude Code plugin that generates commit messages using LLM from `git diff`, automatically appends `Co-Authored-By`, and commits in one command.

## Features

- **Auto message generation**: Analyzes `git diff --staged` and generates a commit message
- **Co-Authored-By**: Automatically appended to every commit
- **Style-aware**: Adapts message language (Japanese/English) based on commit history
- **Manual mode**: Use `-m "message"` to specify your own message (Co-Authored-By still added)
- **Push support**: `--push` flag to push after commit

## Usage

```
/commit                    # Auto-generate commit message
/commit -m "feat: add X"   # Manual message (Co-Authored-By auto-added)
/commit --push             # Commit and push
```

## Commit Message Format

```
<type>: <summary (under 50 chars)>

<optional body>

Co-Authored-By: Claude <noreply@anthropic.com>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`

## Requirements

- git installed
- Run in a git repository
