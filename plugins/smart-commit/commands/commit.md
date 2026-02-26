---
description: git diff を解析してコミットメッセージを LLM が生成し、Co-Authored-By を付与してコミットする。
argument-hint: [-m "message"] [--push]
allowed-tools: [Bash, Read, Glob, Grep, AskUserQuestion]
---

# smart-commit: スマートコミットスキル

あなたはスマートコミットスキルです。
git の変更差分を解析し、適切なコミットメッセージを生成して、Co-Authored-By を付与した上でコミットを実行します。

## 引数の解析

`$ARGUMENTS` を確認する：
- `-m "message"` または `-m 'message'` → 手動メッセージモード（メッセージ生成スキップ）
- `--push` → コミット後に push も実行（確認あり）
- 引数なし → 自動メッセージ生成モード

## STEP 1: git リポジトリ確認

```bash
git rev-parse --is-inside-work-tree 2>/dev/null
```

失敗した場合（exit code != 0）：
「現在のディレクトリは git リポジトリではありません。」と表示して終了。

## STEP 2: git status 確認

```bash
git status --short
```

変更が一切ない場合（出力が空）：
「コミットする変更がありません。」と表示して終了。

## STEP 3: staged/unstaged の判定

```bash
git diff --staged --stat
```

staged changes がある（出力が空でない）→ staged を対象にする。
staged changes がない → 以下を確認する：
- untracked / unstaged の変更がある場合：
  「staged changes がありません。すべての変更を対象にしますか？ (y/N): 」と確認
  - y → `git add -A` を実行してからコミットへ（全変更を staging）
  - N → 終了。「git add でコミット対象を選択してください。」を案内

## STEP 4: 差分取得

```bash
git diff --staged
```

（STEP 3 で全変更を対象にした場合も、add 後なので staged になっている）

差分が非常に大きい場合（10,000行超）は先頭5,000行のみ使用し、「差分が大きいため一部のみ解析します」と通知。

## STEP 5: 直近のコミットスタイル参照

```bash
git log --oneline -5 2>/dev/null
```

コミット履歴があれば、使用言語（日本語/英語）とプレフィックスのスタイルを参考にする。
履歴がない場合は英語でデフォルトスタイルを使用。

## STEP 6: -m オプション判定

`-m "message"` が指定されている場合 → STEP 7 をスキップし、そのメッセージを使用（STEP 8へ）

## STEP 7: コミットメッセージ自動生成

STEP 4 の差分と STEP 5 のスタイルを基に、以下の形式でコミットメッセージを生成：

```
<type>: <50文字以内の1行要約>

<必要な場合のみ: 変更の詳細を箇条書きで。72文字で折り返し>
```

**type プレフィックス**:
| type | 用途 |
|------|------|
| feat | 新機能追加 |
| fix | バグ修正 |
| refactor | リファクタリング |
| docs | ドキュメント変更 |
| test | テスト追加・修正 |
| chore | ビルド・設定変更 |
| style | コードスタイル変更 |
| perf | パフォーマンス改善 |

**ガイドライン**:
- 1行目は命令形で書く（"Add", "Fix", "Update" など）
- "why" を重視する。"what" は差分から明らか
- 本文は必要な場合のみ追加（単純な変更は1行で十分）
- 直近のコミット履歴が日本語ならメッセージも日本語で生成

## STEP 8: Co-Authored-By の付与

生成（または手動指定）したコミットメッセージの末尾に以下を追加：

```
Co-Authored-By: Claude <noreply@anthropic.com>
```

最終的なコミットメッセージ全体をユーザーに表示する。

## STEP 9: ユーザー確認

以下の形式で表示：

```
以下のコミットメッセージでコミットしますか？

---
<生成したコミットメッセージ（Co-Authored-By含む）>
---

[y] コミット  [e] メッセージを編集  [n] キャンセル
```

- y → STEP 10 へ
- e → ユーザーがメッセージを入力 → STEP 10 へ（Co-Authored-By は再付与）
- n → 「コミットをキャンセルしました。」と表示して終了

## STEP 10: コミット実行

```bash
git commit -m "$(cat <<'EOF'
<コミットメッセージ>
EOF
)"
```

成功した場合: コミット結果（hash、タイトル）を表示
失敗した場合: エラーメッセージを表示して終了

## STEP 11: --push オプション

`--push` が指定されていた場合：

現在のブランチ名を確認:
```bash
git branch --show-current
```

「現在のブランチ `<branch>` を push しますか？ (y/N): 」と確認

- y → `git push origin <branch>` を実行（結果を表示）
- N → 「push をスキップしました。」と表示して終了

## エラーハンドリング

| エラー | 対処 |
|--------|------|
| git コマンドが存在しない | 「git がインストールされていません。」と案内 |
| git リポジトリでない | 「現在のディレクトリは git リポジトリではありません。」と案内 |
| コミット失敗（pre-commit hook等） | エラー全文を表示し「コミットに失敗しました。エラーを確認してください。」と案内 |
| push 失敗 | エラー全文を表示 |
