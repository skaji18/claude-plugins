---
description: プロジェクトにガントチャート用の HTML + YAML テンプレートを生成する
allowed-tools: [Read, Write, Bash]
---

# gantt-viewer:init

プロジェクトにガントチャートビューア用のファイルを生成します。
ユーザーと対話しながら生成先とファイル名を決定します。

## 実行手順

### STEP 1: 生成先の確認

ユーザーに以下を質問してください:

```
ガントチャートのファイルを生成するディレクトリを教えてください。
例: ./gantt または ./docs/schedule
```

ディレクトリが存在しない場合は作成します。

### STEP 2: YAML ファイル名の確認

```
YAML ファイル名を教えてください（デフォルト: gantt.yaml）
```

### STEP 3: テンプレート読み込みと生成

以下の4ファイルをテンプレートから読み込み、生成先に書き出します:

1. **YAML データファイル**: `${CLAUDE_PLUGIN_ROOT}/templates/gantt.yaml` を Read で読み込み、生成先に Write
2. **HTML ビューア**: `${CLAUDE_PLUGIN_ROOT}/templates/gantt.html` を Read で読み込み、YAML ファイル名を置換して Write
3. **コア JS**: `${CLAUDE_PLUGIN_ROOT}/templates/gantt-core.js` を Read で読み込み、そのまま Write
4. **描画 JS**: `${CLAUDE_PLUGIN_ROOT}/templates/gantt-render.js` を Read で読み込み、そのまま Write

HTML テンプレート内の `gantt.yaml` を、STEP 2 で決定したファイル名に置換してから書き出してください。

### STEP 4: 完了メッセージ

生成されたファイル一覧を表示し、以下を案内してください:

```
ファイルを生成しました:
  - {dir}/{yaml-name}  (タスクデータ)
  - {dir}/gantt.html    (ビューア)
  - {dir}/gantt-core.js (コアロジック)
  - {dir}/gantt-render.js (描画)

■ 使い方
  1. {yaml-name} を編集してタスクを定義
  2. HTML を HTTP サーバー経由で開いてガントチャートを閲覧
     (例: VSCode の Live Preview 拡張、または npx serve {dir})
     ※ file:// では YAML の読み込みが CORS で失敗します
  3. /gantt-viewer:check {dir}/{yaml-name} で整合性チェック
  4. /gantt-viewer:show {dir}/{yaml-name} でサマリー表示
```
