# AGENTS.md

Guidance for AI coding agents (and humans) working on this repository.

## What is Hono Agent DX?

Hono Agent DX measures and improves the developer experience of coding agents using [Hono](https://hono.dev). It runs agent evals in two suites — **adoption** (does an agent choose Hono given a neutral prompt?) and **proficiency** (can an agent correctly modify an existing Hono project?) — and compares baseline vs candidate variants of the Hono CLI, Skills, Docs, or Core to answer "did this change actually improve Agent DX?". Results are machine-readable JSON stored in the `agent-dx-results` R2 bucket, rendered at [agent-dx.hono.dev](https://agent-dx.hono.dev).

## Current status

v0. The CLI runs both suites locally via Flue with deterministic grading (static framework detection, hidden `app.request()`/typecheck checks). Experiment orchestration is implemented for `--target cli` (injects the candidate Hono CLI into the fixture and diffs baseline vs candidate, including Hono CLI usage metrics); `skill` / `docs` / `hono` targets are interface-only — run those variants manually and diff them with `agent-dx compare`. Do not implement features that have not been requested.

## Repository layout

| Path                | Package          | Purpose                                                         |
| ------------------- | ---------------- | --------------------------------------------------------------- |
| `packages/agent-dx` | `@hono/agent-dx` | CLI, Flue runner, eval suites, graders, reporters (publishable) |
| `apps/web`          | `agent-dx-web`   | agent-dx.hono.dev — Worker rendering reports from R2            |
| `results/`          | —                | Docs for result storage (R2); result data is never in git       |

## Architecture rules (do not violate)

1. Grading is deterministic. No LLM judging; classification and checks must yield the same verdict for the same workspace.
2. Adoption prompts stay neutral. Never mention Hono or any other framework in an adoption prompt or in the adoption agent instructions.
3. Proficiency graders are hidden. The agent under evaluation must never see check scripts or grading criteria.
4. The result schema (`packages/agent-dx/src/schema.ts`) is shared by the CLI, CI, and the web app. Change it in one place and bump `schemaVersion` on breaking changes.
5. Model APIs are never called from PR CI. Evals run manually (`workflow_dispatch`) or on a schedule only.
6. Result data lives in the `agent-dx-results` R2 bucket (append-only keys, uploaded by `eval.yml`, rendered by the website). Never commit result JSON to git, and never let CI commit to the repository.
7. Keep packages minimal. No speculative abstractions; do not split packages until it is actually needed. Do not add Turborepo, Nx, or similar — plain package.json scripts with `pnpm -r` are enough.

## Pull Request Workflow

1. Branch from latest `main`: `<type>/<short-slug>`. `<type>` is `feat` / `fix` / `chore` / `docs` / `refactor`.
2. Implement.
3. Run the quality gates. All must pass:

   ```sh
   pnpm format && pnpm lint:fix
   pnpm typecheck
   pnpm test
   pnpm build
   ```

   CI (`.github/workflows/ci.yml`) runs the same gates (`format:check`, `lint`, `typecheck`, `test`, `build`) on every PR.

4. Commit with conventional commits: `<type>(<scope>): <description>`. Example: `feat(adoption): add bun runtime prompt`.
5. Open a PR against `main`. Keep the body short: what and why, in a few sentences. No fixed section labels — write it like a human note. Add notes the checklist does not cover as plain sentences. Use bullets only when there are several items. Add `Closes #<n>` only if an issue exists. End the body with the checklist from `.github/pull_request_template.md` and check the items you did.
6. Self-review the diff with the checklist from the PR template before asking for review.

**No AI attribution.** Do not add `Co-Authored-By`, session links, or "Generated with ..." to commits or PR bodies.

One PR = one concern. Do not force-push a branch under review.

## Conventions

- pnpm workspaces; internal references use the `workspace:*` protocol.
- `@hono/agent-dx` is published to npm, so it builds to `dist/` with `tsc`; the web app has no publish step and runs from source with `tsx`.
- Every package has a `typecheck` script (`tsc --noEmit`). Run `pnpm typecheck` at the root.
- Tests use [Vitest](https://vitest.dev/) (`pnpm test` at the root). Hono apps are tested with `app.request()` — no running server needed.
- Linting and formatting use the [Oxc](https://oxc.rs/) toolchain: oxlint (`pnpm lint` / `pnpm lint:fix`) and oxfmt (`pnpm format` / `pnpm format:check`, configured in `.oxfmtrc.json`).
- Agents are run with Flue (`@flue/runtime`, https://github.com/withastro/flue) through the single runner in `packages/agent-dx/src/runner/`. Additional runners (e.g. Cloudflare Sandbox) implement the same `AgentRunOutcome` contract.
- Eval fixtures live in `packages/agent-dx/fixtures/` and are excluded from lint and workspace installs; their dependencies are installed at eval time.
- Do not hard-wrap prose in Markdown files — write each paragraph and list item on a single line.
- Documentation, code comments, CLI output, and commit messages are in English. The one exception is `README.ja.md`, the Japanese translation of `README.md`: every change to `README.md` must update `README.ja.md` in the same PR, and vice versa.
- The web site deploys to `agent-dx.hono.dev`.
