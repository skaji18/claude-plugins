# project-audit

Claude Code 用の包括的プロジェクト監査スキル。プロジェクトの6つの主要領域（構成・品質・DX・セキュリティ・ドキュメント・依存関係）を分析し、優先度付きの問題点と改善提案をレポートします。

## 概要

**project-audit** はソフトウェアプロジェクトの体系的な健康診断を行います：

| 領域 | チェック内容 |
|------|------------|
| **構成（Structure）** | ディレクトリ構造、命名規則、アーキテクチャパターン |
| **品質（Quality）** | Linter/Formatter設定、テスト、エラーハンドリング、巨大ファイル、コードスメル |
| **DX** | READMEの充実度、セットアップスクリプト、CI/CD、開発環境設定 |
| **セキュリティ（Security）** | ハードコードされた秘密情報、.envの露出、依存パッケージの脆弱性 |
| **ドキュメント（Docs）** | READMEの完全性、CHANGELOG、APIドキュメント、LICENSE |
| **依存関係（Deps）** | ロックファイル、古いパッケージ、未使用の依存、ライセンス互換性 |

外部ツール依存なし — Claude Code の標準ツール（Read, Write, Glob, Grep, Bash）のみで動作します。

## インストール

Claude Code の設定にプラグインを追加：

```bash
# プロジェクトまたはグローバル設定
claude plugin add github:skaji18/claude-plugins/plugins/project-audit
```

または `.claude/settings.json` に追加：

```json
{
  "plugins": [
    "github:skaji18/claude-plugins/plugins/project-audit"
  ]
}
```

## 使い方

```
/project-audit [プロジェクトパス] [オプション]
```

### パラメータ

| パラメータ | デフォルト | 選択肢 |
|-----------|-----------|--------|
| `PROJECT_PATH` | カレントディレクトリ | 任意のパス |
| `--depth` | `standard` | `quick` / `standard` / `deep` |
| `--focus` | `all` | `structure` / `quality` / `dx` / `security` / `docs` / `deps` / `all` |
| `--out` | `{PROJECT_PATH}/.audit` | 任意のパス |
| `--lang` | `ja` | `ja` / `en` |

### 調査深度

| 深度 | 調査範囲 | 読み込みファイル数 | 競合比較 |
|------|---------|------------------|---------|
| `quick` | ディレクトリ構造 + 設定ファイル + README | 主要ファイル約20件 | なし |
| `standard` | quick + ソースコード抽出調査 + 依存関係 | 主要ファイル約50件 | 簡易比較 |
| `deep` | standard + 全ファイル網羅的調査 + 詳細分析 | 制限なし | 詳細比較 |

## 出力

出力ディレクトリに2つのファイルが生成されます：

### audit-report.yaml

機械可読な構造化YAMLデータ。他ツールとの連携に利用：

```yaml
meta:
  tool: project-audit
  version: "1.0.0"
  project_path: "/path/to/project"
  depth: standard
  timestamp: "2026-02-01T10:00:00"

project_structure:
  overview: "..."
  languages: [...]
  frameworks: [...]

issues:
  - id: ISS-001
    severity: high
    category: security
    title: "ハードコードされたAPIキーを検出"

improvement_proposals:
  high: [...]
  medium: [...]
  low: [...]

overall_assessment:
  health_score: "B"
  scores:
    structure: "B+"
    quality: "A-"
    ...
```

### audit-summary.md

人間が読みやすいMarkdownレポート。チームメンバー、クライアント、上長への共有に適しています：

- エグゼクティブサマリ（非エンジニアにもわかる表現）
- 総合ヘルススコア（S/A/B/C/Dスケール）
- 領域別スコアの内訳
- 重要度別の問題点一覧
- 優先度付き改善提案（工数感付き）
- 推奨アクションプラン（即座・短期・中長期）

## スコアリング

各領域はS〜Dのスケールで評価されます：

| スコア | 意味 |
|--------|------|
| **S** | 模範的。改善の余地がほぼない |
| **A** | 良好。軽微な改善点のみ |
| **B** | 標準的。いくつかの改善が望ましい |
| **C** | 要改善。重要な問題が複数ある |
| **D** | 深刻。即座の対応が必要 |

`+` / `-` の修飾子で細分化（例: `B+`, `A-`）。

総合スコアは重み付き平均：セキュリティ（x1.5）、品質（x1.2）、その他（x1.0）。

## 使用例

### カレントディレクトリのクイック監査

```
/project-audit --depth quick
```

ディレクトリ構造と設定ファイルを素早くスキャン。初見のプロジェクトの概要把握に最適。

### セキュリティ重点の標準監査

```
/project-audit /path/to/project --focus security,quality
```

セキュリティとコード品質に絞った標準深度の監査を実行。

### リファクタリング計画用の詳細監査

```
/project-audit /path/to/project --depth deep --lang en
```

プロジェクト全体の網羅的分析と競合比較。英語で出力。包括的なリファクタリングロードマップの作成に最適。

### 自然言語入力

```
/project-audit このプロジェクトが本番環境に出せる状態か確認したい
```

AIが意図を解析し、適切な監査を実行（おそらくセキュリティと品質に重点を置いた標準深度）。

## impact-analysis との比較

| 観点 | impact-analysis | project-audit |
|------|----------------|---------------|
| 目的 | コード変更の影響範囲を追跡 | プロジェクト全体の健康状態を診断 |
| 手法 | LSP + BFS による機械的追跡 | AIの分析力を活かした包括的診断 |
| 外部ツール | lsprefs, LSPサーバー | なし |
| 出力 | evidence.tsv + summary.md | audit-report.yaml + audit-summary.md |
| 粒度 | 関数/メソッド単位 | プロジェクト単位 |

## ライセンス

リポジトリルートの [LICENSE](../../LICENSE) を参照してください。
