# smart-commit

`git diff` を LLM が解析してコミットメッセージを自動生成し、`Co-Authored-By` を自動付与して1コマンドでコミットできる Claude Code プラグイン。

## 機能

- **メッセージ自動生成**: `git diff --staged` を解析してコミットメッセージを生成
- **Co-Authored-By 自動付与**: 全コミットに自動で追加
- **スタイル対応**: コミット履歴から日本語/英語を自動判定
- **手動モード**: `-m "message"` で自分のメッセージを指定（Co-Authored-By は自動付与）
- **push 対応**: `--push` フラグでコミット後に push も実行

## 使い方

```
/commit                    # メッセージ自動生成
/commit -m "feat: Xを追加" # 手動メッセージ（Co-Authored-By 自動付与）
/commit --push             # コミット後に push
```

## コミットメッセージ形式

```
<type>: <要約（50文字以内）>

<本文（必要な場合のみ）>

Co-Authored-By: Claude <noreply@anthropic.com>
```

タイプ: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`

## 要件

- git がインストールされていること
- git リポジトリ内で実行すること
