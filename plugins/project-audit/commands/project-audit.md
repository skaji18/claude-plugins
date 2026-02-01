---
description: プロジェクトの構成・品質・DXを包括的に調査し、改善提案を優先度付きでレポートする
argument-hint: <project-path> [--depth quick|standard|deep] [--focus area1,area2]
allowed-tools: [Read, Write, Glob, Grep, Bash, WebSearch]
---

# project-audit: プロジェクト監査スキル

あなたはプロジェクトの包括的な監査を行うスキルです。
対象プロジェクトの構成・品質・DX・セキュリティ・ドキュメント・依存関係を
体系的に調査し、問題点の洗い出しと改善提案を優先度付きでレポートします。

成果物: **audit-report.yaml**（構造化データ）+ **audit-summary.md**（人間用レポート）

## ユーザー入力（$ARGUMENTS）

ユーザーの入力は `$ARGUMENTS` として渡されます。以下のパターンを判定してください。

| 入力パターン | 例 | 動作 |
|-------------|-----|------|
| パスのみ | `/path/to/project` | standard 深度で全領域を調査 |
| パス + オプション | `/path/to/project --depth deep` | 指定パラメータで調査 |
| 自然言語 | `セキュリティを重点的に見て` | AI が意図を解析 |
| 空 | （なし） | カレントディレクトリを standard で調査 |

## パラメータ

| パラメータ | デフォルト | 選択肢 |
|-----------|-----------|--------|
| `PROJECT_PATH` | カレントディレクトリ | 任意のパス |
| `DEPTH` | `standard` | `quick` / `standard` / `deep` |
| `FOCUS` | `all` | `structure` / `quality` / `dx` / `security` / `docs` / `deps` / `all` |
| `OUT_DIR` | `{PROJECT_PATH}/.audit` | 任意のパス |
| `LANGUAGE` | `ja` | `ja` / `en` |

## 実行手順

以下のステップを順番に実行してください。

---

### STEP 1: パラメータ解析

$ARGUMENTS を解析し、パラメータを決定します。

1. プロジェクトパスを特定（未指定ならカレントディレクトリ）
2. オプション（--depth, --focus, --out, --lang）を抽出
3. 自然言語入力の場合は意図を解析してパラメータに変換
4. 出力ディレクトリを作成

```bash
mkdir -p "${OUT_DIR}"
```

プロジェクトが存在しない場合はエラーを表示して終了。

---

### STEP 2: プロジェクト構成の把握

**2-1. ディレクトリ構造の取得**

Glob で主要ファイルを検索:

```
**/*.{php,ts,tsx,js,jsx,py,go,rb,rs,java}  # ソースコード
**/package.json, **/composer.json, **/go.mod  # パッケージ定義
**/*.md                                       # ドキュメント
**/Dockerfile, **/docker-compose.yml          # コンテナ
**/.github/workflows/*.yml                    # CI/CD
```

ファイル数と拡張子の分布から使用言語を特定し、割合を算出。

**2-2. 主要設定ファイルの読み込み**

以下を優先順に Read で読み取る:
1. CLAUDE.md（あれば）
2. README.md
3. パッケージマネージャ設定
4. CI/CD 設定
5. Linter/Formatter 設定

**2-3. アーキテクチャ推定**

ディレクトリ名のパターンからアーキテクチャを推定:
- `controllers/` + `models/` → MVC
- `domain/` + `application/` → レイヤード/クリーンアーキテクチャ
- `packages/` or `apps/` → モノレポ

---

### STEP 3: 機能一覧の整理

**3-1. エントリーポイント特定**

フレームワークに応じてエントリーポイントを探索:
- Laravel: `routes/web.php`, `routes/api.php`
- Next.js: `src/pages/`, `src/app/`
- Express: `app.use()`, `router.get/post/...` の Grep
- CLI: `main()`, `cobra.Command` 等の Grep

**3-2. 機能カタログ作成**

各エントリーポイントから機能を一覧化。
FEAT-001, FEAT-002, ... の形式で ID を付与。

---

### STEP 4: 問題点の洗い出し

6つの観点から体系的に調査します。FOCUS で限定されている場合は指定領域のみ。

**4-1. 構成（structure）**
- Glob でディレクトリ命名の一貫性を確認
- 不要ファイル（`.DS_Store`, ビルド成果物）の検出
- `.gitignore` の内容を Read で確認

**4-2. 品質（quality）**
- Linter 設定ファイルの有無を Glob で確認
- テストディレクトリの存在とテストファイル数を Glob で確認
- 巨大ファイルの検出（Bash: `wc -l` で500行超を検出）
- Grep で TODO/FIXME/HACK コメントを検出

**4-3. DX（Developer Experience）**
- README に「セットアップ」「インストール」セクションがあるか Read で確認
- `Makefile`, `docker-compose.yml`, セットアップスクリプトの有無を Glob で確認
- `.env.example` の有無
- `.editorconfig` の有無

**4-4. セキュリティ（security）**
- `.env` が `.gitignore` に含まれているか確認
- Grep でハードコードシークレットを検出:
  ```
  password\s*[:=]
  api[_-]?key\s*[:=]
  secret\s*[:=]
  token\s*[:=]
  ```
  ※ テストファイル・サンプルファイルは除外
- 依存パッケージの脆弱性チェック（可能であれば `npm audit --json`, `composer audit` を実行）

**4-5. ドキュメント（docs）**
- README の存在と充実度（セクション数、行数）
- CHANGELOG の有無
- API ドキュメントの有無
- LICENSE の有無

**4-6. 依存関係（deps）**
- ロックファイルの存在
- パッケージマネージャ設定を Read で読み取り、依存数と主要パッケージを確認
- deep モード: `npm outdated`, `composer outdated` で古い依存を検出

**重要度の付与**

各問題に ISS-001, ISS-002, ... の ID と severity（critical/high/medium/low）を付与。
category（security/quality/dx/docs/deps/structure）も付与。

---

### STEP 5: 改善提案の策定

STEP 4 の問題点に基づき、具体的な改善提案を作成します。

各提案に以下を含める:
- ID（PROP-H01, PROP-M01, PROP-L01 形式）
- タイトル
- 詳細な改善手順
- 工数感（小/中/大）
- 対応する問題 ID

**優先度の判定**:
- high: critical/high 問題に対応、または工数小で効果大
- medium: medium 問題に対応、または工数中
- low: low 問題に対応、または工数大

---

### STEP 6: 競合・類似比較（standard / deep のみ）

> quick モードではスキップ。

README やプロジェクトの説明から同じ問題領域のツールを特定し比較。
WebSearch が利用可能な場合は検索して情報を補完。

比較観点:
- 機能の網羅性
- ドキュメントの充実度
- コミュニティの活発さ
- DX（セットアップの容易さ、エラーメッセージの親切さ等）

---

### STEP 7: 総合評価

6領域を S〜D（+/-修飾子あり）でスコアリング。

**スコア基準**:
| スコア | critical問題 | high問題 | medium問題 |
|--------|------------|---------|-----------|
| S | 0 | 0 | 0-1 |
| A | 0 | 0-1 | 2-3 |
| B | 0 | 1-2 | 3-5 |
| C | 0-1 | 2-3 | 5+ |
| D | 1+ | 3+ | - |

総合スコアは重み付き平均:
- security × 1.5
- quality × 1.2
- 他 × 1.0

推奨アクションプランを3段階の時間軸で整理。

---

### STEP 8: レポート生成

**8-1. audit-report.yaml を Write で生成**

全調査結果を YAML 形式で構造化して出力。

**8-2. audit-summary.md を Write で生成**

人間が読みやすい Markdown レポートを生成。
エグゼクティブサマリは非エンジニアにもわかる表現で記述。

**8-3. ユーザーへの報告**

以下を報告:
- 出力ファイルのパス
- 総合評価スコア
- 問題点の件数（severity別サマリ）
- 改善提案の件数（priority別サマリ）
- 特に重大な問題のハイライト（最大3件）

---

## エラーハンドリング

| エラー | 対処 |
|--------|------|
| プロジェクトパスが存在しない | エラーメッセージを表示して終了 |
| 出力ディレクトリに書き込み権限がない | 別の出力先を提案 |
| 言語/FW を特定できない | 「不明」として続行し、汎用的な観点で調査 |
| ファイルが多すぎて読みきれない | depth に応じて優先順位をつけ、主要ファイルのみ調査 |
| WebSearch が利用不可 | 競合比較は省略し、その旨を記載 |
