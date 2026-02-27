# permission-guard Design Document

## 1. hookの存在意義（Why）

Claude Codeのネイティブ権限システム（`settings.json`の`allow`/`ask`/`deny`）は、表現力に限界がある:

- **ネイティブ`deny`は禁止範囲が広くなりがち**: コマンド全体をブロックすると、安全な用途まで制限され、ユーザー利便性が著しく低下する
- **ネイティブ`allow`は許可範囲が広くなりがち**: コマンド全体を自動承認すると、危険な用途まで許可されるため、エンタープライズ環境では採用困難

permission-guardフックは、この**粒度の粗さと安全性のギャップを埋める**ために存在する。

### 精密判定の具体例

hookが提供する「コンテキスト依存の精密判定」:

1. **コマンドパス包含チェック**: `.venv/bin/pytest tests/` → allow（プロジェクト内コマンド）/ `/tmp/evil.sh` → ask（外部）
2. **引数パス包含チェック**: `python3 scripts/analyze.py` → allow（プロジェクト内）/ `python3 /tmp/evil.py` → ask（外部）
3. **サブコマンド粒度**: `git status` → allow / `git push` → ask
4. **危険フラグ検出**: `git commit` → allow / `git push --force` → ask

これらは、ネイティブ権限システムでは「`bash`全体をallow/deny」の二択しかない判定を、**実行コンテキストに応じて適切にルーティング**できる。

## 2. 評価順序と責務範囲

hookの呼び出しタイミングとネイティブ権限の関係:

```
settings.json deny → block (hookは呼ばれない)
settings.json allow → allow (hookは呼ばれない)
ask or マッチなし → PreToolUse → hook評価
```

### hookの責務

- **責務範囲**: ネイティブ`allow`/`deny`に引っかからなかったコマンドに対する精密判定
- **提供価値**: 「列挙を不要にすること」ではなく、「列挙されたコマンドに対してより精密な判定を行うこと」

例: `settings.json`で`bash`を`ask`に設定した場合、hookは`bash scripts/safe.sh`と`bash -c "code"`を識別し、前者のみ自動承認できる。これにより、安全な用途のUXを損なわずセキュリティを確保する。

## 3. 設計原則

### deny-by-default

- **原則**: 未知コマンドは`ask`（ユーザー確認）
- **実装**: `known_safe`リスト（~40-50コマンド）による明示的承認
- **根拠**: 新しいコマンド/インタプリタ/危険フラグの組み合わせは無限にあり、allowlist方式でなければ将来のバイパスベクターを防げない

### fail-closed

- **原則**: 判定できない場合は安全側（`ask`）に倒す
- **実装例**:
  - Phase 4: unknown flag → `ask`
  - Phase 7B2: サブコマンド抽出失敗 → `ask`
  - 設定ファイル読み込み失敗 → `ask`

### 安全列挙（Safe Enumeration）

- **danger-enumerationの問題**: 危険なサブコマンドを列挙する方式（`subcommand_ask`）は構造的に漏れやすい（cmd_097で7+個の破壊的gitコマンドの列挙漏れを確認）
- **safe-enumerationへの移行**: 安全なサブコマンドを列挙し、未知は`ask`（fail-closed）
- **設計**:
  ```yaml
  subcommand_rules:
    git:
      allow: [status, log, diff, show, branch, tag, ...]  # 読み取り専用
      ask: [push, clean, reset, checkout, ...]  # 明示的確認が必要
      default_action: ask  # 未知サブコマンドはask
  ```

### メンテナンスフリー志向

- **静的マッピング管理コストの最小化**: フラグ/サブコマンドの全組み合わせを列挙するアプローチは、ツールのバージョンアップごとにメンテナンスが必要
- **解決策**:
  - インタプリタは`known_safe`に含めず、フラグ判定のみ実施（新フラグは自動的にfail-closed）
  - サブコマンドはティア分類（allow/ask/unknown）で、unknownは自動的にask

### known_safe_extra（ユーザー拡張性）

- **セキュリティフロア維持**: ユーザーは`known_safe_extra`で安全コマンドを追加できるが、baseの`known_safe`から削除は不可
- **`always_ask`/`subcommand_ask`と同様の設計**: Layer 2/3で追加のみ、削除は不可

## 4. アーキテクチャ（新設計）

### フェーズ構成（8→5に統合予定）

**現行8フェーズ**:
- S0: null byte check
- Phase 1: control chars, tool_name validation
- Phase 1.5: safe suffix stripping (`2>&1`, `|| true`)
- Phase 2: shell syntax guards（`;`, `|`, `$`, `~`, glob）
- Phase 3: parse command（split, interpreter detection）
- Phase 4: flag classification（safe/dangerous/unknown）
- Phase 5: path normalization（`../` resolution）
- Phase 6: project containment（コマンドパス・リダイレクトパスのプロジェクト包含チェック）
- Phase 7: general command（tools lookup, subcommand matching, flag checks）

**新5フェーズ設計** (P4で実装予定):
- Phase 1: Input sanitization（S0+1統合）
- Phase 2: Command normalization（1.5+2統合）
- Phase 3: Parse and classify（3+4統合: split + interpreter + flags）
- Phase 4: Path resolution and containment（5+6統合）
- Phase 5: Policy evaluation（7を5ステップに分解: known_safe check → always_ask → subcommand_rules → path collection → containment）

### deny-by-default with known_safe

**現状**: Phase 7Dで「パス引数なし」のコマンドは無条件allow（fail-open） → ~30-50%のコマンドがゼロ検証で通過

**実装済み設計**:
```yaml
tools:
  # allowエントリ（自動承認）
  ls: "allow"
  cat: "allow"
  grep: "allow"
  make: "allow"
  cargo: "allow"
  gcc: "allow"
  # ... ~40コマンド

  # askエントリ（ユーザー確認）
  curl: "ask"
  rm: "ask"

  # 複雑エントリ（サブコマンド/フラグ制御）
  git:
    ask: ["push", "clean", "filter-branch", "rebase", "reset"]
    dangerous_flags: ["--force", "-f", "--hard", "-D", "--no-verify"]
    default: "allow"
```

- `tools`で`"allow"`以外のコマンド → `ask`
- データ駆動選定: warn modeで実際のプロジェクトでの使用頻度を測定し、上位40-50コマンドを選定

### 安全列挙（サブコマンド）

**旧設計**: `subcommand_ask`（danger-enumeration） → 破壊的コマンドの列挙漏れリスク

**実装済み設計**: `tools`統一構造でサブコマンド制御
```yaml
tools:
  git:
    ask: ["push", "clean", "filter-branch", "rebase", "reset"]
    dangerous_flags: ["--force", "-f", "--hard", "-D", "--no-verify"]
    default: "allow"  # 未知サブコマンドはallow（default設定で変更可）
```

### コマンドパス包含（project-contained command auto-allow）

**課題**: `.venv/bin/pytest`, `scripts/deploy.sh` などプロジェクト内のコマンドが `unknown_command` として毎回 `ask` になる

**解決策**: コマンド名に `/` が含まれる場合、絶対パスに解決し `phase_6_project_check()` でプロジェクト包含を判定。包含されていれば auto-allow。

```python
# validate_single_command() 内、NEVER_SAFE チェック後・tools lookup 前
if '/' in cmd_name:
    abs_cmd = canonicalize_path(...)  # 相対 → PROJECT_DIR基準で解決
    if phase_6_project_check(abs_cmd, config):
        return ("allow", "project_contained_cmd:...")
```

- 新しい設定キー不要 — 既存の `PROJECT_DIR` + `allowed_dirs_extra` を再利用
- NEVER_SAFE (`sudo`, `su`) は先にチェックされるため影響なし
- `/` を含まないコマンド（`ls`, `git` 等）はスキップし、従来通り tools lookup に進む
- `../../../tmp/evil.sh` のようなパストラバーサルは `normpath` で解決後に包含チェックで弾かれる
- シンボリックリンク: `normpath`（`realpath` ではない）を使用。`.venv/bin/python` のようなシンボリックリンクはリンク元の位置でプロジェクト包含を判定する（リンク先は `/usr/local/...` 等の外部パスだが、リンク自体はプロジェクト内にある）

### パス包含（全引数パス候補化）

**現状**: `/`を含む引数のみパス候補 → `cat .env`, `chmod 777 file.py`は検出されない（bare filename blind spot）

**新設計**: 全非フラグ引数をパス候補として扱う
- `cat main.py` → `PROJECT_DIR/main.py`に解決 → 包含チェック実施
- false rejection不可能: 非パス引数（例: `git status`の`status`）も`PROJECT_DIR/status`に解決されるが、containmentチェックは「プロジェクト内」で通過

### フラグ分解（複合短フラグ対応）

**現状**: `bash -xeu script.sh` → unknown flag reject（`-xeu`が長さ!=2）

**新設計**:
```python
# Step 1: 複合フラグを個別文字に分解
flags = [c for c in word[1:]]  # "-xeu" → ['x', 'e', 'u']

# Step 2: dangerous check first (重要)
for flag in flags:
    if flag in dangerous_flags:
        reject("dangerous_flag")

# Step 3: safe check
for flag in flags:
    if flag not in safe_flags:
        reject("unknown_flag")
```

### インタプリタ拡張

**現状**: `node`, `perl`, `ruby`, `php`は`always_ask`に入っている → フラグレベル判定なし

**新設計**:
```yaml
interpreters:
  bash:
    safe_flags: [n, x, e, u, v, E, f, r]  # 拡充
  sh:
    safe_flags: [x, e, u, v, E, f, r]
  node:
    safe_flags: [e, p, r, i, c, v, ...]
    dangerous_flags: [e]  # -e with code
  perl:
    safe_flags: [w, T, c, ...]
    dangerous_flags: [e]
  ruby:
    safe_flags: [w, d, v, ...]
    dangerous_flags: [e]
  php:
    safe_flags: [v, i, m, ...]
    dangerous_flags: [r]

interpreters_extra: {}  # ユーザー追加可能
```

## 5. known_safeリストの設計思想

hookの価値は列挙の**質**にある:

### 過少（known_safe不足）の問題

- `known_safe`が10個しかない → 残り全てのコマンドで`ask`連発
- 結果: 「ネイティブdenyが広すぎる」と同じUX劣化
- 例: `make`, `cargo`, `npm test`などの開発コマンドが全てask → 1セッション20-30回の確認ダイアログ

### 過剰（known_safe過多）の問題

- `known_safe`が200個ある → hookの精密判定を活かせない
- 結果: セキュリティ面でネイティブallowと同等になり、hookの存在意義が薄れる

### 最適化戦略

1. **データ駆動選定**: warn modeで実運用データ収集 → 使用頻度上位40-50コマンドを選定
2. **ティア分類**:
   - Tier 1 (高頻度・低リスク): `ls`, `cat`, `grep`, `git`, `make`, `cargo`, `npm`, `gcc`, `python3`, `node`
   - Tier 2 (中頻度): `awk`, `sed`, `jq`, `curl`（ただし`curl`は`always_ask`に残す可能性）
3. **known_safe_extra escape hatch**: ユーザー環境固有コマンド（`kubectl`, `terraform`, `ansible`等）は各自追加

## 6. 制約と限界

### スクリプト内容検査不能（全権限システム共通の限界）

- hookが検査できるのは**コマンドライン引数のみ**
- スクリプトファイルの内容（`bash scripts/safe.sh`の`safe.sh`の中身）は検査できない
- 緩和策: `scripts/`ディレクトリ自体を信頼境界とし、そのディレクトリへの書き込み権限管理をリポジトリ運用でカバー

### cwd前提（API制約）

- hookは実行時の**cwd（current working directory）を直接取得できない**（PreToolUseにcwdフィールドが含まれていない）
- 現在の実装: `PROJECT_DIR`をベースにパス解決
- 問題: 先行する`cd`コマンドでcwdがずれた場合、bare filename解決が誤る可能性
- 緩和策: Phase 7Dで`cd /outside`コマンド自体を検出しreject（ただし、settings.json設定次第で漏れる可能性あり）

### 間接参照不可（stdin, 環境変数経由のパス）

以下のパターンは追跡不能:
```bash
cat < /etc/passwd
bash -c "$MALICIOUS_CODE"
python3 <<< "import os; os.system('rm -rf /')"
FILE=/tmp/evil.sh bash "$FILE"
```

**緩和策**:
- Phase 2で`<`, `>`をreject（stdin/stdout redirection guard）
- Phase 2 P4で`$`をreject（variable expansion guard）
- `always_ask`に`bash`, `sh`を含めない代わりに、Phase 4で厳格なフラグ判定を実施（`-c`は常にreject）

### 限界の受容

これらの限界は、**全ての静的解析ベース権限システムに共通**する。完全な保護は実行時サンドボックス（seccomp, AppArmor等）でのみ可能だが、それらはClaude Codeの実行モデル（ホストシェル直接実行）と両立しない。

hookの役割は「**実用的な範囲で検出可能な危険パターンを高精度でフィルタリングすること**」であり、100%の保護は目指さない。
