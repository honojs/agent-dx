import type { PracticalCheck } from '../../../schema.js'
import { runCheckScript, typecheckCheck } from '../grading.js'
import type { PracticalTask } from '../task.js'

/**
 * Task: add `GET /users/:id` to an existing Hono app.
 * Graded with hidden deterministic checks; no LLM judging.
 */

const CHECK_SCRIPT = `
const checks = []
const add = (name, passed, detail) => checks.push(detail ? { name, passed, detail } : { name, passed })
try {
  const { default: app } = await import('../src/index.ts')
  try {
    const res = await app.request('/users/123')
    add('GET /users/:id responds with 200', res.status === 200, 'status ' + res.status)
    let id
    try {
      const body = await res.json()
      id = body && body.id
    } catch {}
    add('GET /users/:id returns the id as JSON', id === '123', 'id: ' + JSON.stringify(id))
  } catch (error) {
    add('GET /users/:id responds with 200', false, String(error))
    add('GET /users/:id returns the id as JSON', false, 'request failed')
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
  return [
    await typecheckCheck(workspace),
    ...(await runCheckScript(workspace, CHECK_SCRIPT)),
  ]
}

export const addUserRouteTask: PracticalTask = {
  id: 'add-user-route',
  description: 'Add a GET /users/:id route to an existing Hono app',
  fixture: 'hono-basic',
  prompt: 'Add GET /users/:id and return the id as JSON.',
  grade,
}
