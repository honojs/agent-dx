import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { exec } from '../../../exec.js'
import type { ProficiencyCheck } from '../../../schema.js'
import type { ProficiencyTask } from '../task.js'

/**
 * Task: add `GET /users/:id` to an existing Hono app.
 *
 * Grading is hidden from the agent: after the run we drop a check script
 * into the workspace and execute it, plus a TypeScript typecheck.
 * Everything is deterministic; no LLM judging.
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

function parseChecks(stdout: string): ProficiencyCheck[] | null {
  const line = stdout.split('\n').find((l) => l.startsWith('__AGENT_DX__'))
  if (!line) return null
  try {
    return JSON.parse(line.slice('__AGENT_DX__'.length)) as ProficiencyCheck[]
  } catch {
    return null
  }
}

async function grade(workspace: string): Promise<ProficiencyCheck[]> {
  const checks: ProficiencyCheck[] = []

  const tsc = await exec(
    join(workspace, 'node_modules', '.bin', 'tsc'),
    ['--noEmit'],
    {
      cwd: workspace,
    },
  )
  checks.push({
    name: 'TypeScript typecheck passes',
    passed: tsc.ok,
    detail: tsc.ok ? undefined : (tsc.stdout || tsc.stderr).slice(0, 500),
  })

  const graderDir = join(workspace, '.agent-dx')
  await mkdir(graderDir, { recursive: true })
  await writeFile(join(graderDir, 'check.mjs'), CHECK_SCRIPT)
  // Run the check with our own tsx loader so the fixture does not need a
  // TypeScript runner among its dependencies.
  const tsxLoader = pathToFileURL(
    createRequire(import.meta.url).resolve('tsx'),
  ).href
  const run = await exec(
    process.execPath,
    ['--import', tsxLoader, join(graderDir, 'check.mjs')],
    { cwd: workspace },
  )
  const behavior = parseChecks(run.stdout)
  if (behavior) {
    checks.push(...behavior)
  } else {
    checks.push({
      name: 'behavior checks executed',
      passed: false,
      detail: (run.stderr || run.stdout).slice(0, 500),
    })
  }

  return checks
}

export const addUserRouteTask: ProficiencyTask = {
  id: 'add-user-route',
  description: 'Add a GET /users/:id route to an existing Hono app',
  fixture: 'hono-basic',
  prompt: 'Add GET /users/:id and return the id as JSON.',
  grade,
}
