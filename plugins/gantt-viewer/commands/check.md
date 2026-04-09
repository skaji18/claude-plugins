---
description: ガントチャート YAML の整合性チェック結果をテキスト出力する
allowed-tools: [Bash]
---

# gantt-viewer:check

引数で渡された YAML ファイルの整合性チェックを実行し、結果を表示します。

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/check.js" "$1"
```

結果を確認し、ERROR や WARN がある場合は YAML ファイルを修正してください。
