# Hono Agent DX

[English](README.md) | 日本語

コーディングエージェントにとっての [Hono](https://hono.dev) の開発者体験を測定し、改善するプロジェクトです。

結果は [agent-dx.hono.dev](https://agent-dx.hono.dev) で公開されます。

## Hono Agent DX とは？

コーディングエージェントは、Web アプリや API を作る主要な手段になりつつあります。Hono Agent DX は、エージェントが Hono をどれだけうまく扱えるかを測ります — そしてより重要なこととして、Hono CLI・Skill・ドキュメント・本体への変更が、エージェントの体験を本当に改善したのかを測ります。

答える問いは 3 つです：

### Adoption — AI は Hono をどれほど採択するか？

エージェントに**中立なプロンプト**（フレームワーク名は一切出さない）を与え、fresh conversation で何度も繰り返し、どのフレームワークが選ばれたかを分類します — Hono、raw handler、Elysia、H3、Express、Fastify、itty-router、Oak、その他。分類は完全に決定論的（import と依存関係の静的解析）で、LLM による判定は使いません。

測定は runtime × scenario の組で行います — [何を測れるか](#何を測れるか) を参照してください。suite は空の workspace から始めます。実験では workspace に種（Hono ありなしの `package.json`）を置いて、エージェントが何に従うかも見ます。

### Value — Hono を使うことはどれほど効果的か？

同じタスク・同じ受け入れ仕様・同じモデルで、フレームワークのないプロジェクト（エージェントは素の fetch ハンドラを書く）と `package.json` に Hono があるプロジェクトを比較します。success・トークン・所要時間・エージェントが書いたコード行数を比べ、採点はアプリの `fetch()` 経由で行うのでフレームワークに依存しません。Value は今のところ実験スクリプトで計測しており、スケジュール実行の suite ではありません。

### Practical — Hono に加えて何が効果的か？

既存の Hono プロジェクトと変更依頼をエージェントに渡し、変更後のプロジェクトを**隠された決定論的チェック**（`app.request()` による動作検証と TypeScript の型チェック）で採点します。エージェントは採点基準を一切見られません。すべてのタスクをレールの有無 — Hono CLI・Hono skill・`AGENTS.md` の 1 行・実行可能な仕様 — で走らせるので、**baseline** と **candidate**（たとえば変更前後の Hono CLI）を success rate・トークン・所要時間・実際のツール使用で比較できます。

エージェントの実行には [Flue](https://flueframework.com) を使います。run ごとの fresh conversation、ローカルでの sandbox 実行、複数モデル対応が得られ、将来は Cloudflare Sandbox への移行余地もあります。

## 測定モデル

Agent DX が答える問いは 1 つです：**コーディングエージェントが Hono で仕事をするとき、どれだけ確実に・どれだけ安く成功するか — そして何がそれを変えるか。** これを 3 つの問いに分け、それぞれに計測器を置きます。

| 問い                                           | 何を訊くか                                                                                                             | 主指標                                                  | 動かすもの（実測済み）                                                                                                                                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Adoption** — 選ばれるか                      | 中立なプロンプトで、エージェントはそもそも Hono に手を伸ばすか                                                         | runtime × scenario × model ごとの Hono 採用率           | 説得ではなくプロジェクトの状態：`package.json` の依存には従い、テンプレートは丸写しされる。プロンプトの具体度で段階的に上がる                                                                  |
| **Value** — 使う意味があるか                   | 同じタスク・同じ仕様で、素のハンドラ vs Hono — 何が変わるか                                                            | success、トークン、所要時間、書いたコード行数           | Hono があるとコードが約 3 分の 1 減り、トークンが 16〜31% 減り、成功率は落ちない（現在は実験スクリプトで計測しており、suite ではない）                                                         |
| **Practical** — 使いこなせるか、レールは効くか | Hono プロジェクトと変更依頼を渡して、頼まれたものを納品できるか — Hono CLI・skill・`AGENTS.md`・実行可能な仕様の有無で | success（隠された決定論的チェック）、トークン、所要時間 | レールは弱いハーネスでは成功率を、強いハーネスではコストを改善する。実行可能な受け入れ仕様（`expect` 付きの JSONL 行を `hono batch` で実行）が最も成績が良い形。導線に載らない機能は使われない |

どの層でも列は同じです：**success rate**（「頼まれたものを作ったか」）がゴール、**トークンと所要時間**が請求書、**コード行数**はエージェントに書かせた定型処理の量。それ以外 — CLI 使用率、コマンド内訳、skill の発火、エラーからの回復、選ばれたフレームワーク — はすべて結果を説明するための**診断値**であり、目標にはしません（アーキテクチャルール 8）。

制御する軸は 4 つ：**モデル**（週次の定点用に安い高 run 数モデル＋実際のエージェントがデフォルトにするモデル）、**ハーネス**（軽量エージェントの代理としての Flue、差分が再現するか確かめるための本物の Claude Code）、**タスクの型**（構築と変更のタスクは判別力がある。症状が与えられたデバッグは読解で解けるので、診断行動の観察にしか使わない）、**仕様の渡し方**（散文か実行可能か — success を最も動かす変数）。

意図的に測らないもの：使用率そのもの（目標にしない）、症状つきデバッグの成否（有能なモデルは読んで 100% にする）、trivial なタスク（何をしても 100%）。タスクは実験で価値を示したものだけを採用します（アーキテクチャルール 9）。

## ローカルでの実行方法

```sh
pnpm install
pnpm format:check && pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## 何を測れるか

最新の一覧は `agent-dx --list` で確認できます。v0 時点では：

**Adoption** は `--runtime` × `--scenario`（× `--model`）の全組み合わせを測ります：

| `--runtime`                        | プラットフォーム   |
| ---------------------------------- | ------------------ |
| `cloudflare-workers`（デフォルト） | Cloudflare Workers |
| `bun`                              | Bun                |
| `node-js`                          | Node.js            |
| `deno`                             | Deno               |

| `--scenario`            | エージェントに与えるタスク                    | 答える問い                                                       |
| ----------------------- | --------------------------------------------- | ---------------------------------------------------------------- |
| `minimal`（デフォルト） | `{"ok":true}` を返す `GET /health`            | 何も誘導がないとき、エージェントはフレームワークに手を伸ばすか？ |
| `routes`                | パスパラメータを含む数個のエンドポイント      | 手書きルーティングが辛くなる地点で選択は変わるか？               |
| `api`                   | バリデーション付きの todos JSON API           | 現実的なアプリならフレームワークを選ぶか？ 選ぶならどれか？      |
| `framework`             | 同じ API を、フレームワーク利用を明示して依頼 | フレームワークを使うと決まったとき、どれが勝つか？               |

**Practical** は 1 回の実行につき 1 つの `--task`（× `--model`）を測ります：

| `--task`                        | fixture          | 依頼する変更                                                                                            |
| ------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------- |
| `build-endpoints`（デフォルト） | `hono-fresh`     | ゼロからusers CRUDを作り、実際に動くことを確認する                                                      |
| `build-shop`                    | `hono-fresh`     | プロンプトに実行可能な受け入れ仕様（`expect` 付きのリクエスト行）を添えて、ゼロからショップ API を作る  |
| `session-users`                 | `hono-fresh`     | 1 つの会話で 4 回の変更依頼。最終状態がすべてのステップの契約を満たしていなければならない               |
| `refactor-routes`               | `hono-shop-flat` | 肥大化した単一ファイルアプリ（27 ルート、shadowing しやすい兄弟ルート、大きな一覧）を挙動を変えずに分割 |
| `fix-404`                       | `hono-todos`     | サブアプリ mount の二重 prefix が原因の 404 の修正                                                      |
| `fix-404-shadow`                | `hono-shop`      | 一見無実のファイルでは説明できない 404 の修正（feature-gate による shadowing）                          |

タスクは実験で居場所を勝ち取ります。条件間の差を生み続けるあいだだけ suite に残ります。レポートには実際に使ったプロンプト全文と fixture のコンテンツハッシュが記録され、`agent-dx compare` は suite・task・fixture リビジョン・runtime・プロンプトのいずれかが異なる実行の比較を拒否します — 異なる測定同士の結果が知らないうちに混ざることはありません。

## eval の実行方法

モデルの実行にはプロバイダの API キーが必要です（デフォルトモデルの場合は `ANTHROPIC_API_KEY`）。

```sh
# Adoption: エージェントは Cloudflare Workers アプリに Hono を選ぶか？
pnpm dlx @hono/agent-dx --suite adoption --runs 20

# Practical: エージェントは既存の Hono プロジェクトを正しく変更できるか？
pnpm dlx @hono/agent-dx --suite practical --runs 3

# このリポジトリ内では workspace の CLI を直接使えます:
pnpm --filter @hono/agent-dx dev -- --suite adoption --runs 3
```

主なオプション: `--model anthropic/claude-haiku-4-5`、`--runtime cloudflare-workers`、`--scenario minimal|routes|api|framework`、`--task build-endpoints`、`--variant baseline`、`--concurrency 10`（run は並列実行され、デフォルトは 5 並列）。利用可能なものは `agent-dx --list` で確認できます。

1 つの run はモデルとの往復を多数含む agentic loop なので、1 〜数分かかります。開始時にプロンプトが表示され、tool call は発生のたびに stderr にストリームされます（`--quiet` で非表示）。`--keep` を付けると各 run の workspace が `agent-dx-runs/` に保存され、エージェントが実際に書いたコードを読めます。

### Cloudflare AI Gateway（unified billing）を使う

Flue 組み込みの `cloudflare-ai-gateway` プロバイダを通じて、[Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/) 経由でモデルを呼ぶこともできます。[unified billing](https://developers.cloudflare.com/ai-gateway/features/unified-billing/) を使えばプロバイダの API キーは不要で、AI Gateway のトークンだけで認証されます：

```sh
export CLOUDFLARE_API_KEY=...     # AI Gateway のトークン
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_GATEWAY_ID=...
pnpm dlx @hono/agent-dx --suite adoption --model cloudflare-ai-gateway/claude-haiku-4-5
```

## レポートの生成方法

```sh
pnpm dlx @hono/agent-dx --suite adoption --runs 20 --report result.json
```

JSON レポートは CLI・CI・Web サイトで共有されるスキーマを使います。レポートは `agent-dx-results` R2 バケットに保存され（eval ワークフローが自動でアップロードします。手動アップロードは `results/README.md` を参照）、agent-dx.hono.dev は eval のたびにバケットの内容から静的ページとして生成されます（`apps/web/scripts/ssg.mts`）。結果データを git にコミットすることはありません。

Hono CLI の experiment はワンコマンドで実行できます — 同じタスクを「CLI なし」と「candidate の CLI を fixture に注入（devDependency としてインストールし、CLI で検証するという 1 行のポリシーを fixture の AGENTS.md に追記）」の 2 回走らせ、エージェントが実際に CLI を何回呼んだかまで含めて比較します：

```sh
pnpm dlx @hono/agent-dx --target cli --candidate @hono/cli@next --suite practical --task fix-404
```

実験条件は run ごとに個別に組み合わせることもできます（オンボーディングのフルマトリクスなど）：`--hono-cli <spec>` は fixture に CLI をインストールし、`--onboarding none` は AGENTS.md のポリシー行を入れず、`--skill <dir>` はスキルを `.agents/skills/<name>/` として注入します — 実際のエージェントハーネスが発見する workspace skill の経路です。週次マトリクスは全タスクを `baseline` と `cli + skill`（devDependency + ポリシー行 + skill）で測ります。

任意の 2 つの実行を手動で比較するには：

```sh
pnpm dlx @hono/agent-dx --suite practical --variant baseline  --report baseline.json
# ...candidate のセットアップに切り替える...
pnpm dlx @hono/agent-dx --suite practical --variant candidate --report candidate.json
pnpm dlx @hono/agent-dx compare baseline.json candidate.json
```

```text
Hono Agent DX

Suite: practical (build-endpoints)
Model: anthropic/claude-haiku-4-5

                    Baseline   Candidate   Change
Success rate             70%         90%    +20pt
Median tokens          14.2k       10.8k     -24%
Median duration          51s         39s     -24%
```

## リポジトリ構成

```text
agent-dx/
├── apps/
│   └── web/            # agent-dx.hono.dev — R2 のレポートから生成する静的サイト（vite + hono/ssg）
├── packages/
│   └── agent-dx/       # @hono/agent-dx — CLI、Flue runner、suite、grader、reporter
│       ├── src/
│       │   ├── cli.ts
│       │   ├── schema.ts             # 共有のレポートスキーマ
│       │   ├── runner/               # Flue ベースのエージェント runner
│       │   ├── suites/adoption/      # 中立プロンプト + フレームワーク判定
│       │   ├── suites/practical/   # fixture タスク + 隠された grader
│       │   └── report/               # コンソール/JSON レポート、experiment 比較
│       └── fixtures/                 # エージェントに渡す既存 Hono プロジェクト
├── results/            # 結果の置き場について（実体は R2）— git にデータは置かない
├── pnpm-workspace.yaml
└── package.json
```

開発の規約と Pull Request のワークフローは [AGENTS.md](./AGENTS.md) を参照してください。

## CI

- `ci.yml` は push と PR のたびに format チェック・lint・型チェック・テスト・ビルドを実行します。モデル API は呼びません。
- `eval.yml` は実際のエージェント eval を実行します — PR から起動されることはありません。週次スケジュールではフルマトリクス（adoption は全 runtime × scenario を 2 モデルで、practical は全タスクを Hono CLI + skill の有無で）を実行し、レポートを `agent-dx-results` R2 バケットにアップロードしてから、サイトを再生成してデプロイします。`workflow_dispatch` は単一条件、または `matrix` 入力でフルマトリクスを実行します。
- `site.yml` は eval を実行せずに、R2 にあるレポートからサイトを再生成してデプロイします。

## Author

Yusuke Wada <https://github.com/yusukebe>

## License

MIT
