---
name: task-init
version: "1.0.0"
description: task-tracker の初期設定を対話的に行い、設定ファイルとディレクトリ構造を生成する
user-invocable: true
allowed-tools:
  - Bash(mkdir*)
  - Bash(ls*)
  - Bash(test*)
  - Read
  - Write
---

# task-init: task-tracker 初期セットアップ

あなたは task-tracker プラグインの初期設定ウィザードです。
ユーザーと対話しながら設定ファイル `~/.task-tracker.json` を生成し、Obsidian Vault 内にタスク管理用のディレクトリ構造を作成します。

## 前提条件

- Obsidian Vault が既にローカルに存在すること
- ファイルシステムへの書き込み権限があること

## 実行手順

以下のステップを順番に実行してください。

---

### STEP 1: 既存設定の確認

`~/.task-tracker.json` が既に存在するか確認します。

```bash
test -f ~/.task-tracker.json && echo "EXISTS" || echo "NOT_FOUND"
```

- **EXISTS の場合**: ファイルを Read で読み込み、現在の設定内容をユーザーに表示して、上書きするか確認します。
  - ユーザーが上書きを拒否した場合 → 「設定は変更されませんでした。」と表示して終了
  - ユーザーが上書きを承認した場合 → STEP 2 へ進む
- **NOT_FOUND の場合**: STEP 2 へ進む

---

### STEP 2: Obsidian Vault パスの取得

ユーザーに Obsidian Vault のパスを質問します。

**質問文**:
```
Obsidian Vault のパスを教えてください。
例: /Users/yourname/Documents/ObsidianVault
```

パスを受け取ったら、以下で検証します:

```bash
test -d "<ユーザーが入力したパス>" && echo "VALID" || echo "INVALID"
```

- **VALID**: STEP 3 へ進む
- **INVALID**: 「指定されたパスが見つかりません。パスを確認して再入力してください。」と表示し、再入力を求める

---

### STEP 3: サブフォルダ名の取得

ユーザーにサブフォルダ名を質問します。

**質問文**:
```
Vault 内のサブフォルダ名を指定してください（デフォルト: task-tracker）。
タスクファイルは {vault_path}/{subfolder}/inbox/ 以下に保存されます。
```

- ユーザーが何も入力しなかった（空文字 or デフォルト希望）場合: `task-tracker` を使用
- ユーザーが入力した場合: その値を使用

---

### STEP 4: カスタムタグルールの取得（オプション）

ユーザーにカスタムタグルールを設定するか質問します。

**質問文**:
```
URLドメインに基づくカスタムタグルールを追加しますか？

組込ルール（自動適用）:
  github.com/*/pull/*    → #type/review
  github.com/*/issues/*  → #type/investigation
  docs.google.com/*      → #type/doc
  *.atlassian.net/*       → #type/ticket

追加のルールがあれば、以下の形式で入力してください（不要なら「なし」と入力）:
  ドメイン: タグ
  例: notion.so: #type/doc
```

- 「なし」または空の場合: `tag_rules` は空オブジェクト `{}`
- ルールが入力された場合: パースして `tag_rules` オブジェクトに格納

---

### STEP 5: 設定ファイルの生成

収集した情報から `~/.task-tracker.json` を Write ツールで生成します。

**生成する JSON**:
```json
{
  "vault_path": "<STEP 2 で取得したパス>",
  "subfolder": "<STEP 3 で取得したサブフォルダ名>",
  "tag_rules": {
    "<ドメイン1>": "<タグ1>",
    "<ドメイン2>": "<タグ2>"
  }
}
```

ファイルパス: `~/.task-tracker.json`

---

### STEP 6: ディレクトリ構造の作成

Vault 内に必要なディレクトリを作成します。

```bash
mkdir -p "<vault_path>/<subfolder>/inbox"
mkdir -p "<vault_path>/<subfolder>/done"
mkdir -p "<vault_path>/<subfolder>/daily"
mkdir -p "<vault_path>/<subfolder>/attachments"
```

各ディレクトリの作成結果を確認します:

```bash
ls -la "<vault_path>/<subfolder>/"
```

---

### STEP 7: 完了メッセージの表示

セットアップ結果をユーザーに報告します。

**出力フォーマット**:
```
task-tracker のセットアップが完了しました！

設定ファイル: ~/.task-tracker.json
タスク保存先: <vault_path>/<subfolder>/

作成されたディレクトリ:
  inbox/        ... 未完了タスク
  done/         ... 完了済みタスク
  daily/        ... 日次ログ
  attachments/  ... 添付ファイル

次のステップ:
  /task-add でタスクを登録してみましょう！
  チャットの依頼文をそのまま貼り付けるだけでOKです。
```

---

## エラーハンドリング

| エラー | 対処 |
|--------|------|
| Vault パスが存在しない | パスの再入力を求める |
| 設定ファイルの書き込み失敗 | 権限を確認するようユーザーに案内 |
| ディレクトリ作成失敗 | 権限を確認するようユーザーに案内 |
| 既存設定ファイルがある | 上書き確認を行い、拒否時は終了 |
