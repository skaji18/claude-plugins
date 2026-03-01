# permission-guard 設計ドキュメント

## 1. hookの存在意義

Claude Code は `settings.json` のネイティブ権限システム（`allow` / `ask` / `deny`）でツール実行を制御する。しかしこのシステムはツール名単位の粗い粒度でしか判定できない。

ネイティブシステムが抱える構造的問題:

- **`deny` は過剰に制限する**: `Bash` ツール全体を deny にすると、`ls` も `git status` も実行不能になる
- **`allow` は過剰に許可する**: `Bash` ツール全体を allow にすると、`rm -rf /` も `curl | bash` も自動承認される
- **`ask` は判定を放棄する**: 全コマンドでユーザーに確認ダイアログが出る。安全なコマンドでも毎回承認が必要になり、1セッションで数十回の確認が発生する

permission-guard hook はこの粒度ギャップを埋める。`ask` に設定されたツールに対して呼び出され、コマンドの内容・引数・パスを精密に解析し、安全なものは自動許可（allow）、判断できないものはユーザー確認（ask）、明らかに危険なものはブロック（deny）に振り分ける。

具体的に hook が提供する精密判定:

| 場面 | ネイティブ権限だけの場合 | hook による判定 |
|---|---|---|
| `git status` vs `git push --force` | 両方 ask（または両方 allow） | 前者 allow、後者 ask |
| `.venv/bin/pytest` vs `/tmp/evil.sh` | 両方 ask | 前者 allow（プロジェクト内）、後者 ask |
| `ls -la` vs `sudo rm -rf /` | 両方 ask | 前者 allow、後者 ask（NEVER_SAFE） |

## 2. 評価順序と責務範囲

hook はネイティブ権限の「後段」で動作する。呼び出しフローは以下の通り:

```
settings.json deny  ->  block（hookは呼ばれない）
settings.json allow ->  allow（hookは呼ばれない）
settings.json ask   ->  hookが呼び出され、精密判定を実行
```

hook の責務は明確に限定される: **ネイティブの `deny` でも `allow` でもないコマンドに対して、コンテキスト依存の判定を行うこと**。ネイティブの `deny` / `allow` を上書きする能力は持たない。

## 3. 設計原則

### deny-by-default

`tools` 辞書に登録されていないコマンドは `ask`（ユーザー確認）になる。理由は単純で、コマンド・フラグ・引数の組み合わせは事実上無限にあるため、「危険なものを列挙して弾く」アプローチ（danger-enumeration）では必ず漏れが生じる。逆に「安全なものだけ列挙して通す」アプローチ（safe-enumeration）であれば、未知のコマンドは自動的に安全側に倒される。

### fail-closed

判定不能な状態では常に `ask` に倒す。具体例:

- `tools` 辞書に未登録のコマンド -> `ask`（`unknown_command`）
- 設定ファイル読み込み失敗 -> デフォルト設定で続行（`tools` が十分に保守的）
- 監査ログ書き込み失敗 -> 例外を握り潰し、判定自体は正常に完了させる

### NEVER_SAFE ハードコード

```python
NEVER_SAFE = {"sudo", "su"}
```

`sudo` と `su` は tools 辞書の判定より前に評価される。設定で上書きすることはできない。ただし判定結果は `deny` ではなく `ask` であり、ユーザーが明示的に承認すれば実行可能である。これは「hookが最終判断を下す」のではなく「ユーザーの注意を促す」という設計思想による。

## 4. アーキテクチャ

処理は大きく2段構成: **Pre-validation**（複合コマンド分割前の入力検証）と **Command validation**（分割後の個別コマンド判定）。

### 4.1 Pre-validation

`main()` から順次呼び出される。いずれかのフェーズで `RejectException` が発生すると即座に `output_deny()` で終了する。

#### Phase S0 — Null バイト・空コマンド検査

**関数**: `phase_s0_null_byte_check(input_str, command)`

入力 JSON 文字列中の null バイト（バイナリゼロおよびエスケープ済みユニコードゼロ）を検出して拒否する。空文字列コマンドも拒否。JSON インジェクション等の攻撃ベクターを入口で遮断する。

| Reject 理由 | 条件 |
|---|---|
| `S0:null_byte` | バイナリ null を検出 |
| `S0:json_null` | エスケープ済み unicode null を検出 |
| `S0:empty_command` | コマンド文字列が空 |

#### Phase 1 — 制御文字・Unicode 空白・ツール名検査

**関数**: `phase_1_sanitize(input_data, command)`

視認困難な文字による難読化攻撃を防ぐ。また `tool_name` が `"Bash"` 以外の場合（想定外のツール呼び出し）を拒否する。

| Reject 理由 | 条件 |
|---|---|
| `S1:control_chars` | 制御文字（U+0001 - U+001F, U+007F） |
| `S1:unicode_whitespace` | Unicode 空白文字（U+0085, U+00A0, U+2000 - U+200B 等） |
| `S2:tool_name` | `tool_name != "Bash"` |

#### Phase 1.5 — 安全サフィックス除去

**関数**: `phase_1_5_strip_safe_suffixes(command)`

コマンド末尾の安全なサフィックスを while ループで反復的に除去し、コアコマンドを露出させる。拒否は行わない。

除去対象:

| パターン | 例 |
|---|---|
| `|| true` | `cmd || true` |
| `|| echo "literal"` | 安全な内容のみ |
| `|| echo 'literal'` | シングルクォート内容 |
| `&& echo "literal"` | 同上 |
| `&& echo 'literal'` | 同上 |
| `2>&1` | stderr to stdout リダイレクト |
| `2>/dev/null` | stderr 破棄 |

反復除去のため `cmd 2>&1 || true` のように複数サフィックスが連なっていても処理できる。

#### Phase 2 — シェル構文ガード

**関数**: `phase_2_shell_syntax(command)`

シェルが解釈する危険な構文を静的に検出して拒否する。hook はシェルインタプリタを通さないため、これらの構文が残っていると実行時に想定外の挙動を引き起こす可能性がある。

| Reject 理由 | 検出対象 |
|---|---|
| `P1:backtick_substitution` | バッククォート |
| `P1:background_execution` | `&`（バックグラウンド実行） |
| `P3:cmd_substitution` | `$(...)` コマンド置換 |
| `P4:var_expansion` | `$VAR` 変数展開 |
| `P5:env_assignment` | `FOO=bar cmd` 形式の環境変数代入 |
| `P6:tilde_expansion` | `~` チルダ展開 |
| `P7:glob_chars` | `*`, `?`, `{`, `}` グロブ・ブレース展開 |
| `P2:no_space_after_interpreter` | インタプリタ名+パス連結 |
| `P2:quoted_command_name` | コマンド名がクォートで囲まれている |

### 4.2 複合コマンド検出と分岐

Phase 2 通過後、正規表現でコマンドが複合か単純かを判定する。パイプ、論理演算子、セミコロン、リダイレクトのいずれかを含む場合は複合コマンドとして扱う。

- **複合コマンド** -> `validate_compound_command()`
- **単純コマンド** -> `validate_single_command()`

### 4.3 validate_single_command — 単一コマンド判定

`validate_single_command(command, config)` は以下の順序で判定を行う:

1. **NEVER_SAFE チェック**: コマンドの basename が `NEVER_SAFE` に含まれていれば即座に `("ask", "never_safe:{cmd}")` を返す
2. **プロジェクト内コマンド自動許可**: コマンド名にスラッシュが含まれる場合、パスを正規化してプロジェクト内包含を判定（詳細は第6章）
3. **tools 辞書照合**:
   - **未登録** -> `("ask", "unknown_command:{cmd}")`
   - **文字列エントリ** (`"allow"` / `"ask"`) -> その値をそのまま返す
   - **マップエントリ** -> `dangerous_flags` 一致チェック -> `ask` サブコマンド一致チェック -> いずれにも該当しなければ `default` 値を返す

マップエントリのサブコマンド照合はスペース区切り DSL に対応している。例えば `"pr merge"` というエントリは `gh pr merge` の2段サブコマンドにマッチする。

`dangerous_flags` の判定には複合短フラグの分解がある。`-rf` は `-r` と `-f` に個別分解されてチェックされる。

### 4.4 validate_compound_command — 複合コマンド判定

`validate_compound_command(command, config)` は以下のステップで処理する:

1. **パイプ右辺チェック**: `|` で分割し、2番目以降のセグメントの先頭コマンド名が `pipe_deny_right` に含まれていれば即座に拒否。シェル・インタプリタへのパイプ経由コード注入を防ぐ
2. **セグメント分割**: `split_compound()` でコマンドセグメントとリダイレクトセグメントに分離
3. **個別検証**:
   - `cmd` セグメント -> `validate_single_command()` で判定
   - `redirect_out` / `redirect_in` セグメント -> `/dev/null` は即 allow、それ以外は `phase_5_normalize_path()` でプロジェクト内包含を検証
4. **集約**: 1つでも非 allow があれば最初の非 allow 結果を返す。全て allow なら理由を `+` で結合して返す（例: `compound:tools:git+tools:grep`）

### 4.5 split_compound — 複合コマンド分割

`split_compound(command)` は `Segment` データクラスのリストを返す:

```python
@dataclass
class Segment:
    command: str        # コマンド文字列
    seg_type: str       # "cmd", "redirect_out", "redirect_in"
    redirect_path: str  # リダイレクト先/元パス
```

処理手順:
1. リダイレクトパターンを正規表現で抽出して `redirect_out` / `redirect_in` セグメントを生成
2. リダイレクト部分を除去した残りを `||`, `&&`, `|`, `;` で分割して `cmd` セグメントを生成

### 4.6 出力ルーティング

`main()` は `validate_single_command` / `validate_compound_command` の返値に基づき、3種類の出力関数を呼び分ける:

- **allow** -> `output_allow(reason)` — 自動承認、ユーザーへの確認なし
- **deny** -> `output_deny(reason)` — ハードブロック、実行不可。以下の条件で deny と判定:
  - Pre-validation フェーズ（S0, 1, 2）で `RejectException` が発生
  - 理由文字列が `dangerous_pipe_target:` で始まる
  - 理由が `deny_reasons` セット（`null_byte`, `json_error`, `empty_command`, `control_char`, `unicode_whitespace`, `unknown_tool`, `no_segments`）に含まれる
- **ask** -> `output_ask(reason)` — 上記以外の全ての非 allow。ユーザーに確認ダイアログを表示

## 5. tools 統一構造

### 3種類のエントリ形式

#### 単純 allow エントリ

```yaml
ls: "allow"
cat: "allow"
grep: "allow"
```

コマンド名が一致すれば即座に `("allow", "tools:{cmd}")` を返す。デフォルト設定には37個の低リスクコマンドが登録されている（`ls`, `cat`, `head`, `tail`, `grep`, `sed`, `awk`, `jq`, `make`, `cargo`, `gcc`, `go`, `diff` 等）。

#### 単純 ask エントリ

```yaml
curl: "ask"
rm: "ask"
pip: "ask"
```

コマンド名が一致すれば即座に `("ask", "tools:{cmd}")` を返す。ネットワークアクセス（`curl`, `wget`, `ssh`）、破壊的操作（`rm`, `rmdir`, `mv`）、パッケージ管理（`pip`, `pip3`）等、15個が登録されている。

#### マップエントリ

```yaml
git:
  ask: ["push", "clean", "filter-branch", "rebase", "reset"]
  dangerous_flags: ["--force", "-f", "--hard", "-D", "--no-verify"]
  default: "allow"
```

サブコマンドとフラグの粒度で判定を分岐させる。マップに含まれるキー:

| キー | 型 | 役割 |
|---|---|---|
| `ask` | list | このサブコマンドに一致したら ask。スペース区切り DSL 対応（例: `"pr merge"`） |
| `dangerous_flags` | list | 引数にこのフラグがあれば ask。複合短フラグ分解あり |
| `default` | string | 上記いずれにも該当しない場合の判定（`"allow"` or `"ask"`） |

デフォルト設定のマップエントリ: `git`（default: allow）、`docker`（default: ask）、`gh`（default: ask）、`npm`（default: ask）。

### 3層コンフィグマージ

設定は3層でロードされ、チェーンマージされる:

1. **defaults.yaml**: `{CLAUDE_PLUGIN_ROOT}/config/defaults.yaml`（プラグイン同梱のベースライン）
2. **グローバル設定**: `~/.claude/permission-guard.yaml`（全プロジェクト共通のカスタマイズ）
3. **プロジェクト設定**: `{CLAUDE_PROJECT_DIR}/.claude/permission-guard.yaml`（プロジェクト固有のカスタマイズ）

マージは `merge_config(base, delta)` を2回チェーンして行われる:

```
effective = merge_config(merge_config(defaults, global), project)
```

各層のデルタは同じキー構造を持つ:

| キー | マージ方式 |
|---|---|
| `tools` | base をベースに、`tools_add` で追加/上書き、`tools_remove` で削除 |
| `pipe_deny_right` | base + `pipe_deny_right_add` の和集合 |
| `allowed_dirs_extra` | delta に値があれば上書き、なければ base |
| `audit_log_path` | delta に値があれば上書き、なければ base |

`tools_add` でマップエントリを追加する場合:
- 既存エントリが文字列なら `{"default": 既存値}` に変換してからマージ
- `ask` と `dangerous_flags` は和集合（既存リスト + 新規リスト）
- その他のキーは上書き
- `tools_add` がリスト形式（`- name: val`）の場合も dict に変換して処理（ロバスト対応）

優先順位は **project > global > defaults** であり、後段の設定が前段を上書きする。具体例:

| シナリオ | global | project | effective |
|---------|--------|---------|-----------|
| global で追加、project で上書き | `bun: "ask"` | `bun: "allow"` | `bun: "allow"` |
| global で削除、project で復活 | `tools_remove: [ls]` | `tools_add: {ls: "allow"}` | `ls: "allow"` |
| global で追加、project は触らない | `bun: "allow"` | — | `bun: "allow"` |
| map entry の部分マージ | `bun: {ask: [publish]}` | `bun: {dangerous_flags: [--force]}` | `bun: {ask: [publish], dangerous_flags: [--force]}` |

この設計により、ユーザーは全プロジェクト共通の設定をグローバルに持ちつつ、プロジェクト固有のカスタマイズを上書きできる。`NEVER_SAFE` はハードコードのため設定で回避できない。

コンフィグ関連の関数は `scripts/pg_config.py` に共有モジュールとして抽出されており、`permission-fallback`（hook）および各スクリプト（`show-config`, `analyze-log`, `apply-config`）が共通で使用する。

## 6. プロジェクト内コマンド自動許可

`validate_single_command()` 内で、コマンド名にスラッシュ（`/`）が含まれる場合にプロジェクト内包含を判定する。

処理手順:
1. 絶対パスならそのまま、相対パスなら `PROJECT_DIR` と結合
2. `os.path.normpath()` でパスを正規化
3. 正規化後のパスが `PROJECT_DIR` のプレフィックスで始まるか判定
4. 一致しなければ `allowed_dirs_extra` の各ディレクトリについても判定
5. いずれかに包含されていれば `("allow", "project_contained_cmd:{basename}")` を返す

**`normpath` を使い `realpath` を使わない理由**: `.venv/bin/python` はシンボリックリンクであり、`realpath()` で解決すると `/usr/local/bin/python3` 等のプロジェクト外パスになる。しかしリンク自体はプロジェクトディレクトリ内に存在しており、そのパス位置で判定するのが正しい。`normpath()` は `..` や `.` を解決するがシンボリックリンクは追跡しないため、パスの字面上の位置で包含判定ができる。

なお、スラッシュを含まないコマンド（`ls`, `git` 等）はこの判定をスキップし、従来通り tools 辞書照合に進む。`../../../tmp/evil.sh` のようなパストラバーサルは `normpath` で解決後に包含チェックで検出される。

## 7. 複合コマンド処理の詳細

### パイプ右辺拒否

`pipe_deny_right` リストに含まれるコマンドがパイプの右辺に来た場合、即座に拒否する。

デフォルト値（14個）: bash, sh, zsh, ksh, fish, csh, tcsh, python, python3, perl, ruby, node, eval, exec, xargs

これはコード注入の典型パターンを防ぐ。パイプ左辺は任意のコマンドでよいが、右辺がインタプリタやシェルであれば、左辺の出力がコードとして実行されるリスクがある。

### リダイレクト先のプロジェクト包含チェック

リダイレクトセグメントに対しては `phase_5_normalize_path()` でパスを正規化し、プロジェクト内に収まっているか検証する。

- `/dev/null` -> 即 allow
- プロジェクト内パス -> allow（`redirect:project_contained`）
- プロジェクト外パス -> deny（`redirect:outside_project:{path}`）

リダイレクト先のチェックでは `canonicalize_path()`（`os.path.realpath()` ベース）を使用する。これはコマンドパスの自動許可（第6章の `normpath`）とは異なる設計判断である。リダイレクト先はファイルの実体位置が重要であり、シンボリックリンク経由でプロジェクト外に書き込むことを防ぐ必要があるため。

## 8. 制約と限界

### スクリプト内容検査不能

hook が検査できるのはコマンドライン引数のみである。`bash scripts/deploy.sh` の `deploy.sh` の中身は見えない。プロジェクト内スクリプトは自動許可されるため、リポジトリへの書き込み権限管理がセキュリティの前提となる。

### cwd 前提

PreToolUse hook の入力に cwd フィールドは含まれない。相対パスの解決は全て `PROJECT_DIR` を基準に行う。先行する `cd` コマンドで実際の cwd がずれていた場合、パス解決が不正確になる可能性がある。

### 間接参照不可

以下のパターンはコマンドライン引数の静的解析では追跡できない:

- 環境変数経由のコード実行（ただし Phase 2 で変数展開構文は拒否される）
- ヒアストリングによるコード注入（ただし Phase 2 でリダイレクト構文は検出される）
- 実行時に生成されるパス（先行コマンドの出力を参照する場合）

これらは全ての静的解析ベース権限システムに共通する限界である。hook は「コマンドライン引数から検出可能な危険パターンを高精度でフィルタリングすること」を目的としており、完全な保護は目指さない。完全な隔離にはランタイムサンドボックス（seccomp, AppArmor 等）が必要だが、それは Claude Code のホストシェル直接実行モデルとは別のレイヤーの話である。

## 監査ログ

全ての判定結果は JSONL 形式で監査ログに記録される。

出力先の決定順序:
1. `config.audit_log_path` が設定されていればそれ（チルダ展開あり）
2. `CLAUDE_PLUGIN_ROOT` 環境変数があれば `{CLAUDE_PLUGIN_ROOT}/logs/decisions.jsonl`
3. いずれもなければログ出力しない

ログ形式:

```json
{"ts": "2026-02-28T12:34:56Z", "decision": "allow", "command": "git status", "phase": "tools_default", "reason": "tools_default:git"}
```

ログ書き込みの例外は握り潰される。監査ログの失敗が hook 本体の判定を阻害してはならない。
