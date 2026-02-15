> English version → [README.md](README.md)

# permission-guard

[Claude Code](https://claude.com/claude-code) 用の 8 フェーズ Bash コマンド検証フック。`scripts/` と `.claude/hooks/` 内の安全なコマンドを自動承認し、シェルインジェクション・パストラバーサル・危険なパターンをブロックします。

## 概要

Claude Code が Bash コマンドの実行許可を要求した際、このプラグインがリクエストをインターセプトし、8 フェーズの検証パイプラインを実行します。安全なコマンド（プロジェクトスクリプト、プロジェクト内の読み取り専用ファイル操作）は自動承認されます。危険なパターン（シェルインジェクション、パストラバーサル、破壊的操作）は標準の許可ダイアログを表示します。

目的は、日常的な操作の許可疲れを軽減しつつ、強固なセキュリティ境界を維持することです。

## 検証フェーズ

| フェーズ | 名前 | 説明 |
|---------|------|------|
| S0 | ヌルバイトチェック | ヌルバイトと空コマンドを拒否 |
| 1 | サニタイズ | 制御文字の拒否、tool_name の検証 |
| 1.5 | 安全なサフィックス除去 | 安全な末尾パターンを除去（`2>&1`、`\|\| true` など） |
| 2 | シェル構文 | 危険な演算子を拒否: `;`、`\|`、`&`、`` ` ``、`$()`、リダイレクト、グロブ |
| 3 | コマンド解析 | 単語に分割、インタープリタ vs 直接実行を判定 |
| 4 | フラグ正規化 | インタープリタフラグを安全/危険に分類 |
| 5 | パス正規化 | 絶対パスに解決、プロジェクト包含チェック |
| 6 | scripts/hooks チェック | `scripts/` または `.claude/hooks/` 内なら自動承認 |
| 7 | 汎用コマンド | ALWAYS_ASK リスト、サブコマンドルール、全引数のパス包含チェック |

## インストール

```bash
/plugin install permission-guard@skaji18-plugins
```

または手動で依存関係を確認:

```bash
bash scripts/setup.sh
```

## 設定

### 4 層コンフィグマージ

プラグインは 4 層の設定マージ戦略を使用します:

| レイヤー | ソース | 優先度 |
|---------|--------|--------|
| 0 | ハードコードされたデフォルト（スクリプト内） | 最低 |
| 1 | プラグイン設定（`config/permission-config.yaml`） | |
| 2 | プロジェクト設定（`.claude/permission-config.yaml`） | |
| 3 | ローカルオーバーレイ（`local/hooks/permission-config.yaml`） | 最高 |

### カスタマイズ可能なキー

| キー | 型 | マージ戦略 | 説明 |
|-----|------|-----------|------|
| `always_ask` | 配列 | 和集合（追加のみ） | 常に許可ダイアログを表示するコマンド |
| `subcommand_ask` | 配列 | 和集合（追加のみ） | ダイアログを表示するサブコマンドパターン（例: `git:push`） |
| `allowed_dirs_extra` | 配列 | 和集合（追加のみ） | プロジェクト外でアクセスを許可する追加ディレクトリ |

### セキュリティフロア

以下の項目は設定のオーバーライドに関係なく、`always_ask` から削除できません:

- `sudo`、`su`、`rm`、`rmdir`

以下のサブコマンドルールは `subcommand_ask` から削除できません:

- `git:push`、`git:reset:--hard`、`gh:pr:merge`

### 凍結キー

`interpreters` 設定キーは凍結されており、プロジェクトやローカル設定でオーバーライドできません。悪意のあるプロジェクトが危険なインタープリタフラグをホワイトリストに追加することを防ぎます。

## テスト

内蔵テストスイートを実行:

```bash
/permission-guard:permission-test
```

または直接実行:

```bash
bash scripts/test-permission.sh
```

## 依存関係

| ツール | 必須 | 用途 |
|--------|------|------|
| Python 3 | はい | フックスクリプトのランタイム |
| PyYAML | オプション | 設定ファイルの読み込み（なければハードコードされたデフォルトを使用） |

## プラグイン構造

```
plugins/permission-guard/
├── .claude-plugin/
│   └── plugin.json             # プラグインメタデータ（名前、バージョン、作者）
├── hooks/
│   └── hooks.json              # PermissionRequest フック定義
├── scripts/
│   ├── permission-fallback     # メインフックスクリプト（8 フェーズバリデータ）
│   ├── test-permission.sh      # クイック検証テストスイート
│   └── setup.sh                # 依存関係の確認
├── config/
│   └── permission-config.yaml  # デフォルト設定
├── commands/
│   └── permission-test.md      # /permission-guard:permission-test コマンド
├── README.md                   # 英語版
├── README.ja.md                # このファイル（日本語版）
└── CHANGELOG.md                # バージョン履歴
```

## ライセンス

[MIT](../../LICENSE)
