---
description: ガントチャート YAML をブラウザで表示する
allowed-tools: [Bash]
---

# gantt-viewer:open

引数で渡された YAML ファイルから自己完結 HTML を生成し、ブラウザで開きます。

## オプション

- `--serve` : ブラウザで直接開く代わりに `npx serve` でHTTPサーバーを起動し、URLを表示します。SSH接続時などローカルでブラウザが開けない環境向け。

## 使い方

```bash
# 通常（ブラウザで開く）
node "${CLAUDE_PLUGIN_ROOT}/scripts/open.js" "$1"

# --serve 付き（HTTPサーバーで配信）
node "${CLAUDE_PLUGIN_ROOT}/scripts/open.js" "$1" --serve
```

引数に `--serve` が含まれている場合はそのまま渡してください。結果をそのままユーザーに表示してください。
