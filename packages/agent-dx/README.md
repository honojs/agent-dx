# @hono/agent-dx

Measure and improve the developer experience of coding agents using [Hono](https://hono.dev).

```sh
pnpm dlx @hono/agent-dx --suite adoption --runs 20
pnpm dlx @hono/agent-dx --suite practical --runs 3 --report result.json
pnpm dlx @hono/agent-dx compare baseline.json candidate.json
```

Model runs require a provider API key (for the default model, `ANTHROPIC_API_KEY`). Run `pnpm dlx @hono/agent-dx --help` for all options.

See the [Hono Agent DX repository](https://github.com/honojs/agent-dx) for full documentation, and [agent-dx.hono.dev](https://agent-dx.hono.dev) for published results.
