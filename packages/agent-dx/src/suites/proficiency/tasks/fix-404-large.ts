import type { ProficiencyCheck } from '../../../schema.js'
import { runCheckScript, typecheckCheck } from '../grading.js'
import type { ProficiencyTask } from '../task.js'

/**
 * Task: debug a 404 in a ~30-route Hono app split across several router
 * files. Same double-prefix mount bug as `fix-404`, but buried in one of
 * five routers — finding it by reading code is expensive, which is
 * exactly the situation tools like `hono routes` are designed for.
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
    const res = await app.request('/api/orders/orders')
    add('the double-prefixed path is gone', res.status === 404, 'status ' + res.status)
  } catch (error) {
    add('the double-prefixed path is gone', false, String(error))
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
} catch (error) {
  add('app is importable from src/index.ts', false, String(error))
}
console.log('__AGENT_DX__' + JSON.stringify(checks))
`

async function grade(workspace: string): Promise<ProficiencyCheck[]> {
  return [
    await typecheckCheck(workspace),
    ...(await runCheckScript(workspace, CHECK_SCRIPT)),
  ]
}

export const fix404LargeTask: ProficiencyTask = {
  id: 'fix-404-large',
  description: 'Debug a 404 buried in a ~30-route app split across routers',
  fixture: 'hono-shop',
  prompt:
    'GET /api/orders returns 404, but the orders routes exist in the code. Debug the routing and fix it.',
  grade,
}
