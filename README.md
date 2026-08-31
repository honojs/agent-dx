# Hono Agent DX

Measure and improve the developer experience of coding agents using [Hono](https://hono.dev).

Results are published at [agent-dx.hono.dev](https://agent-dx.hono.dev).

## What is Hono Agent DX?

Coding agents are becoming a primary way web apps and APIs get built. Hono Agent DX measures how well those agents work with Hono — and, more importantly, whether changes to the Hono CLI, Skills, Docs, or Core actually make the agent experience better.

It measures two things:

### Adoption

Do coding agents choose Hono on their own? We give an agent a **neutral prompt** (no framework is ever named) in an empty workspace, repeat it across many fresh conversations, and classify which framework it picked — Hono, a raw handler, Elysia, H3, Express, Fastify, itty-router, or something else. Classification is fully deterministic (static analysis of imports and dependencies); no LLM judging.

Each measurement is a runtime (Cloudflare Workers, Bun, Node.js, Deno) × scenario pair. Scenarios vary how much the task invites a framework: `minimal` (one trivial endpoint — using a framework is entirely the agent's idea), `api` (a realistic JSON API), and `framework` (explicitly asked to use a web framework — which one gets picked?).

### Proficiency

How effectively do coding agents use Hono? We hand the agent an existing Hono project and a small change request, then grade the modified project with **hidden deterministic checks** (runtime behavior via `app.request()` plus a TypeScript typecheck). The agent never sees the grader.

### Experiments

The main goal of this project: compare a **baseline** against a **candidate** — for example the Hono CLI with and without a change — and answer "did this change actually improve Agent DX?" with success rate, token usage, duration, and tool-call metrics.

Agents run on [Flue](https://flueframework.com), which gives us fresh conversations per run, local sandboxed execution, and multi-model support, with room to move runs into Cloudflare Sandbox later.

## How to run locally

```sh
pnpm install
pnpm format:check && pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## How to run an eval

Model runs need a provider API key (for the default model, `ANTHROPIC_API_KEY`).

```sh
# Adoption: does the agent pick Hono for a Cloudflare Workers app?
pnpm dlx @hono/agent-dx --suite adoption --runs 20

# Proficiency: can the agent modify an existing Hono project correctly?
pnpm dlx @hono/agent-dx --suite proficiency --runs 3

# Inside this repo, use the workspace CLI directly:
pnpm --filter @hono/agent-dx dev -- --suite adoption --runs 3
```

Useful options: `--model anthropic/claude-haiku-4-5`, `--runtime cloudflare-workers`, `--scenario minimal|api|framework`, `--task add-user-route`, `--variant baseline`, `--concurrency 10` (runs execute in parallel, 5 by default). Run `agent-dx --list` to see everything available.

Each run is an agentic loop with many model round-trips, so a single run takes one to a few minutes; the prompt is printed at the start and tool calls are streamed to stderr as they happen (`--quiet` hides them). Pass `--keep` to keep every run's workspace under `agent-dx-runs/` so you can read the code the agent actually produced.

### Using Cloudflare AI Gateway (unified billing)

Models can also be called through [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/), using Flue's built-in `cloudflare-ai-gateway` provider. With [unified billing](https://developers.cloudflare.com/ai-gateway/features/unified-billing/) no provider API key is needed — requests authenticate with an AI Gateway token only:

```sh
export CLOUDFLARE_API_KEY=...     # AI Gateway token
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_GATEWAY_ID=...
pnpm dlx @hono/agent-dx --suite adoption --model cloudflare-ai-gateway/claude-haiku-4-5
```

## How to generate a report

```sh
pnpm dlx @hono/agent-dx --suite adoption --runs 20 --report result.json
```

The JSON report uses a schema shared by the CLI, CI, and the website. Reports are stored in the `agent-dx-results` R2 bucket (the eval workflow uploads them automatically; see `results/README.md` for manual uploads), and agent-dx.hono.dev renders everything in the bucket. Result data is never committed to git.

To compare two runs (an experiment):

```sh
pnpm dlx @hono/agent-dx --suite proficiency --variant baseline  --report baseline.json
# ...switch to the candidate setup...
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

## Repository structure

```text
agent-dx/
├── apps/
│   └── web/            # agent-dx.hono.dev — Worker rendering reports from R2
├── packages/
│   └── agent-dx/       # @hono/agent-dx — CLI, Flue runner, suites, graders, reporters
│       ├── src/
│       │   ├── cli.ts
│       │   ├── schema.ts             # shared result schema
│       │   ├── runner/               # Flue-based agent runner
│       │   ├── suites/adoption/      # neutral prompts + framework detection
│       │   ├── suites/proficiency/   # fixture tasks + hidden graders
│       │   └── report/               # console/JSON reporters, experiment compare
│       └── fixtures/                 # existing Hono projects given to the agent
├── results/            # where results live (R2) — no data in git
├── pnpm-workspace.yaml
└── package.json
```

See [AGENTS.md](./AGENTS.md) for development conventions and the pull request workflow.

## CI

- `ci.yml` runs format check, lint, typecheck, tests, and builds on every push and pull request. No model APIs are called.
- `eval.yml` runs real agent evals. It is manual (`workflow_dispatch`) or scheduled — never triggered automatically by pull requests — and uploads the JSON report as a workflow artifact and to the `agent-dx-results` R2 bucket.

## Author

Yusuke Wada <https://github.com/yusukebe>

## License

MIT
