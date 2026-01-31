---
name: impact-analysis
description: コードの影響範囲を調査するスキル（PHP / JS / TS 対応）
user-invocable: true
allowed-tools:
  - Bash(lsprefs*)
  - Bash(lsprefs-walk*)
  - Bash(rg*)
  - Read
  - Grep
  - Glob
  - Write
---

# impact-analysis: コード影響調査スキル

あなたはコードの影響調査を行うスキルです。
ユーザーの調査リクエスト（自然言語）を受け取り、既存ツール（`lsprefs-walk`, `lsprefs`, `rg`）を使って影響範囲を機械的に追跡し、**evidence.tsv**（証跡一覧）と **summary.md**（人間用レポート）を生成します。

**対応言語**: PHP, JavaScript, TypeScript

## 前提条件

以下のツールが利用可能であること:
- `lsprefs` / `lsprefs-walk` — 影響追跡ツール（Go バイナリ）
- `rg` (ripgrep) — コード検索
- LSP サーバー（言語に応じて自動選択、下記参照）

ツールのパスは以下の方法で決定します（優先順位順）:
1. ユーザーがスキル呼び出し時に明示した値
2. CLAUDE.md 内の `ai-tools` 関連設定
3. デフォルト値（下記）

| 変数 | 説明 | デフォルト |
|------|------|-----------|
| `AI_TOOLS_DIR` | ai-tools リポジトリのパス | `~/projects/ai-tools` |
| `REPO_PATH` | 調査対象リポジトリのパス | （ユーザー指定必須） |
| `OUT_DIR` | 出力ディレクトリ | `${AI_TOOLS_DIR}/out` |
| `MAX_DEPTH` | BFS 最大深度 | `4` |
| `MAX_NODES` | 最大ノード数 | `2000` |
| `EXCLUDE` | 除外パターン（カンマ区切り） | `vendor/**,.git/**,.cache/**,node_modules/**,tests/**` |
| `ORIGINS` | 起点の数（1=単一起点, 2+=複数起点で merge が必要） | `1` |

## 言語自動判定

起点ファイルの拡張子から使用する LSP サーバーを自動決定します。この判定は STEP 1 で起点を特定した直後に行います。

| 拡張子 | 言語 | LSP サーバーコマンド (`--server` に渡す値) | rg のグロブ |
|--------|------|------------------------------------------|------------|
| `.php` | PHP | `intelephense --stdio` | `-g'*.php'` |
| `.js`, `.jsx` | JavaScript | `typescript-language-server --stdio` | `-g'*.{js,jsx}'` |
| `.ts`, `.tsx` | TypeScript | `typescript-language-server --stdio` | `-g'*.{ts,tsx}'` |

**判定ルール**:
1. 起点ファイルの拡張子を確認する
2. 上記テーブルから対応する `LSP_SERVER` コマンドを決定する
3. `lsprefs start --server "${LSP_SERVER}"` と `lsprefs-walk run --server "${LSP_SERVER}"` の両方にこの値を使用する
4. ユーザーが `--server` を明示的に指定した場合はそちらを優先する

**rg 検索時のグロブ**:
- 言語に応じて rg のグロブパターンを切り替える
- PHP の場合: `rg --vimgrep "<シンボル名>" -g'*.php' .`
- JS/TS の場合: `rg --vimgrep "<シンボル名>" -g'*.{ts,tsx,js,jsx}' .`

## 実行手順

以下のステップを順番に実行してください。

**調査パターンの判定**:
まず、ユーザーの調査リクエストが「コード起点（パターンA）」か「仕様起点（パターンB）」かを判定します。

| パターン | 判定基準 | 開始ステップ |
|---------|---------|------------|
| **A: コード起点** | 関数名・メソッド名・クラス名が明示されている（例: 「`getSignature` メソッドを削除した場合の影響」「`Cache::toJson` のリファクタリング影響」） | → STEP 1 へ |
| **B: 仕様起点** | 機能名・振る舞い・ビジネスロジックの変更が記述されている（例: 「Fixerの実行順序の決定ロジックを変更した場合」「設定バリデーションの仕組みを変更した場合」） | → STEP 0 へ |

**判定のヒント**:
- 具体的なシンボル名（関数/メソッド/クラス）がリクエストに含まれている → **パターンA**
- 「〜の仕組み」「〜のロジック」「〜の機能」など抽象的な表現 → **パターンB**
- 迷った場合はユーザーに確認する

**フロー概要**:
- パターンA: STEP 1 → 2 → 3 → 4 → (4.5) → 5 → 6
- パターンB: STEP 0 → 1 → 2 → 3 → 4 → (4.5) → 5 → 6
- 起点が1つの場合は STEP 4.5 をスキップします。
- 起点が複数の場合は STEP 3〜4 を各起点ごとに繰り返し、STEP 4.5 で統合します。

---

### STEP 0: 仕様→コード箇所マッピング（パターンBのみ）

> **このステップは仕様起点（パターンB）の場合のみ実行します。コード起点（パターンA）の場合はスキップして STEP 1 へ進んでください。**

ユーザーの仕様変更リクエスト（自然言語）から、影響追跡の起点となるコード箇所を特定します。
これは AI の推論による探索であり、機械的な追跡（STEP 1 以降）の前段階です。

**0-1. アーキテクチャの把握**

対象プロジェクトの全体像を把握します:
1. `CLAUDE.md` またはプロジェクトルートの README.md / ドキュメントを Read で確認
2. ディレクトリ構造を `ls` で俯瞰（`src/`, `app/`, `lib/` 等のレイアウト）
3. 主要な設定ファイル（ルーティング定義、DI設定、composer.json / package.json 等）があれば確認
4. アーキテクチャパターン（MVC、レイヤードアーキテクチャ等）を推定
5. **使用言語を特定**（PHP / JS / TS / 複数言語混在）

**0-2. キーワード探索**

仕様変更の記述から関連キーワードを抽出し、コード内を検索します:

```bash
cd "${REPO_PATH}"

# 言語に応じてグロブを切り替え
# PHP の場合:
rg --vimgrep "<キーワード1>" -g'*.php' . | head -n 30
# JS/TS の場合:
rg --vimgrep "<キーワード1>" -g'*.{ts,tsx,js,jsx}' . | head -n 30
# 複数言語の場合は両方検索:
rg --vimgrep "<キーワード1>" -g'*.{php,ts,tsx,js,jsx}' . | head -n 30
```

探索のコツ:
- まず広いキーワード（機能の名詞: `priority`, `validation`, `cache` 等）で候補を探す
- 次に具体的なキーワード（メソッド名パターン: `getPriority`, `validate`, `configure` 等）で絞る
- ルーティング定義やイベントリスナー設定も確認（Web アプリの場合）
- DB スキーマ/マイグレーションファイルも確認（データモデル変更の場合）

**0-3. 候補の絞り込み**

検索結果から候補ファイルを Read で読み取り、仕様変更との関連度を判定します:

1. 候補ファイルのコードを Read で確認
2. 仕様変更の意図と照らし合わせ、「ここが変更の起点になる」と判断できる箇所を特定
3. 起点となる関数/メソッドを1つ以上選定

**判定の観点**:
- この関数/メソッドの振る舞いを変えれば、仕様変更が実現できるか？
- この箇所を変更した場合、影響がどこまで伝搬するかを追跡する価値があるか？
- 複数の箇所が候補に上がった場合、それぞれが独立した起点か、1つの起点に集約できるか？

**0-4. 自信度の表明とユーザー確認**

特定した起点候補について、自信度を3段階で表明します:

| 自信度 | 基準 | アクション |
|--------|------|-----------|
| **高** | コード構造から起点が明確に特定でき、仕様変更との対応関係が自明 | そのまま STEP 1 へ進む |
| **中** | 起点候補は特定できたが、他にも関連箇所がある可能性がある | 起点候補をユーザーに提示し、「この起点で進めてよいか？追加すべき箇所はあるか？」と確認 |
| **低** | 仕様が抽象的でコード箇所との対応が不明瞭、または候補が多すぎる | 推論過程と候補一覧をユーザーに提示し、起点を一緒に選定する |

ユーザーへの提示フォーマット:
```
【仕様→コード箇所マッピング結果】

仕様変更: <ユーザーのリクエスト要約>

起点候補:
1. <クラス>::<メソッド> (<file>:<line>) [PHP]
   理由: <なぜこの箇所が起点になるか>
2. <関数名> (<file>:<line>) [TypeScript]
   理由: <理由>

自信度: 高/中/低
探索過程: <どのようにこの結論に至ったかの簡潔な説明>
```

**0-5. STEP 1 への接続**

起点が確定したら:
- 起点が1つ → STEP 1 の **1-2. 起点の検索** で特定した `RGLINE` を使用し、単一起点フロー（STEP 1→6）へ
- 起点が複数 → STEP 1 の **1-2b. 複数起点の場合** として `RGLINE_1`, `RGLINE_2`, ... を設定し、複数起点フロー（STEP 1→4.5）へ

STEP 0 で特定した起点の `rgline` は STEP 1 の形式（`file:line:col:text`）に変換して引き渡します。rgline の col はシンボル名の開始位置を指す必要があります（STEP 1 の「カラム位置の注意」参照）。

---

### STEP 1: 調査リクエストの解析と起点の特定

ユーザーの調査リクエスト（自然言語）から、影響追跡の **起点** を特定します。

**1-1. リクエストの解析**

ユーザーが指定した内容を確認します:
- 調査対象のシンボル名（関数名、メソッド名、クラス名等）
- 対象リポジトリのパス（`REPO_PATH`）
- カスタム設定があれば取得

**1-2. 起点の検索**

`rg --vimgrep` を使って対象シンボルを検索し、定義箇所を特定します。

**パスの整合性が重要**: `rg` の実行場所と config.json の `root` が一致しないと、lsprefs-walk がファイルを二重パスで解決して失敗します。以下の方法で rg を実行してください:

```bash
# 方法B（推奨）: REPO_PATH 内から実行
cd "${REPO_PATH}"
# PHP の場合:
rg --vimgrep "<シンボル名>" -g'*.php' . | head -n 20
# JS/TS の場合:
rg --vimgrep "<シンボル名>" -g'*.{ts,tsx,js,jsx}' . | head -n 20
# → rgline のパスは REPO_PATH からの相対パス（例: ./src/Foo.php:42:10:...）
# → config.json の root = REPO_PATH の絶対パス
```

```bash
# 方法A: AI_TOOLS_DIR から実行し、REPO_PATH を検索対象に指定
cd "${AI_TOOLS_DIR}"
rg --vimgrep "<シンボル名>" -g'*.php' "${REPO_PATH}" | head -n 20
# ⚠️ 注意: 方法Aは config.json の root と lsprefs デーモンの root の整合が取りにくく、
#    パスの二重化を引き起こしやすい。方法B を推奨。
```

検索結果から、**そのシンボルの定義箇所**（`function` / `public function` / `interface` / `export function` / `export const` の宣言行）を1つ選びます。

選択基準:
- `class` や `interface` 内の宣言行を優先
- 呼び出し箇所ではなく定義箇所を選ぶ
- 不明な場合はユーザーに確認する

選んだ行を `RGLINE` 変数として記録します。形式: `file:line:col:text`

**1-2a. 言語自動判定の実行**

起点が確定したら、ファイルの拡張子から LSP サーバーを決定します:

```
起点ファイル: ./src/Foo.php     → LSP_SERVER="intelephense --stdio"
起点ファイル: ./src/bar.ts      → LSP_SERVER="typescript-language-server --stdio"
起点ファイル: ./src/baz.jsx     → LSP_SERVER="typescript-language-server --stdio"
```

この `LSP_SERVER` を STEP 2 以降で使用します。

**1-2b. 複数起点の場合**

調査対象が複数のシンボルにまたがる場合（例: 関連する複数メソッドの一括調査、インターフェース+別クラスの組み合わせ等）:
1. 各起点ごとに `RGLINE_1`, `RGLINE_2`, ... として記録する
2. 各起点に対応する出力ファイル名を決める（例: `evidence-origin1.tsv`, `evidence-origin2.tsv`）
3. STEP 3〜4 を各起点ごとに繰り返し実行する
4. STEP 4.5 で `lsprefs-walk merge` を使って統合する

**注意**: 複数起点が**異なる言語**の場合（例: PHP 起点 + TS 起点）、各起点ごとに適切な `LSP_SERVER` を使い分ける必要があります。STEP 2〜4 を起点ごとに異なる `--server` で実行してください。

**⚠️ カラム位置の重要な注意**: `rg --vimgrep` の col はマッチ開始位置（通常 `public` や `function` キーワード）を指す。しかし LSP の definition 解決にはカーソルが**シンボル名の上**にある必要がある。rgline の col がシンボル名を指していない場合、`lsprefs def` が `ambiguous definition: 0 candidates` を返す。

修正方法: rg 出力の col をシンボル名の開始位置に書き換える。
```
# rg の出力（col=12 は "public" を指す）:
./src/AbstractFixer.php:74:12:    public function getName(): string
# 修正（col=21 は "getName" を指す）:
./src/AbstractFixer.php:74:21:    public function getName(): string
```

**1-3. インターフェースメソッドの場合の補完**

起点がインターフェースメソッド（PHP の `interface` / TypeScript の `interface`）の場合、LSP の `textDocument/references` は**ポリモーフィックな呼び出し箇所**のみを返し、**具象クラスの実装定義**は含まれない。このため lsprefs-walk の結果だけでは網羅性が不足する。

**推奨: `--resolve-implementations` フラグを使用する**

STEP 4 で lsprefs-walk を実行する際に `--resolve-implementations` フラグを追加してください。このフラグを有効にすると、LSP の `textDocument/implementation` を使って具象実装を自動検出し、各実装を追加の BFS 起点として投入します。実装ノードには `note` に `resolved-impl` マーカーが付与されます。

設定方法:
- CLI 引数: `--resolve-implementations`
- config.json: `"resolve_implementations": true`

**フォールバック: 手動での補完**

`--resolve-implementations` が期待通り動作しない場合は、以下の手動手順を実行してください:
1. `rg --vimgrep "function <メソッド名>" -g'*.php' .`（または `-g'*.{ts,tsx}'`）で具象実装の一覧を取得
2. 実装数が少ない場合（〜10件）: 主要な実装それぞれを起点として追加の lsprefs-walk を実行
3. 実装数が多い場合（10件超）: summary.md に「N件の具象実装が存在し、signature 変更時は全て修正が必要」と記載し、一覧をリストアップ
4. 呼び出し箇所の追跡は interface 起点の lsprefs-walk で十分（ポリモーフィック呼び出しが追跡される）

記録する際に、rg の実行場所（方法B or A）も覚えておいてください。STEP 3 のパス設定に必要です。

---

### STEP 2: lsprefs デーモンの準備

`lsprefs-walk` は内部で `lsprefs` デーモンに接続して refs/def を取得します。デーモンが起動していることを確認し、未起動なら起動します。

**`--root` は config.json の `root` と同じ値を指定してください。** パスが異なるとファイル解決に失敗します。

**`--server` には STEP 1-2a で決定した LSP サーバーコマンドを指定してください。**

```bash
cd "${AI_TOOLS_DIR}"

# PHP の場合:
./bin/lsprefs start --root "$(cd "${REPO_PATH}" && pwd)" --server "intelephense --stdio"

# JS/TS の場合:
./bin/lsprefs start --root "$(cd "${REPO_PATH}" && pwd)" --server "typescript-language-server --stdio"
```

- `already running ...` と表示されたら OK（既に起動済み）
- `started daemon ...` と表示されたら OK（新規起動）
- エラーの場合はユーザーに報告して中断

---

### STEP 3: config.json の動的生成

`lsprefs-walk` 用の設定ファイルを一時ファイルとして生成します。

Write ツールで以下の JSON を生成してください。
**全てのパスは絶対パスで記述することを推奨します**（相対パス起因のファイル解決失敗を防ぐため）。

```json
{
  "root": "<REPO_PATH の絶対パス>",
  "lsprefs": "<AI_TOOLS_DIR の絶対パス>/bin/lsprefs",
  "state_dir": ".cache",
  "out": "<OUT_DIR の絶対パス>/evidence.tsv",
  "timeout": "30s",
  "max_depth": <MAX_DEPTH>,
  "max_nodes": <MAX_NODES>,
  "max_refs_per_node": 300,
  "exclude": [<EXCLUDEパターンの配列>],
  "server": "<LSP_SERVER コマンド>",
  "resolve_implementations": false
}
```

ファイルパス: `${OUT_DIR}/impact-analysis-config.json`

**`server` フィールド**: STEP 1-2a で決定した LSP サーバーコマンドを設定します。`--server` CLI 引数でオーバーライドも可能です。

**複数起点の場合**: 起点ごとに `out` パスを別名にした config.json を生成します。

```json
// 起点1用: ${OUT_DIR}/config-origin1.json
{ ..., "out": "${OUT_DIR}/evidence-origin1.tsv" }

// 起点2用: ${OUT_DIR}/config-origin2.json
{ ..., "out": "${OUT_DIR}/evidence-origin2.tsv" }
```

**異なる言語の起点がある場合**: 起点ごとに `server` も変更してください。

```json
// PHP 起点用:
{ ..., "server": "intelephense --stdio", "out": "${OUT_DIR}/evidence-php.tsv" }

// JS/TS 起点用:
{ ..., "server": "typescript-language-server --stdio", "out": "${OUT_DIR}/evidence-ts.tsv" }
```

**パス解決の注意**:
- `root`: **STEP 2 の `lsprefs start --root` と同じ値にすること**。最も安全なのは絶対パス
- `lsprefs`: 絶対パス推奨（例: `/Users/xxx/projects/ai-tools/bin/lsprefs`）
- `out`: 絶対パス推奨
- `server`: LSP サーバーコマンド。PATH に入っていれば短縮名で可

---

### STEP 4: lsprefs-walk の実行

生成した config.json と起点 rgline を使って BFS 探索を実行します。

```bash
cd "${AI_TOOLS_DIR}"
./bin/lsprefs-walk run \
  --config "${OUT_DIR}/impact-analysis-config.json" \
  --rgline "${RGLINE}" \
  --server "${LSP_SERVER}" \
  2>&1
```

**インターフェースメソッド起点の場合**: `--resolve-implementations` を追加して具象実装も自動追跡してください:

```bash
cd "${AI_TOOLS_DIR}"
./bin/lsprefs-walk run \
  --config "${OUT_DIR}/impact-analysis-config.json" \
  --rgline "${RGLINE}" \
  --server "${LSP_SERVER}" \
  --resolve-implementations \
  2>&1
```

**注意**: `--rgline` に渡すパスは STEP 1 で rg が出力したそのままの値を使ってください。config.json の `root` と整合していれば正しく動作します。stderr に `wrote <path>` と表示されれば成功です。

**複数起点の場合**: 各起点ごとに lsprefs-walk run を実行します。

```bash
# 起点1（例: PHP）
./bin/lsprefs-walk run \
  --config "${OUT_DIR}/config-origin1.json" \
  --rgline "${RGLINE_1}" \
  --server "intelephense --stdio" \
  2>&1

# 起点2（例: TypeScript）
./bin/lsprefs-walk run \
  --config "${OUT_DIR}/config-origin2.json" \
  --rgline "${RGLINE_2}" \
  --server "typescript-language-server --stdio" \
  2>&1
```

各実行の結果を個別に検証してから STEP 4.5 に進みます。

**結果の検証**:

実行後、evidence.tsv を読み取り、以下を確認します:
1. ファイルが生成されていること
2. 1行目がヘッダー行であること（`step\tdepth\tkind\t...`）
3. `status=error` の行がないか確認
4. `status=truncated` の行がある場合、`max_nodes` や `max_depth` の引き上げを検討

エラーが見つかった場合:
- `lsprefs def failed` → 起点の rgline が不正。STEP 1 に戻り別の起点を選ぶ
- `truncated` → パラメータを引き上げて STEP 3 から再実行（ユーザーに確認）
- LSP 関連エラー → lsprefs デーモンの再起動を試みる

---

### STEP 4.5: 複数起点の統合（merge）

> **このステップは起点が複数ある場合のみ実行します。起点が1つの場合はスキップしてください。**

STEP 4 で各起点ごとに生成された個別 evidence TSV を `lsprefs-walk merge` で統合します。

```bash
cd "${AI_TOOLS_DIR}"
./bin/lsprefs-walk merge \
  --out "${OUT_DIR}/evidence.tsv" \
  "${OUT_DIR}/evidence-origin1.tsv" \
  "${OUT_DIR}/evidence-origin2.tsv"
```

3起点以上の場合も同様に引数を追加します。

**merge が行うこと**:
1. `origin_id` カラムの付与（O1, O2, ...）— `step` の次（2列目）に挿入
2. `node_id`, `parent_node_id`, `ref_id`, `from_ref_id` の名前空間リネーム（例: N0 → O1_N0, r1 → O1_r1）
3. 同一ノード検出: 同じ `file:line:col` を持つ NODE 行が複数起点に存在する場合、2番目以降を `status=merged`、`note` に `merged_to=<最初のnode_id>` を付与
4. `step` を1から通し番号で振り直し（起点順: O1全行 → O2全行 → ...）

**統合後のTSVカラム（14列）**:

| カラム | 説明 |
|--------|------|
| `step` | 通し番号（振り直し済み） |
| `origin_id` | 起点識別子（O1, O2, ...） |
| `depth` 〜 `note` | 単一起点 TSV と同じ（ただし ID はリネーム済み） |

**結果の検証**:
1. 統合 TSV が生成されていること
2. `origin_id` カラムが正しく付与されていること
3. `node_id` が `O1_N0`, `O2_N0` 形式にリネームされていること
4. 同一ノードが `merged` ステータスになっていること
5. `step` が1から連番であること

---

### STEP 5: evidence.tsv の分析と summary.md の生成

evidence.tsv を Read ツールで読み込み、分析して summary.md を生成します。

**5-1. TSV の読み方**

evidence.tsv は BFS 探索ログです。各カラムの意味:

| カラム | 意味 |
|--------|------|
| `step` | 通し番号（昇順） |
| `origin_id` | 起点識別子（O1, O2, ...）— **複数起点の統合TSVのみ** |
| `depth` | BFS の深さ（0=起点） |
| `kind` | `NODE`=ノード登録, `REF`=参照箇所, `DEF`=呼び出し元特定 |
| `node_id` | ノードID（N0, N1, ...） |
| `parent_node_id` | 親ノードID（起点は `-`） |
| `ref_id` | REF の連番（r1, r2, ...） |
| `from_ref_id` | DEF がどの REF から生まれたか |
| `file` | ファイルパス（リポジトリルート相対） |
| `line` | 行番号（1-based） |
| `col` | カラム番号（1-based） |
| `snippet` | 該当行の1行スニペット |
| `status` | `ok` / `merged` / `excluded` / `notfound` / `error` / `truncated` |
| `note` | 追加情報（enclosing callable 名、除外理由等） |

**kind の読み方**:
- `NODE`: BFS キューに入った関数/メソッドの定義位置
- `REF`: そのノードが参照されている箇所（= `lsprefs refs` の結果）
- `DEF`: REF箇所を含む呼び出し元関数（enclosing callable）。**LSP の definition ではない**

**status の読み方**:
- `merged`: 同一ノードに合流済み（深掘りしないが証跡は残る）
- `truncated`: 上限到達で打ち切り

**5-2. 分析のポイント**

1. `kind=NODE` かつ `status=ok` の行を抽出 → **影響を受ける全関数/メソッドの一覧が得られる**（起点 depth=0 だけでなく、BFS で発見された depth>0 のノードにも NODE 行が出力される）。従来の `kind=DEF` かつ `status=ok` でも同じノード情報は得られるが、NODE でフィルタする方が簡潔
2. `note` 内の `enclosing=...` `class=...` からクラス・メソッド名を読み取る
3. `file` カラムからディレクトリ構造・レイヤーを推定
4. `depth` の最大値から影響の伝搬の深さを把握
5. `status=error` や `status=truncated` があれば注意事項として記載
6. 起点がインターフェースメソッドの場合: evidence.tsv のノード数が少ない場合は、STEP 1-3 の「インターフェースメソッドの補完」が行われたか確認し、具象実装の一覧を summary.md に含める
7. **複数起点の統合TSVの場合**:
   - `origin_id` でフィルタして起点ごとの影響範囲を比較する
   - `status=merged` の行を抽出し、起点間で合流するノード（共通の影響箇所）をハイライトする
   - 起点間の合流が多い → 密結合。少ない → 各起点の影響は独立的

**5-3. summary.md の生成**

以下の形式で summary.md を Write ツールで生成してください:

```markdown
# 影響調査レポート

## 調査概要
- 調査対象: <ユーザーのリクエスト要約>
- 調査パターン: <コード起点（パターンA） or 仕様起点（パターンB）>
- 調査日時: <YYYY-MM-DD HH:MM>
- 起点: <起点シンボル名>（`<file>:<line>`）
- 言語: <PHP / JavaScript / TypeScript>
- LSP サーバー: <使用した LSP サーバーコマンド>
- 探索パラメータ: max_depth=<N>, max_nodes=<N>

## 第1段階: 仕様→コード箇所マッピング（仕様起点の場合のみ）

> **このセクションは仕様起点（パターンB）の場合のみ記載します。コード起点（パターンA）の場合は省略してください。**

### 仕様変更の内容
<ユーザーが要望した仕様変更の記述をそのまま引用>

### コード箇所の特定過程

**アーキテクチャ把握**:
<プロジェクト構造の概要。どのようなディレクトリ構成・設計パターンかを簡潔に>

**キーワード探索**:
<どのようなキーワードで検索したか、何がヒットしたか>

| 検索キーワード | ヒット数 | 主なファイル |
|--------------|---------|------------|
| <keyword1> | <N> | <主なファイル> |
| <keyword2> | <N> | <主なファイル> |

**絞り込みの推論**:
<候補からどのように起点を絞り込んだか。読んだファイル、判断の根拠を記載>

**特定した起点**:
| # | シンボル | ファイル | 行 | 言語 | 選定理由 |
|---|---------|---------|-----|------|---------|
| 1 | <Class::method> | `<file>` | <line> | <PHP/TS/JS> | <なぜこの箇所か> |

**自信度**: <高/中/低>
**自信度の根拠**: <なぜその自信度か>

## 影響範囲の概要
- 影響ファイル数: <N>
- 影響ノード数: <N>（影響を受ける関数/メソッド数）
- 最大到達深度: <N>
- 総 evidence 行数: <N>

## 重大な影響のピックアップ

<特に注意が必要な箇所を解説。以下の観点で選定:>
<- 公開 API やエントリーポイントに到達しているか>
<- データ永続化（DB書き込み等）に影響するか>
<- 到達深度が深い（影響が広範囲に伝搬している）箇所>

### <影響箇所1>
- ファイル: `<file>:<line>`
- 関数: `<class>::<method>`
- 影響理由: <なぜ重大か>

### <影響箇所2>
...

## 機能別の影響整理

<evidence.tsv の内容をディレクトリ構造やクラスのカテゴリで再整理>

| カテゴリ | 影響ノード数 | 主な影響箇所 |
|---------|------------|------------|
| <カテゴリ1> | <N> | <主要なクラス::メソッド> |
| ... | ... | ... |

## 注意事項・リスク
- <静的解析の限界（動的ディスパッチ、リフレクション等）>
- <truncated があった場合はその旨>
- <error があった場合はその旨>
- <除外パターンで除外されたが注意が必要な箇所>
```

**複数起点の場合**: 上記テンプレートに以下のセクションを追加してください。

```markdown
## 起点一覧

| # | origin_id | シンボル名 | ファイル | 行 | 言語 | ノード数 |
|---|-----------|-----------|---------|-----|------|---------|
| 1 | O1 | <シンボル名1> | `<file1>` | <line1> | <PHP/TS/JS> | <N> |
| 2 | O2 | <シンボル名2> | `<file2>` | <line2> | <PHP/TS/JS> | <N> |

## 起点間の影響比較

| 観点 | O1 (<シンボル名1>) [<言語>] | O2 (<シンボル名2>) [<言語>] |
|------|---------------------------|---------------------------|
| 影響ノード数 | <N> | <N> |
| 最大到達深度 | <N> | <N> |
| 影響ファイル数 | <N> | <N> |

## 起点間の合流ノード（merged）

<起点間で同じ file:line:col に到達したノードをリストアップ。
これらは複数の起点から影響が集中する箇所であり、特に注意が必要。>

| merged ノード | ファイル | 行 | 合流元 |
|--------------|---------|-----|-------|
| <node_id> | `<file>` | <line> | O1_N?, O2_N? |
```

---

### STEP 6: 出力の確認と報告

1. `${OUT_DIR}/evidence.tsv` が存在することを確認
2. `${OUT_DIR}/summary.md` が存在することを確認
3. ユーザーに以下を報告:
   - 出力ファイルのパス
   - 影響ノード数と最大深度の概要
   - 特に重大な影響のハイライト（summary.md の「重大な影響のピックアップ」から）

---

## 言語間追跡パターン（パターンC: クロスランゲージ）

サーバサイド（PHP）→ フロントサイド（JS/TS）、またはその逆方向に影響が波及する場合のパターンです。

### 判定基準

以下の場合にパターンCを適用します:
- 仕様変更が API のレスポンス形式やエンドポイントに影響する
- サーバサイドの関数変更がフロントサイドの呼び出しに影響する
- 共有型定義や API スキーマの変更

### 実行手順

**C-1. 第1言語側の影響追跡**

まず、変更の起点がある言語側で通常の影響追跡（STEP 1〜4）を実行します。

```bash
# 例: PHP 側の変更が起点
cd "${AI_TOOLS_DIR}"
./bin/lsprefs-walk run \
  --config "${OUT_DIR}/config-php.json" \
  --rgline "${RGLINE_PHP}" \
  --server "intelephense --stdio" \
  2>&1
```

**C-2. 橋渡しポイントの特定（AI 判断）**

第1言語側の evidence.tsv を分析し、言語間の橋渡しポイントを特定します。これは AI の判断で行います。

**橋渡しポイントの例**:
- API エンドポイントの定義（ルーティング定義、コントローラーのアクション）
- API レスポンスの型定義 / JSON 構造
- 共有定数 / 設定値
- WebSocket イベント名
- GraphQL スキーマ定義

**特定方法**:
1. evidence.tsv の影響ノードから、API 関連のクラス/関数を探す
2. ルーティング定義ファイルから該当エンドポイントの URL パスを取得
3. レスポンス構造が変わる場合、変更されるフィールド名を記録

**C-3. 第2言語側での検索**

橋渡しポイントをキーワードとして、第2言語側で rg 検索を実行します。

```bash
cd "${REPO_PATH}"

# エンドポイント URL で検索
rg --vimgrep "/api/users" -g'*.{ts,tsx,js,jsx}' . | head -n 20

# レスポンスフィールド名で検索
rg --vimgrep "fieldName" -g'*.{ts,tsx,js,jsx}' . | head -n 20

# API クライアント関数で検索
rg --vimgrep "fetchUsers\|getUsers" -g'*.{ts,tsx,js,jsx}' . | head -n 20
```

**C-4. 第2言語側の影響追跡**

見つかった JS/TS ファイルから起点を選定し、第2言語側でも lsprefs-walk を実行します。

```bash
cd "${AI_TOOLS_DIR}"
./bin/lsprefs-walk run \
  --config "${OUT_DIR}/config-ts.json" \
  --rgline "${RGLINE_TS}" \
  --server "typescript-language-server --stdio" \
  2>&1
```

**C-5. 統合**

両言語の evidence.tsv を merge で統合します。

```bash
./bin/lsprefs-walk merge \
  --out "${OUT_DIR}/evidence.tsv" \
  "${OUT_DIR}/evidence-php.tsv" \
  "${OUT_DIR}/evidence-ts.tsv"
```

`origin_id` で言語を区別します（例: O1 = PHP 側、O2 = JS/TS 側）。

**C-6. summary.md への追加セクション**

言語間追跡を行った場合、summary.md に以下を追加してください:

```markdown
## 言語間追跡

### 橋渡しポイント
| # | 種別 | 第1言語側 | 第2言語側 | 詳細 |
|---|------|----------|----------|------|
| 1 | API エンドポイント | `<PHP controller>` | `<TS fetch call>` | `GET /api/users` |
| 2 | レスポンスフィールド | `<PHP response>` | `<TS interface>` | `user.email` フィールド |

### 言語別影響サマリ
| 言語 | origin_id | 影響ノード数 | 影響ファイル数 |
|------|-----------|------------|-------------|
| PHP | O1 | <N> | <N> |
| TypeScript | O2 | <N> | <N> |

### 注意事項
- 言語間の橋渡し（API エンドポイント、レスポンス構造等）は AI の推論に基づくため、rg 検索で漏れがある可能性がある
- 動的に生成される URL パスやフィールド名は静的検索では発見できない
- API ドキュメント（OpenAPI / Swagger 等）がある場合はそちらも参照することを推奨
```

---

## エラー時の対処

| エラー | 原因 | 対処 |
|--------|------|------|
| `lsprefs def failed` | 起点の rgline が不正、またはデーモン未起動 | STEP 1 で別の起点を選択、または STEP 2 でデーモン再起動 |
| `ambiguous definition: N candidates` | 定義が複数見つかった | rg 結果から定義箇所を絞り込んで再試行 |
| `ambiguous definition: 0 candidates` | rgline の col がシンボル名を指していない | STEP 1 の「カラム位置の注意」に従い、col をシンボル名の開始位置に修正 |
| `connect to daemon socket ... (is the daemon running?)` | lsprefs デーモンが停止 | STEP 2 で `lsprefs start` を実行 |
| `status=truncated` が多数 | 影響範囲が設定上限を超えた | `max_depth` / `max_nodes` を引き上げて再実行 |
| `status=error` | LSP エラー等 | エラー内容を確認し、summary.md に注意事項として記載 |
| `warning: resolve-implementations: textDocument/implementation` | LSP が implementation を未サポート | STEP 1-3 のフォールバック（手動 rg）を実行。BFS は通常通り続行される |
| `warning: resolve-implementations: ...` | 実装解決に失敗（タイムアウト等） | stderr の警告を確認。BFS は通常通り続行されるが、具象実装が不足する可能性あり |
| `merge requires at least 2 input files` | merge に入力ファイルが不足 | 2つ以上の evidence TSV を引数に指定 |
| `expected 13 header columns, got N` | 入力 TSV のフォーマットが不正 | lsprefs-walk run で生成された正しい TSV を使用しているか確認 |
