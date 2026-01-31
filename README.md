# claude-plugins

Claude Code plugins collection by skaji18.

## Plugins

| Plugin | Description |
|--------|-------------|
| [impact-analysis](plugins/impact-analysis/) | コードの影響範囲を調査するスキル（PHP / JS / TS 対応） |

## Installation

### 1. Setup dependencies

```bash
bash plugins/impact-analysis/scripts/setup.sh
```

This will install:
- `lsprefs` — LSP-based reference lookup tool
- `lsprefs-walk` — BFS-based impact analysis walker
- `intelephense` — PHP LSP server (if not already installed)
- `typescript-language-server` — JS/TS LSP server (if not already installed)

### 2. Verify installation

```bash
bash plugins/impact-analysis/scripts/validate.sh
```

## Plugin: impact-analysis

コードの影響範囲を機械的に追跡するスキルです。

### Supported Languages

| Language | LSP Server |
|----------|-----------|
| PHP | intelephense |
| JavaScript | typescript-language-server |
| TypeScript | typescript-language-server |

### Features

- `lsprefs` / `lsprefs-walk` による BFS 探索で影響範囲を自動追跡
- コード起点（関数名・メソッド名指定）と仕様起点（自然言語での機能記述）の両方に対応
- 単一起点・複数起点・インターフェースメソッドの各パターンをサポート
- 言語間追跡（クロスランゲージ）: PHP → JS/TS 間の影響波及を追跡可能
- `evidence.tsv`（機械可読な証跡一覧）と `summary.md`（人間用レポート）を出力

### Prerequisites

- Go (for lsprefs, lsprefs-walk)
- Node.js (for intelephense, typescript-language-server)
- ripgrep (`rg`)

### Usage

Claude Code で `/impact-analysis` スキルを呼び出してください。

```
/impact-analysis getSignatureメソッドを削除した場合の影響を調査してください
```

起点ファイルの拡張子から LSP サーバーが自動選択されます。

## License

MIT
