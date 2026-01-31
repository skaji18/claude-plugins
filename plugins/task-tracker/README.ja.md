> English version → [README.md](README.md)

# task-tracker

[Claude Code](https://claude.com/claude-code) 用の Obsidian 互換タスク管理プラグイン。業務タスク（レビュー/確認/調査/設計実装）を Markdown ファイルで管理します。

## 概要

チャット・メール・会議で受けたタスク依頼を、構造化された Markdown ファイルとして素早くキャプチャし、完了まで追跡するプラグインです。全データは Obsidian Vault 内にプレーンな Markdown で保存されるため、Obsidian で自然にブラウズ・検索・リンクできます。

主な特徴:

- **AI によるキャプチャ**: チャットのメッセージを貼るだけで、依頼者・種別・タグ・期限・URL を自動抽出
- **Obsidian ネイティブ**: YAML front matter 付きの Markdown ファイルとして Vault に保存
- **フォルダベースのステータス**: `inbox/` = 未完了、`done/` = 完了（status フィールド不要）
- **デイリーログ**: タスク完了時に `daily/YYYY-MM-DD.md` へ自動記録

## コマンド

| コマンド | 用途 |
|---------|------|
| `/init` | 初期設定 — `~/.task-tracker.json` の生成とディレクトリ構造の作成 |
| `/add` | タスク登録 — チャットメッセージ、URL、自由テキストからキャプチャ |
| `/done` | タスク完了 — `done/` へ移動、結果追記、デイリーログ更新 |
| `/list` | タスク一覧表示 — フィルタリングオプション付き |
| `/delete` | タスク削除 — 誤登録タスクの物理削除 |

## 使用方法

### /init — 初期設定

```
/init
```

対話形式で設定ファイル（`~/.task-tracker.json`）を作成し、Obsidian Vault 内にディレクトリ構造をセットアップします。

### /add — タスク登録

```
/add
https://chat.google.com/room/xxx/thread/yyy

```
田中です。このPRレビューお願いします。
https://github.com/org/repo/pull/123
今週中にお願いできると助かります。
```
```

AI が以下を抽出します:
- **依頼者**: 田中
- **種別**: review/pr
- **タグ**: `#proj/repo` `#type/review`
- **期限**: 今週中
- **URL**: GitHub PR リンク

3つの入力パターンに対応: チャットURL + 引用メッセージ、引用メッセージのみ、自由テキスト。

### /done — タスク完了

```
/done
LGTM、軽微な指摘2件。
- L42: null check抜けてる
- L88: 変数名がtypo
```

送信した返信文を貼ります。AI が該当タスクを特定し、`done/` に移動、デイリーログを更新します。

### /list — タスク一覧

```
/list            # inbox（未完了タスク）を表示
/list --all      # inbox と done の両方を表示
/list --done     # 完了タスクのみ表示
```

ID、タイトル、作成日、プロジェクト、タグをテーブル形式で表示します。新しい順にソートされます。

### /delete — タスク削除

```
/delete            # 一覧を表示して選択
/delete a3f2b1c8   # ID指定で削除
/delete a3f2       # 部分ID一致で検索
```

タスクファイルを物理削除します。完了済みタスクの場合、デイリーログにも取り消し線を追加します。削除前に確認が求められます。

## 設定

### ~/.task-tracker.json

`/init` で作成されます。設定ファイルはこの1箇所のみです。

```json
{
  "vault_path": "/path/to/obsidian-vault",
  "subfolder": "task-tracker",
  "tag_rules": {
    "github.com": "#type/review",
    "docs.google.com": "#type/doc"
  }
}
```

| フィールド | 説明 |
|-----------|------|
| `vault_path` | Obsidian Vault の絶対パス |
| `subfolder` | Vault 内の task-tracker 用サブディレクトリ |
| `tag_rules` | カスタム URL → タグ マッピングルール（ドメイン → タグ） |

### データディレクトリ構造

`{vault_path}/{subfolder}/` 内に作成されます:

```
{vault_path}/{subfolder}/
├── inbox/              # 未着手・仕掛かりタスク（1タスク1ファイル .md）
├── done/               # 完了済みタスク（inbox/ から移動）
├── daily/              # 日次完了ログ（YYYY-MM-DD.md）
└── attachments/        # スクリーンショット等の添付ファイル
```

### タスクファイル形式

各タスクは YAML front matter 付きの Markdown ファイルです:

```markdown
---
id: "a3f2b1c8"
from: "田中さん"
type: review/pr
tags:
  - "#proj/backend"
  - "#type/review"
urls:
  - https://github.com/org/repo/pull/123
source: "https://chat.google.com/room/xxx/thread/yyy"
deadline: "今週中"
created: "2026-01-31T10:30:00"
---

# PR: auth-refactor のレビュー

## 依頼内容
> 田中です。このPRレビューお願いします...

## Next
- [ ] PRを確認して差分を読む
- [ ] 期限を確認する
```

- **ID**: UUID v4 の先頭8桁（例: `a3f2b1c8`）
- **ファイル名**: `{id}-{slug}.md`（例: `a3f2b1c8-pr-auth-refactor.md`）
- **ステータス**: フォルダ位置で判定（`inbox/` or `done/`）、フィールドでは持たない

## プラグイン構造

```
plugins/task-tracker/
├── .claude-plugin/
│   └── plugin.json          # プラグインメタデータ
├── skills/
│   ├── task-add/
│   │   └── SKILL.md          # /add コマンド
│   ├── task-done/
│   │   └── SKILL.md          # /done コマンド
│   ├── task-list/
│   │   └── SKILL.md          # /list コマンド
│   ├── task-init/
│   │   └── SKILL.md          # /init コマンド
│   └── task-delete/
│       └── SKILL.md          # /delete コマンド
├── hooks/
│   └── hooks.json            # SessionStart フック（設定チェック）
├── scripts/
│   ├── setup.sh              # ディレクトリセットアップ
│   └── validate.sh           # 設定・ディレクトリの検証
├── README.md                 # 英語版
└── README.ja.md              # このファイル（日本語版）
```

## ライセンス

[MIT](../../LICENSE)
