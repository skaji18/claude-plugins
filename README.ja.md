# claude-plugins

> English version → [README.md](README.md)

skaji18 による Claude Code プラグインコレクション。

## プラグイン一覧

| プラグイン | 説明 | バージョン |
|-----------|------|-----------|
| [impact-analysis](plugins/impact-analysis/) | コードの影響範囲を調査するスキル（PHP / JS / TS 対応） | 1.1.0 |
| [task-tracker](plugins/task-tracker/) | Obsidian 互換タスク管理プラグイン | 1.0.0 |
| [permission-guard](plugins/permission-guard/) | 8フェーズ Bash コマンド検証フック | 1.0.0 |

## 前提条件

- [Claude Code](https://claude.com/claude-code) CLI

### impact-analysis

- [Go](https://go.dev/dl/) 1.21+（lsprefs, lsprefs-walk 用）
- [Node.js](https://nodejs.org/) 18+（intelephense, typescript-language-server 用）
- [ripgrep](https://github.com/BurntSushi/ripgrep)（`rg`）

### task-tracker

- [Obsidian](https://obsidian.md/) Vault（ローカルディレクトリ）

### permission-guard

- [Python 3](https://www.python.org/)（必須）
- [PyYAML](https://pypi.org/project/PyYAML/)（任意・設定カスタマイズ用）

## インストール

### impact-analysis

```bash
# 依存ツールのインストール
bash plugins/impact-analysis/scripts/setup.sh

# インストールの確認
bash plugins/impact-analysis/scripts/validate.sh
```

### task-tracker

```bash
# 設定ファイルとディレクトリの作成
bash plugins/task-tracker/scripts/setup.sh

# セットアップの確認
bash plugins/task-tracker/scripts/validate.sh
```

### permission-guard

Claude Code でセットアップスキルを実行してください:

```
/permission-guard:setup
```

対話形式で設定する場合は、Claude Code で `/init` コマンドを実行してください。

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

```bash
/impact-analysis getSignatureメソッドを削除した場合の影響を調査してください
/impact-analysis Fixerの実行順序の決定ロジックを変更した場合の影響は？
/impact-analysis /api/users エンドポイントのレスポンス形式を変更する。PHP側とフロントTS側の両方の影響を調査
```

詳細は [plugins/impact-analysis/README.md](plugins/impact-analysis/) を参照してください。

## プラグイン: task-tracker

業務タスク（レビュー/確認/調査/設計実装）を Obsidian 互換の Markdown ファイルで管理するプラグインです。チャット依頼を貼るだけでタスク登録・完了記録・一覧表示ができます。

### 機能

- **AI によるキャプチャ**: チャットのメッセージを貼るだけで、依頼者・種別・タグ・期限・URL を自動抽出
- **Obsidian ネイティブ**: YAML front matter 付きの Markdown ファイルとして Vault に保存
- **フォルダベースのステータス**: `inbox/` = 未完了、`done/` = 完了
- **デイリーログ**: タスク完了時に自動記録

### コマンド

| コマンド | 用途 |
|---------|------|
| `/init` | 初期設定 |
| `/add` | タスク登録 |
| `/done` | タスク完了 |
| `/list` | タスク一覧表示 |
| `/delete` | タスク削除 |

詳細は [plugins/task-tracker/README.md](plugins/task-tracker/) を参照してください。

## プラグイン: permission-guard

`PermissionRequest` イベントをインターセプトする 8 フェーズ Bash コマンド検証フックです。安全なコマンドを自動承認し、危険なパターンをユーザーダイアログ前にブロックします。

### 機能

- **8フェーズ検証パイプライン**: Null バイトチェック・サニタイズ・シェル構文拒否・コマンド解析・フラグ正規化・パス解決・スクリプト/フック自動承認・汎用コマンドルール
- **4層設定マージ**: ハードコードデフォルト → プラグイン設定 → プロジェクト設定 → ローカルオーバーレイ
- **セキュリティフロア**: `sudo`・`su`・`rm`・`rmdir` は常にダイアログが必要（オーバーライド不可）
- **フローズンキー**: `interpreters` 設定はプロジェクト・ローカル設定で変更不可
- **サブコマンドルール**: `git push`・`git reset --hard`・`gh pr merge` などの破壊的サブコマンドをブロック
- **デュアルモード**: プラグイン（`$CLAUDE_PLUGIN_ROOT`）またはインライン（`.claude/hooks/`）として動作

### コマンド

| コマンド | 用途 |
|---------|------|
| `/permission-guard:setup` | 依存ツールの確認とセットアップ |
| `/permission-guard:show` | 現在の設定を表示 |
| `/permission-guard:optimize` | 設定を最適化 |
| `/permission-guard:permission-test` | 検証テストスイートの実行 |

詳細は [plugins/permission-guard/README.md](plugins/permission-guard/) を参照してください。

## Contributing

Issue や Pull Request は [github.com/skaji18/claude-plugins](https://github.com/skaji18/claude-plugins) にてお待ちしています。

## ライセンス

[MIT](LICENSE)
