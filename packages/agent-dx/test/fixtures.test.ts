import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { hashDirectory } from '../src/fixtures.js'

let dirs: string[] = []

async function makeDir(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'agent-dx-hash-'))
  dirs.push(dir)
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path)
    await mkdir(join(full, '..'), { recursive: true })
    await writeFile(full, content)
  }
  return dir
}

afterEach(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })))
  dirs = []
})

describe('hashDirectory', () => {
  it('is deterministic for identical content', async () => {
    const a = await makeDir({ 'src/index.ts': 'export {}\n', 'a.md': 'hi\n' })
    const b = await makeDir({ 'a.md': 'hi\n', 'src/index.ts': 'export {}\n' })
    expect(await hashDirectory(a)).toBe(await hashDirectory(b))
  })

  it('changes when content or paths change', async () => {
    const base = await makeDir({ 'src/index.ts': 'export {}\n' })
    const edited = await makeDir({ 'src/index.ts': 'export { x }\n' })
    const moved = await makeDir({ 'src/main.ts': 'export {}\n' })
    const hash = await hashDirectory(base)
    expect(await hashDirectory(edited)).not.toBe(hash)
    expect(await hashDirectory(moved)).not.toBe(hash)
  })

  it('ignores node_modules', async () => {
    const clean = await makeDir({ 'src/index.ts': 'export {}\n' })
    const installed = await makeDir({
      'src/index.ts': 'export {}\n',
      'node_modules/hono/index.js': 'module.exports = {}\n',
    })
    expect(await hashDirectory(installed)).toBe(await hashDirectory(clean))
  })
})
