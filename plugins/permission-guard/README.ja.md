> English version → [README.md](README.md)

# permission-guard

[Claude Code](https://claude.com/claude-code) 用の Bash コマンド検証フック。安全なコマンドを自動承認し、シェルインジェクションをブロックし、それ以外はユーザーに確認を求めます。

## 概要

Claude Code が Bash コマンドの実行許可を要求すると、このプラグインが `PreToolUse` フックでリクエストをインターセプトし、多段階の検証パイプラインで評価します。安全なコマンド（読み取り専用のファイル操作、プロジェクトローカルのスクリプト）はユーザー操作なしで自動承認されます。危険なパターン（シェルインジェクション、パストラバーサル、破壊的操作）は即座にブロックされるか、標準の許可ダイアログにエスカレートされます。

日常的な操作の許可疲れを軽減しつつ、強固なセキュリティ境界を維持することが目的です。

## 検証フロー

すべてのコマンドは2つのステージを通過します。**pre-validation**（入力サニタイズ）と **AST ベース検証**（bashlex による構造解析）です。

### Pre-validation

| ステップ | 内容 |
|------|-------------|
| **S0 -- Null バイトチェック** | null バイトと空コマンドを拒否 |
| **Phase 1 -- サニタイズ** | 制御文字（0x00-0x1F, 0x7F）、Unicode 空白文字（U+0085, U+00A0, U+2000-U+200B 等）、Bash 以外の tool name を拒否 |

### AST パース（bashlex）

Pre-validation の後、コマンドを [bashlex](https://github.com/idank/bashlex) で AST にパースします。従来の正規表現ベースのアプローチを、適切な構造解析に置き換えました。

AST ウォーカーがノード種別で危険な構文を検出します：

| AST ノード | 検出する構文 | 判定 |
|----------|-------------------|----------|
| `CommandsubstitutionNode` | `` `cmd` `` または `$(cmd)` | deny |
| `ParameterNode` | `$VAR`, `$!`, `$#` 等 | deny |
| `TildeNode` | `~/path` | deny |
| `AssignmentNode` | `FOO=bar` | deny |
| `OperatorNode(op='&')` | バックグラウンド実行 | deny |
| WordNode 内のグロブ文字 | `*`, `?`, `[`, `{` | deny |

bashlex がコマンドをパースできない場合、判定は **ask** にフォールバック（安全なデフォルト）。

パイプ、チェーン（`&&`, `||`, `;`）、サブシェル（`(cmd)`）、リダイレクトは個別のコマンドに分解され、コマンド単位で検証されます。

### コマンド単位の検証

抽出された各コマンドは tools 設定に基づいて検証されます：

| チェック | 結果 |
|-------|--------|
| NEVER_SAFE セットに含まれる（`sudo`, `su`） | ask |
| コマンドパスがプロジェクトディレクトリ内に解決される（`normpath` による） | allow |
| `tools` 辞書に単純な `"allow"` または `"ask"` エントリとして登録 | その値 |
| `tools` 辞書にルールエントリとして登録 -- `dangerous_flags`、`ask` サブコマンドを確認後、`default` にフォールバック | allow or ask |
| `tools` 辞書に未登録 | ask (`unknown_command`) |

複合コマンドでは、パイプ右辺のコマンドが `pipe_deny_right` に対してチェックされ、リダイレクト先がプロジェクト包含チェックを受けます（`/dev/null` は常に許可）。

### 判定出力

| 判定 | 意味 |
|----------|---------|
| **allow** | 自動承認、ユーザー確認なし |
| **ask** | Claude Code の許可ダイアログにエスカレート |
| **deny** | ハードブロック、コマンド実行不可 |

Pre-validation の失敗と危険な AST ノードは **deny**。NEVER_SAFE と未登録コマンドは **ask**。それ以外は tools の設定に従います。

## インストール

```bash
/plugin install permission-guard@skaji18-plugins
```

インストール後、セットアップスキルを実行して venv の作成、依存関係のインストール、設定テンプレートの生成を行います:

```bash
/permission-guard:setup
```

## 設定

### 3層コンフィグマージ

| レイヤー | ソース | 役割 |
|-------|--------|---------|
| 1 | `config/defaults.yaml` | プラグイン同梱の基本ルール |
| 2 | `~/.claude/permission-guard.yaml` | ユーザー全体のグローバルオーバーライド |
| 3 | `CLAUDE_PROJECT_DIR/.claude/permission-guard.yaml` | プロジェクト固有のオーバーライド |

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

`ask` リストは複数語のサブコマンドに対応（例: `"pr merge"`）。`dangerous_flags` リストは複合短フラグの分解に対応（`-rf` は `-r` と `-f` を個別にチェック）。

### pipe_deny_right

パイプの右辺に現れた場合にブロックされるコマンドです。デフォルト: `bash`, `sh`, `zsh`, `ksh`, `fish`, `csh`, `tcsh`, `python`, `python3`, `perl`, `ruby`, `node`, `eval`, `exec`, `xargs`。

### ユーザーオーバーライド

`/permission-guard:setup` により、グローバルとプロジェクトの両レベルで自動生成されます。

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
| `/permission-guard:setup` | venv 作成、依存関係インストール、設定テンプレート生成、テスト実行 |
| `/permission-guard:show` | 有効な設定（デフォルト + オーバーライドのマージ結果）を差分マーカー付きで表示 |
| `/permission-guard:optimize` | 決定ログを分析し、不要なプロンプトを減らす設定変更を提案 |
| `/permission-guard:permission-test` | E2E テストスイートを実行してフックの動作を確認 |

## 依存関係

- **Python 3** -- フックスクリプトのランタイム
- **PyYAML** -- 設定ファイルの読み込み
- **bashlex** -- シェルコマンドの AST パース

## プラグイン構造

```
plugins/permission-guard/
├── .claude-plugin/
│   └── plugin.json            # プラグインメタデータ
├── hooks/
│   └── hooks.json             # PreToolUse フック定義
├── scripts/
│   ├── boot                   # フックエントリポイント（シェルラッパー）
│   ├── pg/                    # Python パッケージ
│   │   ├── __init__.py
│   │   ├── __main__.py        # CLI ディスパッチ
│   │   ├── parser.py          # bashlex AST パーサー
│   │   ├── fallback.py        # メインフックロジック
│   │   ├── config.py          # 3層コンフィグローダー
│   │   ├── show.py            # /permission-guard:show
│   │   ├── analyze.py         # /permission-guard:optimize
│   │   └── apply.py           # 設定提案の適用
│   ├── setup.sh               # /permission-guard:setup
│   └── test_e2e.py            # E2E テストスイート（144ケース）
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
