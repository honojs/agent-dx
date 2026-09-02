import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Resolve a fixture directory bundled with this package.
 * Works from both `src/` (tsx) and `dist/` (compiled) because `fixtures/`
 * sits next to them at the package root.
 */
export function fixtureDir(name: string): string {
  return fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url))
}

/**
 * Deterministic content hash of a fixture directory: sha256 over sorted
 * relative paths and file bytes, truncated for readability. Recorded in
 * reports so results from different fixture revisions are never silently
 * compared — a changed fixture changes the task.
 */
export async function hashDirectory(dir: string): Promise<string> {
  const files: string[] = []
  const walk = async (current: string): Promise<void> => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.DS_Store') continue
      const full = join(current, entry.name)
      if (entry.isDirectory()) await walk(full)
      else files.push(full)
    }
  }
  await walk(dir)
  files.sort((a, b) => relative(dir, a).localeCompare(relative(dir, b)))
  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(relative(dir, file))
    hash.update('\0')
    hash.update(await readFile(file))
    hash.update('\0')
  }
  return hash.digest('hex').slice(0, 16)
}
