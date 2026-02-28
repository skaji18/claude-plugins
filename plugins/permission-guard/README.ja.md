> English version → [README.md](README.md)

# permission-guard

[Claude Code](https://claude.com/claude-code) 用の Bash コマンド検証フック。安全なコマンドを自動承認し、シェルインジェクションをブロックし、それ以外はユーザーに確認を求めます。

## 概要

Claude Code が Bash コマンドの実行許可を要求すると、このプラグインが `PreToolUse` フックでリクエストをインターセプトし、多段階の検証パイプラインで評価します。安全なコマンド（読み取り専用のファイル操作、プロジェクトローカルのスクリプト）はユーザー操作なしで自動承認されます。危険なパターン（シェルインジェクション、パストラバーサル、破壊的操作）は即座にブロックされるか、標準の許可ダイアログにエスカレートされます。

日常的な操作の許可疲れを軽減しつつ、強固なセキュリティ境界を維持することが目的です。

## 検証フロー

すべてのコマンドは2つのステージを通過します。**pre-validation**（複合コマンド検出前）と **post-validation**（複合コマンド検出後）です。

### Pre-validation

| ステップ | 内容 |
|------|-------------|
| **S0 -- Null バイトチェック** | null バイトと空コマンドを拒否 |
| **Phase 1 -- サニタイズ** | 制御文字（0x00-0x1F, 0x7F）、Unicode 空白文字（U+0085, U+00A0, U+2000-U+200B 等）、Bash 以外の tool name を拒否 |
| **Phase 1.5 -- 安全なサフィックス除去** | 安全な末尾パターン（例: `2>/dev/null`）を反復的に除去し、後続チェックへの干渉を防止 |
| **Phase 2 -- シェル構文** | 危険なシェル構文を拒否: バッククォート置換、バックグラウンド実行、コマンド置換、変数展開、環境変数代入、チルダ展開、グロブ/ブレース展開、インタープリタパス連結、クォートされたコマンド名 |

### 複合コマンド検出

Pre-validation の後、正規表現でコマンドが複合（パイプ、チェイン、セミコロン、リダイレクトを含む）かどうかを判定します。

**単純コマンド** は `validate_single_command` に進みます:

| チェック | 結果 |
|-------|--------|
| NEVER_SAFE セットに含まれる（`sudo`, `su`） | ask |
| コマンドパスがプロジェクトディレクトリ内に解決される（`normpath` による） | allow |
| `tools` 辞書に単純な `"allow"` または `"ask"` エントリとして登録されている | その値 |
| `tools` 辞書にルールエントリとして登録 -- `dangerous_flags`、`ask` サブコマンドを確認後、`default` にフォールバック | allow or ask |
| `tools` 辞書に未登録 | ask (`unknown_command`) |

**複合コマンド** は `validate_compound_command` に進みます:

1. **パイプ右辺チェック** -- パイプの後のコマンドが `pipe_deny_right`（シェル、インタープリタ、`eval`、`exec`、`xargs`）に含まれる場合、即座に deny
2. **セグメント分割** -- コマンドセグメントとリダイレクトセグメントに分割
3. **セグメント単位の検証** -- 各コマンドセグメントを `validate_single_command` で検証、各リダイレクト先はプロジェクト包含チェック（`/dev/null` は常に許可）
4. **集約** -- いずれかのセグメントが allow 以外なら、その結果を返す。全セグメントが allow なら複合コマンド全体を許可

### 判定出力

| 判定 | 意味 |
|----------|---------|
| **allow** | 自動承認、ユーザー確認なし |
| **ask** | Claude Code の許可ダイアログにエスカレート |
| **deny** | ハードブロック、コマンド実行不可 |

Pre-validation の失敗と危険なパイプ対象は **deny** になります。NEVER_SAFE と未登録コマンドは **ask** になります。それ以外は tools の設定に従います。

## インストール

```bash
/plugin install permission-guard@skaji18-plugins
```

インストール後、セットアップスキルを実行して venv の作成、依存関係のインストール、ユーザー設定テンプレートの生成を行います:

```bash
/permission-guard:setup
```

## 設定

### 2層コンフィグマージ

| レイヤー | ソース | 役割 |
|-------|--------|---------|
| 1 | `config/defaults.yaml` | プラグイン同梱の基本ルール |
| 2 | `.claude/permission-guard.yaml` | プロジェクト固有のユーザーオーバーライド |

### tools -- 統一構造（3種類のエントリ形式）

**単純 allow** -- 無条件で自動承認:

```yaml
tools:
  ls: "allow"
  cat: "allow"
```

**単純 ask** -- 常に許可ダイアログを表示:

```yaml
tools:
  curl: "ask"
  rm: "ask"
```

**ルールエントリ** -- サブコマンド・フラグレベルの制御:

```yaml
tools:
  git:
    ask: ["push", "clean", "filter-branch", "rebase", "reset"]
    dangerous_flags: ["--force", "-f", "--hard", "-D", "--no-verify"]
    default: "allow"
```

`ask` リストは複数語のサブコマンドに対応しています（例: `"pr merge"`）。`dangerous_flags` リストは複合短フラグの分解に対応しています（`-rf` は `-r` と `-f` を個別にチェック）。

### pipe_deny_right

パイプの右辺に現れた場合にブロックされるコマンドです。デフォルト: `bash`, `sh`, `zsh`, `ksh`, `fish`, `csh`, `tcsh`, `python`, `python3`, `perl`, `ruby`, `node`, `eval`, `exec`, `xargs`。

### ユーザーオーバーライド（`.claude/permission-guard.yaml`）

`/permission-guard:setup` により自動生成されます。

| キー | 型 | 説明 |
|-----|------|-------------|
| `tools_add` | map | デフォルトにツールエントリを追加・上書き |
| `tools_remove` | list | デフォルトからツール名を削除 |
| `pipe_deny_right_add` | list | パイプ deny リストにエントリを追加 |
| `allowed_dirs_extra` | list | プロジェクト外で許可する追加ディレクトリ |
| `audit_log_path` | string | 監査ログパスの上書き |

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
|---------|-------------|
| `/permission-guard:setup` | venv 作成、依存関係インストール、ユーザー設定テンプレート生成、テスト実行 |
| `/permission-guard:show` | 有効な設定（デフォルト + ユーザーオーバーライドのマージ結果）を差分マーカー付きで表示 |
| `/permission-guard:optimize` | 決定ログを分析し、不要なプロンプトを減らす設定変更を提案 |
| `/permission-guard:permission-test` | 検証テストスイートを実行してフックの動作を確認 |

## 依存関係

- **Python 3** -- フックスクリプトのランタイム
- **PyYAML** -- 設定ファイルの読み込み

## プラグイン構造

```
plugins/permission-guard/
├── .claude-plugin/
│   └── plugin.json            # プラグインメタデータ
├── hooks/
│   └── hooks.json             # PreToolUse フック定義
├── scripts/
│   ├── permission-fallback    # メイン検証スクリプト
│   └── test-permission.sh     # 検証テストスイート
├── config/
│   └── defaults.yaml          # デフォルトツールルール
├── commands/
│   ├── setup.md               # /permission-guard:setup
│   ├── show.md                # /permission-guard:show
│   ├── optimize.md            # /permission-guard:optimize
│   └── permission-test.md     # /permission-guard:permission-test
├── docs/
│   └── DESIGN.md              # アーキテクチャと設計メモ
├── logs/                      # 決定監査ログ（自動生成）
├── README.md                  # 英語版
├── README.ja.md               # 日本語版（このファイル）
└── CHANGELOG.md               # バージョン履歴
```

## ライセンス

[MIT](../../LICENSE)
