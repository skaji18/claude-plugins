> English version → [README.md](README.md)

# permission-guard

[Claude Code](https://claude.com/claude-code) 用の 8 フェーズ Bash コマンド検証フック。`scripts/` と `.claude/hooks/` 内の安全なコマンドを自動承認し、シェルインジェクション・パストラバーサル・危険なパターンをブロックします。

## 概要

Claude Code が Bash コマンドの実行許可を要求した際、このプラグインが `PreToolUse` フックでリクエストをインターセプトし、8 フェーズの検証パイプラインを実行します。安全なコマンド（プロジェクトスクリプト、プロジェクト内の読み取り専用ファイル操作）は自動承認されます。危険なパターン（シェルインジェクション、パストラバーサル、破壊的操作）は標準の許可ダイアログを表示します。

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
| 7 | 汎用コマンド | ツールルックアップ（allow/ask/rules）、サブコマンド照合、全引数のパス包含チェック |

## インストール

```bash
/plugin install permission-guard@skaji18-plugins
```

インストール後、セットアップスキルを実行して venv を作成し、依存関係をインストールし、ユーザー設定テンプレートを生成します:

```bash
/permission-guard:setup
```

## 設定

### 2 層コンフィグマージ

プラグインは 2 層の設定マージ戦略を使用します:

| レイヤー | ソース | 役割 |
|---------|--------|------|
| 1 | `config/defaults.yaml`（プラグインデフォルト） | 全ツールの基本ルール |
| 2 | `.claude/permission-guard.yaml`（ユーザーオーバーライド） | プロジェクト固有の追加・削除 |

### プラグインデフォルト（`config/defaults.yaml`）

`tools` キーに 3 種類の値形式で統一構造を定義します:

**単純エントリ** — 文字列 `"allow"` または `"ask"`:

```yaml
tools:
  ls: "allow"   # 常に自動承認
  rm: "ask"     # 常に許可ダイアログを表示
```

**ルールエントリ** — サブコマンドレベルの制御が必要なツール:

```yaml
tools:
  git:
    ask: ["push", "clean", "filter-branch", "rebase", "reset"]
    dangerous_flags: ["--force", "-f", "--hard", "-D", "--no-verify"]
    default: "allow"
```

**`pipe_deny_right`** — パイプの右辺に現れた場合に常にブロックされるコマンド:

```yaml
pipe_deny_right:
  - bash
  - sh
  - python
  - node
  # ...
```

### ユーザーオーバーライド（`.claude/permission-guard.yaml`）

`/permission-guard:setup` により自動生成されます。以下のキーをサポートします:

| キー | 型 | 説明 |
|-----|------|------|
| `tools_add` | マップ | デフォルトに追加するツール（単純エントリまたはルールエントリ） |
| `tools_remove` | 配列 | デフォルトから削除するツール名 |
| `pipe_deny_right_add` | 配列 | `pipe_deny_right` リストへの追加エントリ |
| `allowed_dirs_extra` | 配列 | プロジェクト外でアクセスを許可する追加ディレクトリ |
| `audit_log_path` | 文字列 | 決定ログパスの上書き（デフォルト: `logs/decisions.jsonl`） |

設定例:

```yaml
tools_add:
  bun: "allow"
  terraform:
    ask: ["destroy", "apply"]
    default: "ask"
tools_remove:
  - tee
pipe_deny_right_add:
  - lua
allowed_dirs_extra: []
audit_log_path: ""
```

## コマンド

| コマンド | 説明 |
|---------|------|
| `/permission-guard:setup` | venv 作成・依存関係インストール・ユーザー設定テンプレート生成・テスト実行 |
| `/permission-guard:show` | 有効な設定（デフォルト + ユーザーオーバーライド）を差分マーカー付きで表示 |
| `/permission-guard:optimize` | 決定ログを分析し、不要なプロンプトを減らす設定変更を提案 |
| `/permission-guard:permission-test` | 検証テストスイートを実行してフックの動作を確認 |

## 依存関係

| ツール | 必須 | 用途 |
|--------|------|------|
| Python 3 | はい | フックスクリプトのランタイム |
| PyYAML | はい（必須） | 設定ファイルの読み込み |

## プラグイン構造

```
plugins/permission-guard/
├── .claude-plugin/
│   └── plugin.json          # プラグインメタデータ（名前、バージョン、作者）
├── hooks/
│   └── hooks.json           # PreToolUse フック定義
├── scripts/
│   ├── permission-fallback  # メインフックスクリプト（8 フェーズバリデータ）
│   └── test-permission.sh   # 検証テストスイート
├── config/
│   └── defaults.yaml        # デフォルトツールルール（allow/ask/rules 統一構造）
├── commands/
│   ├── setup.md             # /permission-guard:setup スキル
│   ├── show.md              # /permission-guard:show スキル
│   ├── optimize.md          # /permission-guard:optimize スキル
│   └── permission-test.md   # /permission-guard:permission-test スキル
├── docs/
│   └── DESIGN.md            # アーキテクチャと設計メモ
├── logs/                    # 決定監査ログ（自動生成）
├── README.md                # 英語版
├── README.ja.md             # このファイル（日本語版）
└── CHANGELOG.md             # バージョン履歴
```

## ライセンス

[MIT](../../LICENSE)
