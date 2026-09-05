import type { PracticalCheck } from '../../../schema.js'
import { runCheckScript, typecheckCheck } from '../grading.js'
import type { PracticalTask } from '../task.js'

/**
 * Task: debug a 404 that reading the obvious file cannot explain.
 *
 * The orders router in the ~30-route `hono-shop` fixture is completely
 * correct; a feature-gate middleware on `/api/*` returns 404 because a
 * leftover flag still marks the orders section as off. The name of the
 * failing path points at an innocent file, so the run has to reason
 * about runtime request resolution — the situation `hono routes` and
 * `hono request --trace` are designed for.
 */

const CHECK_SCRIPT = `
const checks = []
const add = (name, passed, detail) => checks.push(detail ? { name, passed, detail } : { name, passed })
try {
  const { default: app } = await import('../src/index.ts')
  try {
    const res = await app.request('/api/orders')
    add('GET /api/orders responds with 200', res.status === 200, 'status ' + res.status)
    let ok = false
    try {
      const body = await res.json()
      ok = Array.isArray(body) && body.length >= 3
    } catch {}
    add('GET /api/orders returns the order list', ok)
  } catch (error) {
    add('GET /api/orders responds with 200', false, String(error))
    add('GET /api/orders returns the order list', false, 'request failed')
  }
  try {
    const res = await app.request('/api/orders/2')
    let id
    try {
      const body = await res.json()
      id = body && body.id
    } catch {}
    add('GET /api/orders/:id works too', res.status === 200 && id === 2, 'status ' + res.status)
  } catch (error) {
    add('GET /api/orders/:id works too', false, String(error))
  }
  try {
    const users = await app.request('/api/users')
    const product = await app.request('/api/products/1')
    const health = await app.request('/health')
    add(
      'other routers are untouched',
      users.status === 200 && product.status === 200 && health.status === 200,
      \`users \${users.status}, product \${product.status}, health \${health.status}\`,
    )
  } catch (error) {
    add('other routers are untouched', false, String(error))
  }
  try {
    const res = await app.request('/api/admin/stats')
    add(
      'the admin guard still applies',
      res.status === 403,
      'status ' + res.status,
    )
  } catch (error) {
    add('the admin guard still applies', false, String(error))
  }
} catch (error) {
  add('app is importable from src/index.ts', false, String(error))
}
console.log('__AGENT_DX__' + JSON.stringify(checks))
`

async function grade(workspace: string): Promise<PracticalCheck[]> {
  return [await typecheckCheck(workspace), ...(await runCheckScript(workspace, CHECK_SCRIPT))]
}

export const fix404ShadowTask: PracticalTask = {
  id: 'fix-404-shadow',
  description: 'Debug a 404 the obvious file cannot explain (feature-gate shadowing)',
  fixture: 'hono-shop',
  prompt:
    'GET /api/orders returns 404, but the orders routes exist in the code. Debug the routing and fix it.',
  grade,
}
