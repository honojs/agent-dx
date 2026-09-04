import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ProficiencyCheck } from '../../../schema.js'
import { runCheckScript, typecheckCheck } from '../grading.js'
import type { ProficiencyTask } from '../task.js'

/**
 * Task: split a bloated single-file app into routers without changing
 * behavior. The refactor itself is easy; the hard part is the promise
 * "no route changed" across ~25 endpoints — a verification-volume task,
 * which is the workload profile tools like `hono routes` and
 * `hono request` exist for.
 */

const CHECK_SCRIPT = `
const checks = []
const add = (name, passed, detail) => checks.push(detail ? { name, passed, detail } : { name, passed })
const get = (app, path, init) => app.request(path, init)
try {
  const { default: app } = await import('../src/index.ts')
  const cases = [
    ['GET / keeps its payload', async () => {
      const res = await get(app, '/')
      const body = await res.json()
      return res.status === 200 && body.name === 'hono-shop-api'
    }],
    ['GET /health works', async () => (await get(app, '/health')).status === 200],
    ['GET /api/users lists users', async () => {
      const res = await get(app, '/api/users')
      const body = await res.json()
      return res.status === 200 && Array.isArray(body) && body.length >= 3
    }],
    ['GET /api/users/:id works', async () => {
      const res = await get(app, '/api/users/1')
      const body = await res.json()
      return res.status === 200 && body.id === 1
    }],
    ['GET /api/users/:id/orders works', async () => {
      const res = await get(app, '/api/users/1/orders')
      return res.status === 200 && Array.isArray(await res.json())
    }],
    ['unknown user id responds 404', async () => (await get(app, '/api/users/999999')).status === 404],
    ['POST /api/users creates', async () => {
      const res = await get(app, '/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Momo', email: 'momo@example.com' }),
      })
      const body = await res.json()
      return res.status === 201 && body.id !== undefined
    }],
    ['GET /api/products?inStock=true filters', async () => {
      const res = await get(app, '/api/products?inStock=true')
      const body = await res.json()
      return res.status === 200 && Array.isArray(body) && body.every((p) => p.stock > 0)
    }],
    ['GET /api/products/:id/stock works', async () => {
      const res = await get(app, '/api/products/1/stock')
      const body = await res.json()
      return res.status === 200 && typeof body.stock === 'number'
    }],
    ['GET /api/orders?status=pending filters', async () => {
      const res = await get(app, '/api/orders?status=pending')
      const body = await res.json()
      return res.status === 200 && Array.isArray(body) && body.every((o) => o.status === 'pending')
    }],
    ['GET /api/orders/:id/items works', async () => {
      const res = await get(app, '/api/orders/2/items')
      return res.status === 200 && Array.isArray(await res.json())
    }],
    ['POST /api/orders rejects unknown users', async () => {
      const res = await get(app, '/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 999999, productIds: [1] }),
      })
      return res.status === 400
    }],
    ['admin area stays guarded', async () => (await get(app, '/api/admin/stats')).status === 403],
    ['admin works with the key', async () => {
      const res = await get(app, '/api/admin/stats', { headers: { 'X-Admin-Key': 'letmein' } })
      const body = await res.json()
      return res.status === 200 && typeof body.users === 'number'
    }],
    ['auth login -> me flow works', async () => {
      const login = await get(app, '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'alice@example.com' }),
      })
      const token = (await login.json()).token
      const me = await get(app, '/auth/me', { headers: { Authorization: 'Bearer ' + token } })
      const body = await me.json()
      return login.status === 200 && me.status === 200 && body.name === 'Alice'
    }],
  ]
  for (const [name, fn] of cases) {
    try {
      add(name, await fn())
    } catch (error) {
      add(name, false, String(error))
    }
  }
} catch (error) {
  add('app is importable from src/index.ts', false, String(error))
}
console.log('__AGENT_DX__' + JSON.stringify(checks))
`

async function grade(workspace: string): Promise<ProficiencyCheck[]> {
  const checks: ProficiencyCheck[] = [await typecheckCheck(workspace)]

  // The refactor must actually happen: routers extracted into src/routes/
  // and the entry point reduced to wiring.
  let routeFiles = 0
  try {
    const entries = await readdir(join(workspace, 'src', 'routes'))
    routeFiles = entries.filter((name) => name.endsWith('.ts')).length
  } catch {
    // Missing directory counts as zero.
  }
  const entryLines = (
    await readFile(join(workspace, 'src', 'index.ts'), 'utf8')
  ).split('\n').length
  checks.push({
    name: 'routes are split into src/routes/ modules',
    passed: routeFiles >= 4,
    detail: `${routeFiles} route files`,
  })
  checks.push({
    name: 'the entry point is reduced to wiring',
    passed: entryLines <= 60,
    detail: `src/index.ts has ${entryLines} lines`,
  })

  return [...checks, ...(await runCheckScript(workspace, CHECK_SCRIPT))]
}

export const refactorRoutesTask: ProficiencyTask = {
  id: 'refactor-routes',
  description:
    'Split a bloated single-file app into routers without changing behavior',
  fixture: 'hono-shop-flat',
  prompt: [
    'src/index.ts has grown too large. Split the routes into router files under src/routes/ (users, products, orders, admin, auth), mounted from the entry point.',
    'Do not change any route path or behavior — make sure every endpoint still works exactly as it did before.',
  ].join('\n'),
  grade,
}
