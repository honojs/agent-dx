import { fileURLToPath } from 'node:url'

/**
 * Resolve a fixture directory bundled with this package.
 * Works from both `src/` (tsx) and `dist/` (compiled) because `fixtures/`
 * sits next to them at the package root.
 */
export function fixtureDir(name: string): string {
  return fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url))
}
