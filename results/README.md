# Results

Eval results are **not stored in git**. They live in the `agent-dx-results` R2 bucket and are rendered at [agent-dx.hono.dev](https://agent-dx.hono.dev).

- The CLI writes a report with `--report result.json`; the schema lives in `packages/agent-dx/src/schema.ts` and is shared by the CLI, CI, and the website.
- The eval workflow (`.github/workflows/eval.yml`) uploads its report to R2 as `<suite>/<timestamp>-<model>.json`. Keys are never overwritten, so the bucket keeps the full history.
- The website (`apps/web`) is a Worker with an R2 binding that lists and renders every report in the bucket.

To upload a locally produced report:

```sh
pnpm --dir apps/web exec wrangler r2 object put \
  "agent-dx-results/adoption/$(date -u +%Y-%m-%dT%H-%M-%S)-local.json" \
  --file ../../result.json --remote
```
