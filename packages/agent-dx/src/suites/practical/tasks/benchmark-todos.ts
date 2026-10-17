import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PracticalCheck } from '../../../schema.js'
import { runCheckScript, typecheckCheck } from '../grading.js'
import type { PracticalTask } from '../task.js'

/**
 * Task: speed up an endpoint, then add a feature to it without a
 * performance regression, in one conversation.
 *
 * `GET /api/todos` in the `hono-todos-benchmark` fixture awaits
 * `slowDown()` (a plain 5ms sleep), so the first step is trivially fixed
 * by removing the call. The point is the second step: a feature on the
 * same endpoint with a stated tolerance (10%), the situation
 * `hono benchmark --save` / `--compare` is designed for. Whether the
 * agent measured is a diagnostic (its commands), never a check.
 */

const CHECK_SCRIPT = `
const checks = []
const add = (name, passed, detail) => checks.push(detail ? { name, passed, detail } : { name, passed })
const SEED = [
  { id: 1, title: 'Write docs', done: false },
  { id: 2, title: 'Set up CI', done: true },
  { id: 3, title: 'Ship v1', done: false },
  { id: 4, title: 'Pick a name', done: true },
]
const body = async (res) => {
  try {
    return await res.clone().json()
  } catch {
    return null
  }
}
const ids = (items) => (Array.isArray(items) ? items.map((todo) => todo.id).sort((a, b) => a - b).join(',') : 'not an array')
try {
  const { default: app } = await import('../src/index.ts')
  // Count only calls made while serving requests.
  globalThis.__agentDxSlowCalls = 0
  const list = await app.request('/api/todos')
  add('step 1: GET /api/todos response is unchanged', list.status === 200 && JSON.stringify(await body(list)) === JSON.stringify(SEED), 'status ' + list.status)
  const done = await app.request('/api/todos?done=true')
  const doneIds = ids(await body(done))
  add('step 2: ?done=true returns only completed todos', done.status === 200 && doneIds === '2,4', 'ids ' + doneIds)
  const open = await app.request('/api/todos?done=false')
  const openIds = ids(await body(open))
  add('step 2: ?done=false returns only open todos', open.status === 200 && openIds === '1,3', 'ids ' + openIds)
  add('existing GET / still works', (await app.request('/')).status === 200)
  const created = await app.request('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'New' }),
  })
  add('existing POST /api/todos still works', created.status === 201, 'status ' + created.status)
  const calls = globalThis.__agentDxSlowCalls
  add('slowDown() is never called while serving requests', calls === 0, calls + ' calls')
} catch (error) {
  add('app is importable from src/index.ts', false, String(error))
}
console.log('__AGENT_DX__' + JSON.stringify(checks))
`

/** Stands in for `src/slow.ts` while grading: counts calls, never sleeps. */
const COUNTING_SLOW_MODULE = `export async function slowDown(): Promise<void> {
  const counter = globalThis as { __agentDxSlowCalls?: number }
  counter.__agentDxSlowCalls = (counter.__agentDxSlowCalls ?? 0) + 1
}
`

async function grade(workspace: string): Promise<PracticalCheck[]> {
  const typecheck = await typecheckCheck(workspace)
  // ESM exports cannot be spied on from outside, so swap the module for a
  // counting one during the check and restore the agent's file afterwards.
  const slowModule = join(workspace, 'src', 'slow.ts')
  const original = await readFile(slowModule, 'utf8').catch(() => undefined)
  if (original !== undefined) {
    await writeFile(slowModule, COUNTING_SLOW_MODULE)
  }
  try {
    return [typecheck, ...(await runCheckScript(workspace, CHECK_SCRIPT))]
  } finally {
    if (original !== undefined) {
      await writeFile(slowModule, original)
    }
  }
}

export const benchmarkTodosTask: PracticalTask = {
  id: 'benchmark-todos',
  description: 'Speed up an endpoint, then add a feature without a performance regression',
  fixture: 'hono-todos-benchmark',
  prompt: 'GET /api/todos is slow. Improve its performance without changing its response.',
  followUps: [
    'Add a done filter to GET /api/todos: ?done=true returns only completed todos, ?done=false only open ones, and without the query it returns all todos as before. Do not make it slower: a slowdown of up to 10% is acceptable, more is not.',
  ],
  grade,
}
