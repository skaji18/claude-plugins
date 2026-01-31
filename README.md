# claude-plugins

Claude Code plugins collection by skaji18.

## Plugins

| Plugin | Description |
|--------|-------------|
| [impact-analysis](plugins/impact-analysis/) | PHPコードの影響範囲を調査するスキル |

## Installation

### 1. Setup dependencies

```bash
bash plugins/impact-analysis/scripts/setup.sh
```

This will install:
- `phprefs` — PHP reference lookup tool
- `phprefs-walk` — BFS-based impact analysis walker
- `intelephense` — PHP LSP server (if not already installed)

### 2. Verify installation

```bash
bash plugins/impact-analysis/scripts/validate.sh
```

## Plugin: impact-analysis

PHPコードの影響範囲を機械的に追跡するスキルです。

### Features

- `phprefs` / `phprefs-walk` による BFS 探索で影響範囲を自動追跡
- コード起点（関数名・メソッド名指定）と仕様起点（自然言語での機能記述）の両方に対応
- 単一起点・複数起点・インターフェースメソッドの各パターンをサポート
- `evidence.tsv`（機械可読な証跡一覧）と `summary.md`（人間用レポート）を出力

### Prerequisites

- Go (for phprefs, phprefs-walk)
- Node.js (for intelephense)
- ripgrep (`rg`)

### Usage

Claude Code で `/impact-analysis` スキルを呼び出してください。

```
/impact-analysis getSignatureメソッドを削除した場合の影響を調査してください
```

## License

MIT
