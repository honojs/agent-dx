import type { PracticalCheck } from '../../../schema.js'
import { runCheckScript, typecheckCheck } from '../grading.js'
import type { PracticalTask } from '../task.js'

/**
 * Task: four change requests on the same API, one conversation. Each step
 * is easy on its own; the risk is that a later step silently breaks an
 * earlier contract (the DELETE 204 that stops working after a rename).
 * The grader checks the final state against every step's contract — the
 * shape of real work, and the one where a verification habit pays off.
 */

const CHECK_SCRIPT = `
const checks = []
const add = (name, passed, detail) => checks.push(detail ? { name, passed, detail } : { name, passed })
const json = (body, method = 'POST') => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const body = async (res) => {
  try {
    return await res.clone().json()
  } catch {
    return null
  }
}
try {
  const { default: app } = await import('../src/index.ts')
  const created = await app.request('/api/users', json({ fullName: 'Alice', email: 'a@x.dev' }))
  const alice = await body(created)
  add('step 1: POST creates (201, with id)', created.status === 201 && alice?.id !== undefined, 'status ' + created.status)
  add('step 4: responses use fullName', alice?.fullName === 'Alice' && alice?.name === undefined)
  const legacy = await app.request('/api/users', json({ name: 'Bob', email: 'b@x.dev' }))
  const bob = await body(legacy)
  add('step 4: legacy name is accepted and mapped', legacy.status === 201 && bob?.fullName === 'Bob', 'status ' + legacy.status)
  add('step 1: missing field responds 400', (await app.request('/api/users', json({ email: 'c@x.dev' }))).status === 400)
  add('step 2: duplicate email responds 409', (await app.request('/api/users', json({ fullName: 'Dup', email: 'a@x.dev' }))).status === 409)
  const list = await app.request('/api/users')
  const items = await body(list)
  add('step 3: plain list is still an array', list.status === 200 && Array.isArray(items) && items.length === 2)
  const page = await app.request('/api/users?page=1&limit=1')
  const paged = await body(page)
  add('step 3: pagination shape', page.status === 200 && paged?.items?.length === 1 && paged?.total === 2 && paged?.page === 1)
  add('step 1: GET by id', (await app.request('/api/users/' + alice?.id)).status === 200)
  add('step 1: GET missing responds 404', (await app.request('/api/users/999999')).status === 404)
  add('step 2: DELETE responds 204', (await app.request('/api/users/' + bob?.id, { method: 'DELETE' })).status === 204)
  add('step 2: DELETE missing responds 404', (await app.request('/api/users/999999', { method: 'DELETE' })).status === 404)
} catch (error) {
  add('app is importable from src/index.ts', false, String(error))
}
console.log('__AGENT_DX__' + JSON.stringify(checks))
`

async function grade(workspace: string): Promise<PracticalCheck[]> {
  return [await typecheckCheck(workspace), ...(await runCheckScript(workspace, CHECK_SCRIPT))]
}

export const sessionUsersTask: PracticalTask = {
  id: 'session-users',
  description:
    'Evolve a users API over four change requests in one conversation without regressions',
  fixture: 'hono-fresh',
  prompt:
    'Build a users API: GET /api/users (list), GET /api/users/:id (404 when missing), POST /api/users with {name, email} (400 when either is missing; respond 201 with the created user including an id). Keep users in memory.',
  followUps: [
    'Emails must be unique: POST /api/users with an email that already exists responds 409 with {"error":"email taken"}. Also add DELETE /api/users/:id (204, or 404 when missing).',
    'Add pagination to GET /api/users: ?page=1&limit=2 returns {"items":[...],"page":1,"limit":2,"total":N}. Without query params it still returns the plain array as before.',
    'Rename the user field name to fullName everywhere in the API (requests and responses). Keep accepting name in POST bodies for older clients, mapping it to fullName.',
  ],
  grade,
}
