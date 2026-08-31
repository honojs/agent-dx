import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { persistWorkspace } from '../src/workspace.js'

let dirs: string[] = []

afterEach(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { recursive: true, force: true })),
  )
  dirs = []
})

describe('persistWorkspace', () => {
  it('copies the workspace but skips dependencies and grader files', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'agent-dx-ws-'))
    const out = await mkdtemp(join(tmpdir(), 'agent-dx-out-'))
    dirs.push(workspace, out)

    await mkdir(join(workspace, 'src'), { recursive: true })
    await mkdir(join(workspace, 'node_modules', 'hono'), { recursive: true })
    await mkdir(join(workspace, '.agent-dx'), { recursive: true })
    await writeFile(join(workspace, 'src', 'index.ts'), 'export {}\n')
    await writeFile(join(workspace, 'package.json'), '{}\n')
    await writeFile(join(workspace, '.agent-dx', 'check.mjs'), '//\n')

    const dest = join(out, 'run-1')
    await persistWorkspace(workspace, dest)

    const kept = (await readdir(dest)).sort()
    expect(kept).toEqual(['package.json', 'src'])
    expect(await readdir(join(dest, 'src'))).toEqual(['index.ts'])
  })
})
