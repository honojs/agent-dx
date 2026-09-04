import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { exec } from '../../exec.js'
import type { PracticalCheck } from '../../schema.js'

/**
 * Shared helpers for hidden graders. Everything here runs only after the
 * agent has finished; the agent never sees check scripts or criteria.
 */

/** Run `tsc --noEmit` with the workspace's own TypeScript. */
export async function typecheckCheck(
  workspace: string,
): Promise<PracticalCheck> {
  const tsc = await exec(
    join(workspace, 'node_modules', '.bin', 'tsc'),
    ['--noEmit'],
    { cwd: workspace },
  )
  return {
    name: 'TypeScript typecheck passes',
    passed: tsc.ok,
    detail: tsc.ok ? undefined : (tsc.stdout || tsc.stderr).slice(0, 500),
  }
}

/**
 * Execute a hidden check script inside the workspace using our own tsx
 * loader (fixtures need no TypeScript runner among their dependencies)
 * and parse the `__AGENT_DX__<json>` line it prints into checks.
 */
export async function runCheckScript(
  workspace: string,
  script: string,
): Promise<PracticalCheck[]> {
  const graderDir = join(workspace, '.agent-dx')
  await mkdir(graderDir, { recursive: true })
  await writeFile(join(graderDir, 'check.mjs'), script)
  const tsxLoader = pathToFileURL(
    createRequire(import.meta.url).resolve('tsx'),
  ).href
  const run = await exec(
    process.execPath,
    ['--import', tsxLoader, join(graderDir, 'check.mjs')],
    { cwd: workspace },
  )
  const line = run.stdout
    .split('\n')
    .find((text) => text.startsWith('__AGENT_DX__'))
  if (line) {
    try {
      return JSON.parse(line.slice('__AGENT_DX__'.length)) as PracticalCheck[]
    } catch {
      // Fall through to the failure check below.
    }
  }
  return [
    {
      name: 'behavior checks executed',
      passed: false,
      detail: (run.stderr || run.stdout).slice(0, 500),
    },
  ]
}
