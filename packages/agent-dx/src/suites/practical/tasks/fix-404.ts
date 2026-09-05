import type { PracticalCheck } from '../../../schema.js'
import { runCheckScript, typecheckCheck } from '../grading.js'
import type { PracticalTask } from '../task.js'

/**
 * Task: debug a 404 in an existing Hono app.
 *
 * The fixture mounts a sub-app with `app.route('/api', api)` while the
 * sub-app's routes are also prefixed with `/api`, so `GET /api/todos`
 * actually lives at `/api/api/todos` — a classic Hono routing mistake.
 * The checks require the double-prefixed path to be gone, so adding a
 * duplicate route instead of fixing the mount does not pass.
 */

const CHECK_SCRIPT = `
const checks = []
const add = (name, passed, detail) => checks.push(detail ? { name, passed, detail } : { name, passed })
try {
  const { default: app } = await import('../src/index.ts')
  try {
    const res = await app.request('/api/todos')
    add('GET /api/todos responds with 200', res.status === 200, 'status ' + res.status)
    let ok = false
    try {
      const body = await res.json()
      ok = Array.isArray(body) && body.length >= 2
    } catch {}
    add('GET /api/todos returns the todo list', ok)
  } catch (error) {
    add('GET /api/todos responds with 200', false, String(error))
    add('GET /api/todos returns the todo list', false, 'request failed')
  }
  try {
    const res = await app.request('/api/api/todos')
    add('the double-prefixed path is gone', res.status === 404, 'status ' + res.status)
  } catch (error) {
    add('the double-prefixed path is gone', false, String(error))
  }
  try {
    const res = await app.request('/')
    add('existing GET / still works', res.status === 200, 'status ' + res.status)
  } catch (error) {
    add('existing GET / still works', false, String(error))
  }
} catch (error) {
  add('app is importable from src/index.ts', false, String(error))
}
console.log('__AGENT_DX__' + JSON.stringify(checks))
`

async function grade(workspace: string): Promise<PracticalCheck[]> {
  return [await typecheckCheck(workspace), ...(await runCheckScript(workspace, CHECK_SCRIPT))]
}

export const fix404Task: PracticalTask = {
  id: 'fix-404',
  description: 'Debug a 404 caused by a double-prefixed sub-app mount',
  fixture: 'hono-todos',
  prompt:
    'GET /api/todos returns 404, but the todos route exists in the code. Debug the routing and fix it.',
  grade,
}
