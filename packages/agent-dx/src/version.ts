import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

function readVersion(): string {
  try {
    const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url))
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      version?: string
    }
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export const TOOL_VERSION = readVersion()
