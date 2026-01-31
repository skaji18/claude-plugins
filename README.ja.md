# claude-plugins

> English version → [README.md](README.md)

skaji18 による Claude Code プラグインコレクション。

## プラグイン一覧

| プラグイン | 説明 | バージョン |
|-----------|------|-----------|
| [impact-analysis](plugins/impact-analysis/) | コードの影響範囲を調査するスキル（PHP / JS / TS 対応） | 1.1.0 |

## 前提条件

- [Go](https://go.dev/dl/) 1.21+（lsprefs, lsprefs-walk 用）
- [Node.js](https://nodejs.org/) 18+（intelephense, typescript-language-server 用）
- [ripgrep](https://github.com/BurntSushi/ripgrep)（`rg`）
- [Claude Code](https://claude.com/claude-code) CLI

## インストール

### 1. セットアップスクリプトの実行

```bash
bash plugins/impact-analysis/scripts/setup.sh
```

以下のツールがインストールされます:

| ツール | インストール方法 | 用途 |
|--------|----------------|------|
| `lsprefs` | `go install` | LSP ベースの参照/定義検索デーモン |
| `lsprefs-walk` | `go install` | BFS ベースの影響範囲追跡ウォーカー |
| `intelephense` | `npm install -g` | PHP LSP サーバー |
| `typescript-language-server` | `npm install -g` | JS/TS LSP サーバー |

### 2. インストールの確認

```bash
bash plugins/impact-analysis/scripts/validate.sh
```

全チェックが `[OK]` になれば完了です。不足がある場合は `setup.sh` を再実行してください。

## プラグイン: impact-analysis

LSP ベースの BFS 探索を使って、コード変更の影響範囲を機械的に追跡するスキルです。`evidence.tsv`（機械可読な証跡一覧）と `summary.md`（人間用レポート）を出力します。

### 対応言語

| 言語 | LSP サーバーコマンド | ファイル拡張子 |
|------|-------------------|--------------|
| PHP | `intelephense --stdio` | `.php` |
| JavaScript | `typescript-language-server --stdio` | `.js`, `.jsx` |
| TypeScript | `typescript-language-server --stdio` | `.ts`, `.tsx` |

LSP サーバーは起点ファイルの拡張子から自動選択されます。

### 機能

- `lsprefs` / `lsprefs-walk` による BFS 探索で影響範囲を自動追跡
- 3つの調査パターン:
  - **パターンA（コード起点）**: 関数名・メソッド名・クラス名を指定して開始
  - **パターンB（仕様起点）**: 機能変更の自然言語記述から開始
  - **パターンC（言語間追跡）**: PHP ↔ JS/TS 間の API エンドポイント経由の影響波及を追跡
- 単一起点・複数起点・インターフェースメソッドの解決に対応
- `evidence.tsv` + `summary.md` を出力

### 使い方

Claude Code で `/impact-analysis` スキルを呼び出してください:

```bash
# パターンA: コード起点 — 関数名・メソッド名を指定
/impact-analysis getSignatureメソッドを削除した場合の影響を調査してください

# パターンB: 仕様起点 — 機能変更を自然言語で記述
/impact-analysis Fixerの実行順序の決定ロジックを変更した場合の影響は？

# パターンC: 言語間追跡 — PHP と JS/TS をまたぐ影響を追跡
/impact-analysis /api/users エンドポイントのレスポンス形式を変更する。PHP側とフロントTS側の両方の影響を調査
```

### プラグイン構成

```
plugins/impact-analysis/
├── .claude-plugin/
│   └── plugin.json          # プラグイン定義（名前、バージョン、依存関係）
├── skills/
│   └── impact-analysis/
│       └── SKILL.md          # スキルプロンプト（STEP 0-6、全パターン）
├── hooks/
│   └── hooks.json            # SessionStart フックで依存チェック実行
└── scripts/
    ├── setup.sh              # 全依存ツールのインストール
    └── validate.sh           # 全依存ツールの存在チェック
```

## Contributing

Issue や Pull Request は [github.com/skaji18/claude-plugins](https://github.com/skaji18/claude-plugins) にてお待ちしています。

## ライセンス

[MIT](LICENSE)
