# Hono Agent DX

[English](README.md) | 日本語

コーディングエージェントにとっての [Hono](https://hono.dev) の開発者体験を測定し、改善するプロジェクトです。

結果は [agent-dx.hono.dev](https://agent-dx.hono.dev) で公開されます。

## Hono Agent DX とは？

コーディングエージェントは、Web アプリや API を作る主要な手段になりつつあります。Hono Agent DX は、エージェントが Hono をどれだけうまく扱えるかを測ります — そしてより重要なこととして、Hono CLI・Skill・ドキュメント・本体への変更が、エージェントの体験を本当に改善したのかを測ります。

測るものは 2 つです：

### Adoption

コーディングエージェントは自発的に Hono を選ぶのか？ 空の workspace で**中立なプロンプト**（フレームワーク名は一切出さない）をエージェントに与え、fresh conversation で何度も繰り返し、どのフレームワークが選ばれたかを分類します — Hono、raw handler、Elysia、H3、Express、Fastify、itty-router、その他。分類は完全に決定論的（import と依存関係の静的解析）で、LLM による判定は使いません。

測定は runtime × scenario の組で行います — [何を測れるか](#何を測れるか) を参照してください。

### Proficiency

コーディングエージェントは Hono をどれだけ効果的に使えるのか？ 既存の Hono プロジェクトと小さな変更依頼をエージェントに渡し、変更後のプロジェクトを**隠された決定論的チェック**（`app.request()` による動作検証と TypeScript の型チェック）で採点します。エージェントは採点基準を一切見られません。

### Experiments

このプロジェクトの主目的：**baseline** と **candidate** — たとえば変更前後の Hono CLI — を比較し、「この変更は Agent DX を本当に改善したのか？」に success rate・トークン使用量・所要時間・tool call 数で答えます。

エージェントの実行には [Flue](https://flueframework.com) を使います。run ごとの fresh conversation、ローカルでの sandbox 実行、複数モデル対応が得られ、将来は Cloudflare Sandbox への移行余地もあります。

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

**Proficiency** は 1 回の実行につき 1 つの `--task`（× `--model`）を測ります：

| `--task`                       | fixture      | 依頼する変更                                       |
| ------------------------------ | ------------ | -------------------------------------------------- |
| `add-user-route`（デフォルト） | `hono-basic` | id を JSON で返す `GET /users/:id` の追加          |
| `fix-404`                      | `hono-todos` | サブアプリ mount の二重 prefix が原因の 404 の修正 |

レポートには実際に使ったプロンプト全文と fixture のコンテンツハッシュが記録され、`agent-dx compare` は suite・task・fixture リビジョン・runtime・プロンプトのいずれかが異なる実行の比較を拒否します — 異なる測定同士の結果が知らないうちに混ざることはありません。

## eval の実行方法

モデルの実行にはプロバイダの API キーが必要です（デフォルトモデルの場合は `ANTHROPIC_API_KEY`）。

```sh
# Adoption: エージェントは Cloudflare Workers アプリに Hono を選ぶか？
pnpm dlx @hono/agent-dx --suite adoption --runs 20

# Proficiency: エージェントは既存の Hono プロジェクトを正しく変更できるか？
pnpm dlx @hono/agent-dx --suite proficiency --runs 3

# このリポジトリ内では workspace の CLI を直接使えます:
pnpm --filter @hono/agent-dx dev -- --suite adoption --runs 3
```

主なオプション: `--model anthropic/claude-haiku-4-5`、`--runtime cloudflare-workers`、`--scenario minimal|routes|api|framework`、`--task add-user-route`、`--variant baseline`、`--concurrency 10`（run は並列実行され、デフォルトは 5 並列）。利用可能なものは `agent-dx --list` で確認できます。

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

JSON レポートは CLI・CI・Web サイトで共有されるスキーマを使います。レポートは `agent-dx-results` R2 バケットに保存され（eval ワークフローが自動でアップロードします。手動アップロードは `results/README.md` を参照）、agent-dx.hono.dev がバケットの内容をそのまま表示します。結果データを git にコミットすることはありません。

Hono CLI の experiment はワンコマンドで実行できます — 同じタスクを「CLI なし」と「candidate の CLI を fixture に注入（devDependency としてインストールし、CLI のオンボーディング行を fixture の AGENTS.md に追記）」の 2 回走らせ、エージェントが実際に CLI を何回呼んだかまで含めて比較します：

```sh
pnpm dlx @hono/agent-dx --target cli --candidate @hono/cli@next --suite proficiency --task fix-404
```

実験条件は run ごとに個別に組み合わせることもできます（オンボーディングのフルマトリクスなど）：`--hono-cli <spec>` は fixture に CLI をインストールし、`--onboarding none` は AGENTS.md のオンボーディング行を入れず、`--skill <dir>` はスキルを `.agents/skills/<name>/` として注入します — 実際のエージェントハーネスが発見する workspace skill の経路です。

任意の 2 つの実行を手動で比較するには：

```sh
pnpm dlx @hono/agent-dx --suite proficiency --variant baseline  --report baseline.json
# ...candidate のセットアップに切り替える...
pnpm dlx @hono/agent-dx --suite proficiency --variant candidate --report candidate.json
pnpm dlx @hono/agent-dx compare baseline.json candidate.json
```

```text
Hono Agent DX

Suite: proficiency (add-user-route)
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
│   └── web/            # agent-dx.hono.dev — R2 のレポートを表示する Worker
├── packages/
│   └── agent-dx/       # @hono/agent-dx — CLI、Flue runner、suite、grader、reporter
│       ├── src/
│       │   ├── cli.ts
│       │   ├── schema.ts             # 共有のレポートスキーマ
│       │   ├── runner/               # Flue ベースのエージェント runner
│       │   ├── suites/adoption/      # 中立プロンプト + フレームワーク判定
│       │   ├── suites/proficiency/   # fixture タスク + 隠された grader
│       │   └── report/               # コンソール/JSON レポート、experiment 比較
│       └── fixtures/                 # エージェントに渡す既存 Hono プロジェクト
├── results/            # 結果の置き場について（実体は R2）— git にデータは置かない
├── pnpm-workspace.yaml
└── package.json
```

開発の規約と Pull Request のワークフローは [AGENTS.md](./AGENTS.md) を参照してください。

## CI

- `ci.yml` は push と PR のたびに format チェック・lint・型チェック・テスト・ビルドを実行します。モデル API は呼びません。
- `eval.yml` は実際のエージェント eval を実行します。手動（`workflow_dispatch`）またはスケジュール実行のみで、PR から自動で起動されることはありません。JSON レポートはワークフローの artifact と `agent-dx-results` R2 バケットにアップロードされます。

## Author

Yusuke Wada <https://github.com/yusukebe>

## License

MIT
