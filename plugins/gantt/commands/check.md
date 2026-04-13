---
description: ガントチャート YAML の整合性チェック結果をテキスト出力する
allowed-tools: [Bash]
---

# gantt:check

引数で渡された YAML ファイルの整合性チェックを実行し、結果を表示します。

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/check.js" "$1"
```

チェック内容:

- 日付矛盾（start_date > end_date）
- 依存先の存在チェック（depends_on の参照先）
- 依存違反（依存先終了前に開始している）
- 循環依存の検出
- assignee の参照整合性チェック（members 定義時のみ）
- group の参照整合性チェック（groups 定義時のみ）
- 遅延タスクの検出
- クリティカルパス算出

結果を確認し、ERROR や WARN がある場合は YAML ファイルを修正してください。
