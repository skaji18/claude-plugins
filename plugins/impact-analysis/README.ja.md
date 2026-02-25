> English version → [README.md](README.md)

# impact-analysis

[Claude Code](https://claude.com/claude-code) 用の LSP ベース コード影響分析プラグイン。LSP 参照チェーンの BFS 探索により、コード変更の影響範囲を機械的に追跡します。

**対応言語**: PHP, JavaScript, TypeScript

## 概要

関数・メソッド・クラスを変更する際、「この変更は他のどこに影響するか？」という問いに答えるプラグインです。

`impact` CLI（旧 `lsprefs` + `lsprefs-walk` 統合版）を使い、起点から参照チェーンを再帰的にたどり、以下を出力します:

- **evidence.tsv** — 発見した全影響パスの機械可読な証跡ログ
- **summary.md** — 重大な影響箇所をハイライトした人間向けレポート

## 分析パターン

### パターン A: コード起点

特定の関数名・メソッド名・クラス名を起点に、全参照を追跡します。

```
/impact-analysis getSignature メソッドを削除した場合の影響を調査
```

- **単一起点**（1つのシンボル）と**複数起点**（複数シンボル → merge で統合）に対応
- インターフェースメソッドは `--resolve-implementations` で具象実装も追跡可能

### パターン B: 仕様起点（STEP 0）

自然言語による機能変更の記述から、AI がコード箇所を特定し、機械的な追跡を実行します。

```
/impact-analysis Fixer の実行順序の決定ロジックを変更した場合の影響は？
```

1. AI がプロジェクト構造を分析し、関連コードを検索
2. 起点候補を特定し、自信度とともに提示
3. 確認後、通常の BFS 追跡（パターン A）を実行

### パターン C: クロスランゲージ

言語の境界をまたいだ影響追跡（例: PHP バックエンド → TypeScript フロントエンド）。

```
/impact-analysis /api/users エンドポイントのレスポンス形式が変更される。PHP とフロントエンド TS の両方で影響を追跡せよ。
```

1. 第1言語側（例: PHP）で影響追跡を実行
2. AI が橋渡しポイント（API エンドポイント、レスポンススキーマ、共有定数）を特定
3. 第2言語側（例: TypeScript）で対応コードを検索
4. 第2言語側で影響追跡を実行
5. `impact merge` で結果を統合

## 出力ファイル

### evidence.tsv

BFS 探索の全ステップを含むタブ区切りファイル。各行が1つの発見イベントを表します。

| カラム | 説明 |
|--------|------|
| `step` | 通し番号 |
| `depth` | BFS の深さ（0 = 起点） |
| `kind` | `NODE`（関数登録）、`REF`（参照発見）、`DEF`（呼び出し元特定） |
| `node_id` | ノード識別子（N0, N1, ...） |
| `parent_node_id` | 親ノード（起点は `-`） |
| `ref_id` | ノード内の参照 ID（r1, r2, ...） |
| `from_ref_id` | この DEF を生成した REF |
| `file` | ファイルパス（リポジトリルート相対） |
| `line` | 行番号（1ベース） |
| `col` | カラム番号（1ベース） |
| `snippet` | コード1行スニペット |
| `status` | `ok` / `merged` / `excluded` / `notfound` / `error` / `truncated` |
| `note` | 追加情報（enclosing callable 名、クラス名等） |

複数起点の統合時は `step` の次に `origin_id`（O1, O2, ...）カラムが追加されます。

### summary.md

以下を含む構造化された Markdown レポート:

- 調査概要（対象、パターン、パラメータ）
- 影響範囲サマリ（ファイル数、ノード数、最大深度）
- 重大な影響のピックアップ
- カテゴリ / ディレクトリ別の影響整理
- リスクと注意事項

## 対応言語

| 言語 | LSP サーバー | ファイル拡張子 |
|------|------------|--------------|
| PHP | `intelephense --stdio` | `.php` |
| JavaScript | `typescript-language-server --stdio` | `.js`, `.jsx`, `.mjs`, `.cjs` |
| TypeScript | `typescript-language-server --stdio` | `.ts`, `.tsx` |

LSP サーバーは起点ファイルの拡張子から自動判定されます。`impact server start` と `impact trace` の `--server` フラグで手動指定も可能です。

## 設定

主要パラメータ（config.json または CLI フラグで設定可能）:

| パラメータ | デフォルト | 説明 |
|-----------|----------|------|
| `root` | — | 対象リポジトリのパス（必須） |
| `max_depth` | `4` | BFS 最大探索深度 |
| `max_nodes` | `2000` | 最大ノード数 |
| `max_refs_per_node` | `300` | ノードあたりの最大参照数 |
| `exclude` | `vendor/**`, `.git/**`, `.cache/**`, `node_modules/**`, `tests/**` | 除外する glob パターン |
| `server` | （自動判定） | LSP サーバーコマンド |
| `resolve_implementations` | `false` | インターフェースメソッドの具象実装を LSP で解決 |

## 使用方法

Claude Code で `/impact-analysis` スキルを呼び出します:

```bash
# パターン A: コード起点
/impact-analysis getSignature メソッドを削除した場合の影響を調査

# パターン B: 仕様起点
/impact-analysis Fixer の実行順序の決定ロジックを変更した場合の影響は？

# パターン C: クロスランゲージ
/impact-analysis /api/users エンドポイントのレスポンス形式が変更される。PHP とフロントエンド TS の両方で影響を追跡せよ。
```

### 実行フロー

```
パターン A: STEP 1 → 2 → 3 → 4 → (4.5) → 5 → 6
パターン B: STEP 0 → 1 → 2 → 3 → 4 → (4.5) → 5 → 6
```

| ステップ | 説明 |
|---------|------|
| STEP 0 | 仕様 → コード箇所マッピング（パターン B のみ） |
| STEP 1 | リクエスト解析、起点特定、言語判定 |
| STEP 2 | impact server デーモンを適切な LSP サーバーで起動 |
| STEP 3 | impact trace 用の config.json を生成 |
| STEP 4 | impact trace で BFS 探索を実行 |
| STEP 4.5 | 複数の evidence ファイルを統合（複数起点の場合のみ） |
| STEP 5 | evidence.tsv を分析し、summary.md を生成 |
| STEP 6 | 結果をユーザーに報告 |

## 依存ツール

| ツール | インストール方法 | 用途 |
|--------|---------------|------|
| `impact` | `go install github.com/skaji18/devtools/cmd/impact@latest` | 統合 CLI（LSP クエリ、BFS 探索、merge、graph） |
| `intelephense` | `npm install -g intelephense` | PHP LSP サーバー |
| `typescript-language-server` | `npm install -g typescript-language-server typescript` | JS/TS LSP サーバー |
| `rg` (ripgrep) | [github.com/BurntSushi/ripgrep](https://github.com/BurntSushi/ripgrep) | コード検索 |

セットアップスクリプトで全依存をインストール:

```bash
bash scripts/setup.sh
```

インストール確認:

```bash
bash scripts/validate.sh
```

## プラグイン構造

```
plugins/impact-analysis/
├── .claude-plugin/
│   └── plugin.json          # プラグインメタデータ（名前、バージョン、作者）
├── commands/
│   └── impact-analysis.md   # スキルプロンプト（全パターン、STEP 0-6）
├── hooks/
│   └── hooks.json            # SessionStart フック（依存チェック）
├── scripts/
│   ├── setup.sh              # 全依存のインストール
│   └── validate.sh           # 全依存の存在確認
├── README.md                 # 英語版
└── README.ja.md              # このファイル（日本語版）
```

## ライセンス

[MIT](../../LICENSE)
