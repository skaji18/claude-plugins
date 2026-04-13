---
description: プロジェクトにガントチャート用の YAML 雛形を生成する
allowed-tools: [Read, Write, Bash]
---

# gantt:init

プロジェクトにガントチャート用の YAML 雛形ファイルを生成します。
ユーザーと対話しながら生成先とファイル名を決定します。

## 実行手順

### STEP 1: 生成先の確認

ユーザーに以下を質問してください:

```
ガントチャートの YAML ファイルを生成するディレクトリを教えてください。
例: ./gantt または ./docs/schedule
```

ディレクトリが存在しない場合は作成します。

### STEP 2: YAML ファイル名の確認

```
YAML ファイル名を教えてください（デフォルト: gantt.yaml）
```

### STEP 3: テンプレート読み込みと生成

YAML データファイルのみをテンプレートから読み込み、生成先に書き出します:

- `${CLAUDE_PLUGIN_ROOT}/templates/gantt.yaml` を Read で読み込み、生成先に Write

### STEP 4: 完了メッセージ

生成されたファイルを表示し、以下を案内してください:

```
ファイルを生成しました:
  - {dir}/{yaml-name}    (タスクデータ)

■ 使い方
  1. {yaml-name} を編集してタスクを定義
  2. /gantt:open {dir}/{yaml-name} でブラウザにガントチャートを表示
  3. /gantt:check {dir}/{yaml-name} で整合性チェック
  4. /gantt:show {dir}/{yaml-name} でサマリー表示
```
