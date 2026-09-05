import type { Dirent } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { builtinModules } from 'node:module'
import { extname, join, relative } from 'node:path'
import type { FrameworkId } from '../../schema.js'

/**
 * Deterministic framework detection.
 *
 * We look at two static signals in the generated workspace:
 *   1. dependencies / devDependencies in every package.json
 *   2. import / require sources in every JS/TS source file
 *
 * No LLM judging: the same workspace always yields the same classification.
 */

interface KnownFramework {
  id: FrameworkId
  /** Exact package names that identify this framework. */
  packages: string[]
}

const KNOWN_FRAMEWORKS: KnownFramework[] = [
  { id: 'hono', packages: ['hono'] },
  { id: 'elysia', packages: ['elysia'] },
  { id: 'h3', packages: ['h3'] },
  { id: 'express', packages: ['express'] },
  { id: 'oak', packages: ['oak', '@oak/oak'] },
  { id: 'fastify', packages: ['fastify'] },
  { id: 'itty-router', packages: ['itty-router'] },
]

/** Packages that never indicate a framework choice. */
const NON_FRAMEWORK_PACKAGES = new Set([
  'typescript',
  'wrangler',
  'vitest',
  'esbuild',
  'tsx',
  'ts-node',
  'vite',
  'zod',
  'valibot',
  'miniflare',
  'prettier',
  'eslint',
  'oxlint',
  'oxfmt',
  'bun-types',
])

const NON_FRAMEWORK_PREFIXES = ['@cloudflare/', '@types/', '@typescript-eslint/', '@vitest/']

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'])

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', '.wrangler', '.agent-dx'])

export interface DetectionResult {
  framework: FrameworkId
  evidence: string[]
  unknownPackages: string[]
}

interface WorkspaceScan {
  /** package name -> where it was declared (for evidence). */
  dependencies: Map<string, string>
  /** module source -> files importing it. */
  imports: Map<string, string[]>
  /** true when at least one source file exists. */
  hasSourceFiles: boolean
  sourceTexts: Map<string, string>
}

const IMPORT_PATTERNS = [
  // import ... from '...'; export ... from '...'
  /(?:^|\s)(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]/gm,
  // import '...'
  /(?:^|\s)import\s*['"]([^'"]+)['"]/gm,
  // require('...')
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm,
  // dynamic import('...')
  /import\s*\(\s*['"]([^'"]+)['"]\s*\)/gm,
]

/** Runtime-builtin module namespaces; imports of these are never packages. */
const BUILTIN_NAMESPACES = /^(?:node|cloudflare|bun|deno|workerd):/

/**
 * Runtime-builtin modules importable without a namespace prefix: every Node
 * builtin under its bare name (`http`, `url`, ...) plus Bun's own module.
 */
const BUILTIN_BARE_MODULES = new Set([...builtinModules, 'bun'])

function packageNameOf(source: string): string | null {
  if (source.startsWith('.') || source.startsWith('/')) {
    return null
  }
  if (BUILTIN_NAMESPACES.test(source)) {
    return null
  }
  if (BUILTIN_BARE_MODULES.has(source)) {
    return null
  }
  // URL imports (old-style Deno): recognize well-known package CDNs.
  if (/^https?:\/\//.test(source)) {
    const cdn = source.match(
      /^https?:\/\/(?:deno\.land\/x|esm\.sh|cdn\.skypack\.dev|unpkg\.com)\/((?:@[^/@]+\/)?[^/@]+)/
    )
    return cdn?.[1] ?? null
  }
  // Deno-style package specifiers: npm:hono@4, jsr:@hono/hono.
  const bare = source.replace(/^(?:npm|jsr):/, '')
  const parts = bare.split('/')
  if (bare.startsWith('@')) {
    if (parts.length < 2 || !parts[1]) {
      return null
    }
    return `${parts[0]}/${parts[1].split('@')[0]}`
  }
  const name = parts[0]?.split('@')[0]
  return name ? name : null
}

async function scanWorkspace(root: string): Promise<WorkspaceScan> {
  const scan: WorkspaceScan = {
    dependencies: new Map(),
    imports: new Map(),
    hasSourceFiles: false,
    sourceTexts: new Map(),
  }

  const walk = async (dir: string): Promise<void> => {
    let entries: Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      const rel = relative(root, full)
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          await walk(full)
        }
        continue
      }
      if (entry.name === 'package.json') {
        try {
          const pkg = JSON.parse(await readFile(full, 'utf8')) as {
            dependencies?: Record<string, string>
            devDependencies?: Record<string, string>
          }
          for (const name of Object.keys({
            ...pkg.dependencies,
            ...pkg.devDependencies,
          })) {
            if (!scan.dependencies.has(name)) {
              scan.dependencies.set(name, rel)
            }
          }
        } catch {
          // Ignore malformed package.json files.
        }
        continue
      }
      if (SOURCE_EXTENSIONS.has(extname(entry.name))) {
        scan.hasSourceFiles = true
        try {
          const text = await readFile(full, 'utf8')
          scan.sourceTexts.set(rel, text)
          for (const pattern of IMPORT_PATTERNS) {
            pattern.lastIndex = 0
            for (const match of text.matchAll(pattern)) {
              const name = packageNameOf(match[1] ?? '')
              if (!name) {
                continue
              }
              const files = scan.imports.get(name) ?? []
              if (!files.includes(rel)) {
                files.push(rel)
              }
              scan.imports.set(name, files)
            }
          }
        } catch {
          // Ignore unreadable files.
        }
      }
    }
  }

  await walk(root)
  return scan
}

function isRawHandlerWorkspace(scan: WorkspaceScan): boolean {
  for (const text of scan.sourceTexts.values()) {
    if (/export\s+default\s*\{/.test(text) && /\bfetch\s*[(:]/.test(text)) {
      return true
    }
    if (/addEventListener\s*\(\s*['"]fetch['"]/.test(text)) {
      return true
    }
    if (/Bun\.serve\s*\(/.test(text)) {
      return true
    }
    if (/Deno\.serve\s*\(/.test(text)) {
      return true
    }
    if (/createServer\s*\(/.test(text)) {
      return true
    }
    // Old-style Deno std http server (`import { serve } from ".../std/http/server.ts"`).
    if (/deno\.land\/std[^'"]*\/http\/server\.ts/.test(text)) {
      return true
    }
  }
  return false
}

/**
 * Classify which framework a generated workspace uses.
 *
 * Priority:
 *   1. A known framework that is actually imported in source code.
 *   2. A known framework declared as a dependency.
 *   3. An unknown non-utility package that is imported ("other").
 *   4. A raw handler (fetch handler / server without any framework).
 */
export async function detectFramework(root: string): Promise<DetectionResult> {
  const scan = await scanWorkspace(root)

  const unknownPackages: string[] = []
  const knownPackageIds = new Set(KNOWN_FRAMEWORKS.flatMap((f) => f.packages))
  const isUtility = (name: string): boolean =>
    NON_FRAMEWORK_PACKAGES.has(name) || NON_FRAMEWORK_PREFIXES.some((p) => name.startsWith(p))

  for (const name of new Set([...scan.dependencies.keys(), ...scan.imports.keys()])) {
    if (!knownPackageIds.has(name) && !isUtility(name)) {
      unknownPackages.push(name)
    }
  }
  unknownPackages.sort()

  // 1 & 2: known frameworks, imported ones first, then by list order.
  let best: {
    framework: KnownFramework
    imported: boolean
    evidence: string[]
  } | null = null
  for (const framework of KNOWN_FRAMEWORKS) {
    const evidence: string[] = []
    let imported = false
    for (const pkg of framework.packages) {
      const importers = scan.imports.get(pkg)
      if (importers && importers.length > 0) {
        imported = true
        evidence.push(`imported "${pkg}" in ${importers.join(', ')}`)
      }
      const declaredIn = scan.dependencies.get(pkg)
      if (declaredIn) {
        evidence.push(`dependency "${pkg}" in ${declaredIn}`)
      }
    }
    if (evidence.length === 0) {
      continue
    }
    if (!best || (imported && !best.imported)) {
      best = { framework, imported, evidence }
    }
  }
  if (best) {
    return {
      framework: best.framework.id,
      evidence: best.evidence,
      unknownPackages,
    }
  }

  // 3: unknown packages that are imported look like a framework we don't know.
  const importedUnknown = unknownPackages.filter((name) => scan.imports.has(name))
  if (importedUnknown.length > 0) {
    return {
      framework: 'other',
      evidence: importedUnknown.map((name) => `imported unknown package "${name}"`),
      unknownPackages,
    }
  }

  // 4: raw handler.
  if (scan.hasSourceFiles && isRawHandlerWorkspace(scan)) {
    return {
      framework: 'raw-handler',
      evidence: ['no framework dependency; found a raw fetch/server handler'],
      unknownPackages,
    }
  }

  return {
    framework: 'other',
    evidence: scan.hasSourceFiles
      ? ['no framework or handler pattern detected']
      : ['no source files were generated'],
    unknownPackages,
  }
}
