---
name: task-add
version: "1.0.0"
description: チャット依頼やメモを貼り付けるだけでタスクを登録する。AI がメタデータを自動抽出し、Obsidian 互換 Markdown ファイルを生成する。
user-invocable: true
allowed-tools:
  - Bash(uuidgen*)
  - Bash(date*)
  - Bash(mkdir*)
  - Bash(cp*)
  - Read
  - Write
  - Glob
---

# task-add: タスク登録スキル

あなたはタスク登録を行うスキルです。
ユーザーが貼り付けたチャット依頼や自由テキストを解析し、メタデータを自動抽出して Obsidian 互換の Markdown タスクファイルを `inbox/` に生成します。

## 前提条件

- `~/.task-tracker.json` が存在すること（存在しない場合は `/task-init` を案内）
- Obsidian Vault のディレクトリ構造が作成済みであること

## 入力形式

3パターンの入力を受け付けます。

### パターン1: チャット依頼（chat URL + 本文あり）

````
/task-add
https://chat.google.com/room/xxx/thread/yyy

````
田中です。このPRレビューお願いします
https://github.com/org/repo/pull/123
今週中にお願いできると助かります
````
````

- 囲い外の URL → `source`（依頼元チャット URL）
- 4バッククォート囲い内 → 依頼本文（AI が全体を解析）

### パターン2: チャット依頼（本文のみ）

````
/task-add
````
田中です。添付の資料確認お願いします
````
````

- 囲いなしの URL なし → `source` は空
- 4バッククォート囲い内 → 依頼本文

### パターン3: 自由テキスト（囲いなし）

```
/task-add
会議で田中さんからAPI設計レビュー依頼された
```

- 囲いなし → 全体を自由テキストとして AI が最善で解析

## 実行手順

以下のステップを順番に実行してください。

---

### STEP 1: 設定ファイルの読み込み

`~/.task-tracker.json` を Read で読み込みます。

**設定ファイルが存在しない場合**:
以下のメッセージを表示して終了します。
```
設定ファイルが見つかりません。先に /task-init を実行してセットアップを行ってください。
```

**設定ファイルの内容**:
```json
{
  "vault_path": "/path/to/obsidian-vault",
  "subfolder": "task-tracker",
  "tag_rules": { ... }
}
```

読み込んだ値からベースパスを解決します:
- `BASE_PATH` = `{vault_path}/{subfolder}`

---

### STEP 2: ディレクトリ確認

`BASE_PATH` 配下のディレクトリが存在するか確認し、無ければ作成します。

```bash
mkdir -p "<BASE_PATH>/inbox"
mkdir -p "<BASE_PATH>/done"
mkdir -p "<BASE_PATH>/daily"
mkdir -p "<BASE_PATH>/attachments"
```

---

### STEP 3: 入力パース

ユーザーの入力を解析し、以下を分離します:

| 入力パターン | 判定方法 | source | 本文 |
|-------------|---------|--------|------|
| パターン1 | 4バッククォート囲いあり + 囲い外にURL | 囲い外の URL | 囲い内テキスト |
| パターン2 | 4バッククォート囲いあり + 囲い外にURL なし | 空 | 囲い内テキスト |
| パターン3 | 4バッククォート囲いなし | 空 | 全体を自由テキスト |

**判定ルール**:
1. 入力に `````（4バッククォート）の開始・終了ペアがあるか確認
2. ある場合: 囲い外の行から URL（`http://` または `https://` で始まる行）を抽出 → `source` 候補
3. ない場合: パターン3として全体を自由テキストとして扱う

**source URL の判定**:
- chat 系ドメイン（`chat.google.com`, `app.slack.com`, `discord.com` 等）の URL → `source` に設定
- それ以外の囲い外 URL → `urls` に追加

---

### STEP 4: ID 採番

UUID v4 の先頭8桁を生成します。

```bash
uuidgen | tr '[:upper:]' '[:lower:]' | cut -c1-8
```

生成例: `a3f2b1c8`

---

### STEP 5: 日付の取得

```bash
date "+%Y-%m-%dT%H:%M:%S"
```

---

### STEP 6: AI によるメタデータ抽出

STEP 3 でパースした本文を解析し、以下のメタデータを抽出します。

#### 6-1. 依頼者（from）

本文から依頼者の名前を推定します。

| パターン | 例 | 抽出結果 |
|---------|-----|---------|
| 「〇〇です」 | 「田中です。レビューお願いします」 | 田中さん |
| 「〇〇さん:」「From: 〇〇」 | 「佐藤さん: 確認お願い」 | 佐藤さん |
| 英語名 | 「Hi, this is John.」 | John |
| 名前が見つからない | 「レビューお願いします」 | 不明 |

- 推定した名前には敬称「さん」を付与（既に敬称がある場合は重複しない）
- 推定できない場合は `"不明"` を設定

#### 6-2. タスク種別（type）

本文中の URL パターンとキーワードから種別を推定します。

| URL パターン | 種別 |
|-------------|------|
| `github.com/*/pull/*` | `review/pr` |
| `github.com/*/issues/*` | `investigation/issue` |
| `docs.google.com/*` | `review/doc` |
| `*.atlassian.net/*/browse/*` | `task/ticket` |

URL で判定できない場合はキーワードから推定:

| キーワード | 種別 |
|-----------|------|
| レビュー, review, 確認 | `review` |
| 調査, investigate, 調べ | `investigation` |
| 設計, design | `design` |
| 実装, implement, 開発 | `implementation` |

いずれにも該当しない場合: `task`

#### 6-3. タグ（tags）

以下の優先順でタグを推定します。複数該当する場合は全て付与します。

**優先順 1: カスタムルール**
`~/.task-tracker.json` の `tag_rules` に定義されたドメインが本文中の URL にマッチする場合、そのタグを付与。

**優先順 2: 組込 URL ルール**

| URL パターン | タグ |
|-------------|------|
| `github.com/*/pull/*` | `#type/review` |
| `github.com/*/issues/*` | `#type/investigation` |
| `docs.google.com/*` | `#type/doc` |
| `*.atlassian.net/*` | `#type/ticket` |

**優先順 3: 組込キーワードルール**

| キーワード | タグ |
|-----------|------|
| レビュー, review | `#type/review` |
| 調査, investigate | `#type/investigation` |
| 設計, design | `#type/design` |
| 実装, implement | `#type/implementation` |

**優先順 4: プロジェクトタグ**
GitHub URL が含まれる場合、リポジトリ名から `#proj/{repo-name}` を推定。
推定不可なら付与しない。

#### 6-4. 期限（deadline）

本文中の期限表現を検出します。

| 表現 | 設定値 |
|------|--------|
| 「今日」「本日」「today」 | 本日の日付（ISO 8601） |
| 「明日」「tomorrow」 | 明日の日付（ISO 8601） |
| 「今週」「今週中」「this week」 | 今週金曜の日付（ISO 8601） |
| 「来週」「next week」 | 来週金曜の日付（ISO 8601） |
| 「ASAP」「至急」「急ぎ」 | 本日の日付（ISO 8601） |
| 「月末」「月末まで」 | 今月末の日付（ISO 8601） |
| 具体的な日付（「2/5まで」等） | その日付（ISO 8601） |
| 期限表現なし | `"不明"` |

- 期限が `"不明"` の場合、STEP 8 の Next セクションに「期限を確認する」を追加

#### 6-5. URL 抽出（urls）

本文中の URL のうち、chat 系ドメイン以外のものを全て抽出します。

**chat 系ドメイン（source に分類、urls には入れない）**:
- `chat.google.com`
- `app.slack.com`
- `discord.com`
- `teams.microsoft.com`

#### 6-6. slug 生成

タスク内容から英語の kebab-case slug を生成します。

**ルール**:
- タスクの主要な内容を英語で要約
- kebab-case（小文字、ハイフン区切り）
- 最大50文字
- 例: `pr-auth-refactor`, `api-design-review`, `quarterly-report-check`

---

### STEP 7: スクショ処理

入力にファイルパス（`/` で始まり画像拡張子 `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` で終わる行）が含まれる場合:

1. ファイルの存在確認
2. `attachments/` にコピー
```bash
cp "<ファイルパス>" "<BASE_PATH>/attachments/"
```
3. Markdown 本文内に Obsidian 形式で参照を追加: `![[attachments/<ファイル名>]]`

ファイルパスが存在しない場合は無視し、メモ欄に「添付ファイルのパスが無効でした」と記載。

---

### STEP 8: タスクファイルの生成

`inbox/` に Markdown ファイルを Write で生成します。

**ファイルパス**: `<BASE_PATH>/inbox/<ID>-<SLUG>.md`

**ファイル内容**:
```markdown
---
id: "<ID>"
from: "<依頼者>"
type: <種別>
tags:
  - "<タグ1>"
  - "<タグ2>"
urls:
  - <URL1>
  - <URL2>
source: "<source URL>"
deadline: "<期限>"
created: "<STEP 5 の日付>"
---

# <タスクタイトル（日本語、簡潔に）>

## 依頼内容
> <依頼本文を引用形式で記載>

## Next
- [ ] <最初にやるべきアクション>
- [ ] <次のアクション>

## メモ

```

**フィールド補足**:
- `id`: STEP 4 で生成した UUID 8桁
- `from`: 6-1 で推定した依頼者（不明なら `"不明"`）
- `type`: 6-2 で推定した種別
- `tags`: 6-3 で推定したタグの配列（0個の場合は空配列 `[]`）
- `urls`: 6-5 で抽出した URL の配列（0個の場合は空配列 `[]`）
- `source`: STEP 3 で取得した source URL（なければ空文字 `""`）
- `deadline`: 6-4 で推定した期限
- `created`: STEP 5 の日付（ISO 8601）
- タスクタイトル（H1）: 依頼内容を簡潔に要約した日本語のタイトル
- Next: タスクを進めるための具体的なアクションを 1-3 個。deadline が「不明」の場合は「期限を確認する」を含める

---

### STEP 9: 確認出力

登録結果をユーザーに表示します。

**出力フォーマット**:
```
タスクを登録しました:

  ID:       <ID>
  タイトル: <タスクタイトル>
  依頼者:   <from>
  種別:     <type>
  期限:     <deadline>
  タグ:     <tags をスペース区切り>
  ファイル: <ファイルパス>

Next:
  <Next セクションの内容>
```

---

## エラーハンドリング

| エラー | 対処 |
|--------|------|
| `~/.task-tracker.json` が存在しない | `/task-init` の実行を案内して終了 |
| `~/.task-tracker.json` の JSON パースエラー | 「設定ファイルが壊れています。/task-init で再作成してください。」と案内 |
| `vault_path` が存在しない | 「Vault パスが見つかりません: <path>。/task-init で再設定してください。」と案内 |
| `uuidgen` コマンドが使えない | `python3 -c "import uuid; print(str(uuid.uuid4())[:8])"` をフォールバックとして使用 |
| 入力が空（テキストなし） | 「タスク内容を入力してください。」と案内 |
| ファイル書き込み失敗 | 権限を確認するようユーザーに案内 |
