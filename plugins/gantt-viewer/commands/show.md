---
description: ガントチャート YAML のステータスサマリーを表示する
allowed-tools: [Bash]
---

# gantt-viewer:show

引数で渡された YAML ファイルのステータスサマリーを表示します。

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/show.js" "$1"
```

表示内容にはタスク数・進捗率・クリティカルパス・遅延タスクに加え、担当者別の工数合計（effort サマリー）を含みます。

結果をそのままユーザーに表示してください。
