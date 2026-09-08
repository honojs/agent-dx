import type { PracticalTask } from '../task.js'
import { buildEndpointsTask } from './build-endpoints.js'

/**
 * Task: the same users CRUD, on a stock create-hono Cloudflare Workers
 * project — `npm run dev` starts `wrangler dev`, there is no typecheck
 * script and no AGENTS.md. Every other fixture has no dev server, so the
 * failure mode the Hono CLI was built for (the agent starts a server in
 * the foreground to verify and never gets its shell back) cannot happen
 * there. Here it can. Note for local runs: agents may `pkill -f wrangler`.
 */
export const buildEndpointsWorkersTask: PracticalTask = {
  ...buildEndpointsTask,
  id: 'build-endpoints-workers',
  description: 'Build a users CRUD on a stock create-hono Workers project (wrangler dev available)',
  fixture: 'hono-workers',
}
