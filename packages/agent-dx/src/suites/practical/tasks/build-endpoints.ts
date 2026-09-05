import type { PracticalCheck } from '../../../schema.js'
import { runCheckScript, typecheckCheck } from '../grading.js'
import type { PracticalTask } from '../task.js'

/**
 * Task: build a small CRUD feature from scratch and make sure it works.
 *
 * Unlike the debugging tasks, this is a creation task with verification
 * pressure ("make sure they work") — the situation `hono request` is
 * designed for. The prompt never names a tool; how the agent verifies
 * (hand-rolled scripts, a server, or the CLI) is part of what we measure.
 */

const CHECK_SCRIPT = `
const checks = []
const add = (name, passed, detail) => checks.push(detail ? { name, passed, detail } : { name, passed })
try {
  const { default: app } = await import('../src/index.ts')
  try {
    const res = await app.request('/users')
    let ok = false
    try {
      ok = Array.isArray(await res.json())
    } catch {}
    add('GET /users returns a JSON list', res.status === 200 && ok, 'status ' + res.status)
  } catch (error) {
    add('GET /users returns a JSON list', false, String(error))
  }
  let createdId
  try {
    const res = await app.request('/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Momo' }),
    })
    let body
    try {
      body = await res.json()
    } catch {}
    createdId = body && body.id
    add(
      'POST /users creates a user with an id',
      (res.status === 200 || res.status === 201) && createdId !== undefined && body.name === 'Momo',
      'status ' + res.status,
    )
  } catch (error) {
    add('POST /users creates a user with an id', false, String(error))
  }
  try {
    const res = await app.request('/users/' + createdId)
    let body
    try {
      body = await res.json()
    } catch {}
    add(
      'GET /users/:id returns the created user',
      res.status === 200 && body && body.name === 'Momo',
      'status ' + res.status,
    )
  } catch (error) {
    add('GET /users/:id returns the created user', false, String(error))
  }
  try {
    const res = await app.request('/users/999999')
    add('GET /users/:id responds 404 for unknown ids', res.status === 404, 'status ' + res.status)
  } catch (error) {
    add('GET /users/:id responds 404 for unknown ids', false, String(error))
  }
  try {
    const del = await app.request('/users/' + createdId, { method: 'DELETE' })
    const after = await app.request('/users/' + createdId)
    add(
      'DELETE /users/:id removes the user',
      del.status < 300 && after.status === 404,
      'delete ' + del.status + ', after ' + after.status,
    )
  } catch (error) {
    add('DELETE /users/:id removes the user', false, String(error))
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

export const buildEndpointsTask: PracticalTask = {
  id: 'build-endpoints',
  description: 'Build a small users CRUD from scratch and verify it works',
  fixture: 'hono-fresh',
  prompt: [
    'Add a users API to this app, with in-memory data:',
    '- GET /users returns the list of users as JSON',
    '- POST /users creates a user from {"name": string} and returns it with an id',
    '- GET /users/:id returns that user, or a 404 JSON error for unknown ids',
    '- DELETE /users/:id removes the user',
    'Make sure every endpoint actually works before you finish.',
  ].join('\n'),
  grade,
}
