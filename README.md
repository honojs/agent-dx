# Hono Agent DX

Measure and improve the developer experience of coding agents using [Hono](https://hono.dev).

Results are published at [agent-dx.hono.dev](https://agent-dx.hono.dev).

## What is Hono Agent DX?

Coding agents are becoming a primary way web apps and APIs get built. Hono Agent DX measures how well those agents work with Hono — and, more importantly, whether changes to the Hono CLI, Skills, Docs, or Core actually make the agent experience better.

It measures two things:

### Adoption

Do coding agents choose Hono on their own? We give an agent a **neutral prompt** (no framework is ever mentioned) in an empty workspace, repeat it across many fresh conversations, and classify which framework it picked — Hono, a raw handler, Elysia, H3, Express, Fastify, itty-router, or something else. Classification is fully deterministic (static analysis of imports and dependencies); no LLM judging.

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

Useful options: `--model anthropic/claude-haiku-4-5`, `--runtime cloudflare-workers`, `--task add-user-route`, `--variant baseline`, `--concurrency 5` (runs execute in parallel, 4 by default). Run `agent-dx --list` to see everything available.

Each run is an agentic loop with many model round-trips, so a single run takes one to a few minutes; tool calls are streamed to stderr as they happen (`--quiet` hides them).

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

The JSON report uses a schema shared by the CLI, CI, and the website. Reports checked into `results/` are rendered at agent-dx.hono.dev.

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
│   └── web/            # agent-dx.hono.dev — renders results/*.json (Hono + SSG)
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
├── results/            # machine-readable eval results (rendered by the website)
├── pnpm-workspace.yaml
└── package.json
```

See [AGENTS.md](./AGENTS.md) for development conventions and the pull request workflow.

## CI

- `ci.yml` runs format check, lint, typecheck, tests, and builds on every push and pull request. No model APIs are called.
- `eval.yml` runs real agent evals. It is manual (`workflow_dispatch`) or scheduled — never triggered automatically by pull requests — and uploads the JSON report as an artifact.

## Author

Yusuke Wada <https://github.com/yusukebe>

## License

MIT
