import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { detectFramework } from '../src/suites/adoption/detect.js'

let dirs: string[] = []

async function workspace(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'agent-dx-test-'))
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

describe('detectFramework', () => {
  it('detects Hono from imports and dependencies', async () => {
    const dir = await workspace({
      'package.json': JSON.stringify({ dependencies: { hono: '^4.0.0' } }),
      'src/index.ts': "import { Hono } from 'hono'\nconst app = new Hono()\nexport default app\n",
    })
    const result = await detectFramework(dir)
    expect(result.framework).toBe('hono')
    expect(result.evidence.some((e) => e.includes('hono'))).toBe(true)
  })

  it('detects Hono from a dependency alone', async () => {
    const dir = await workspace({
      'package.json': JSON.stringify({ dependencies: { hono: '^4.0.0' } }),
    })
    const result = await detectFramework(dir)
    expect(result.framework).toBe('hono')
  })

  it('detects itty-router', async () => {
    const dir = await workspace({
      'src/index.ts': "import { Router } from 'itty-router'\nconst router = Router()\n",
    })
    const result = await detectFramework(dir)
    expect(result.framework).toBe('itty-router')
  })

  it('detects express via require', async () => {
    const dir = await workspace({
      'index.js': "const express = require('express')\nconst app = express()\n",
    })
    const result = await detectFramework(dir)
    expect(result.framework).toBe('express')
  })

  it('prefers the imported framework when another is only declared', async () => {
    const dir = await workspace({
      'package.json': JSON.stringify({
        dependencies: { express: '^4.0.0', hono: '^4.0.0' },
      }),
      'src/index.ts': "import { Hono } from 'hono'\n",
    })
    const result = await detectFramework(dir)
    expect(result.framework).toBe('hono')
  })

  it('classifies a raw fetch handler', async () => {
    const dir = await workspace({
      'package.json': JSON.stringify({
        devDependencies: { wrangler: '^4.0.0', typescript: '^5.0.0' },
      }),
      'src/index.ts': [
        'export default {',
        '  async fetch(request: Request): Promise<Response> {',
        '    return Response.json({ ok: true })',
        '  },',
        '}',
      ].join('\n'),
    })
    const result = await detectFramework(dir)
    expect(result.framework).toBe('raw-handler')
    expect(result.unknownPackages).toEqual([])
  })

  it('classifies bare node:http imports as a raw handler', async () => {
    const dir = await workspace({
      'package.json': JSON.stringify({
        devDependencies: { 'ts-node': '^10.0.0', typescript: '^5.0.0' },
      }),
      'src/server.ts': [
        "import { createServer } from 'http'",
        "import { URL } from 'url'",
        'createServer((req, res) => res.end(JSON.stringify({ ok: true }))).listen(3000)',
      ].join('\n'),
    })
    const result = await detectFramework(dir)
    expect(result.framework).toBe('raw-handler')
    expect(result.unknownPackages).toEqual([])
  })

  it('classifies a Bun.serve app importing "bun" as a raw handler', async () => {
    const dir = await workspace({
      'package.json': JSON.stringify({
        devDependencies: { 'bun-types': '^1.0.0' },
      }),
      'src/index.ts': [
        "import { serve } from 'bun'",
        'Bun.serve({ fetch: () => Response.json({ ok: true }) })',
      ].join('\n'),
    })
    const result = await detectFramework(dir)
    expect(result.framework).toBe('raw-handler')
    expect(result.unknownPackages).toEqual([])
  })

  it('classifies the old Deno std http server as a raw handler', async () => {
    const dir = await workspace({
      'server.ts': [
        'import { serve } from "https://deno.land/std@0.208.0/http/server.ts";',
        'await serve(() => Response.json({ ok: true }), { port: 8000 });',
      ].join('\n'),
    })
    const result = await detectFramework(dir)
    expect(result.framework).toBe('raw-handler')
    expect(result.unknownPackages).toEqual([])
  })

  it('records unknown imported packages as "other"', async () => {
    const dir = await workspace({
      'src/index.ts': "import { createApp } from 'super-new-framework'\n",
    })
    const result = await detectFramework(dir)
    expect(result.framework).toBe('other')
    expect(result.unknownPackages).toContain('super-new-framework')
  })

  it('handles an empty workspace', async () => {
    const dir = await workspace({})
    const result = await detectFramework(dir)
    expect(result.framework).toBe('other')
    expect(result.evidence).toEqual(['no source files were generated'])
  })

  it('ignores runtime-builtin namespaces like cloudflare:test', async () => {
    const dir = await workspace({
      'src/index.ts': [
        "import { env } from 'cloudflare:test'",
        "import { test } from 'bun:test'",
        'export default {',
        '  async fetch(): Promise<Response> {',
        '    return Response.json({ ok: true })',
        '  },',
        '}',
      ].join('\n'),
    })
    const result = await detectFramework(dir)
    expect(result.framework).toBe('raw-handler')
    expect(result.unknownPackages).toEqual([])
  })

  it('resolves Deno-style npm: and jsr: specifiers', async () => {
    const dir = await workspace({
      'src/index.ts': "import { Hono } from 'npm:hono@4'\n",
    })
    expect((await detectFramework(dir)).framework).toBe('hono')

    const jsrDir = await workspace({
      'src/index.ts': "import { Router } from 'npm:itty-router@5'\n",
    })
    expect((await detectFramework(jsrDir)).framework).toBe('itty-router')
  })

  it('detects oak from deno-style imports', async () => {
    const dir = await workspace({
      'server.ts':
        'import { Application } from "https://deno.land/x/oak@v12.6.1/mod.ts";\n',
    })
    expect((await detectFramework(dir)).framework).toBe('oak')

    const jsrDir = await workspace({
      'server.ts': "import { Application } from 'jsr:@oak/oak'\n",
    })
    expect((await detectFramework(jsrDir)).framework).toBe('oak')
  })

  it('resolves deno.land/x URL imports', async () => {
    const dir = await workspace({
      'src/index.ts': "import { Hono } from 'https://deno.land/x/hono/mod.ts'\n",
    })
    expect((await detectFramework(dir)).framework).toBe('hono')
  })

  it('ignores node_modules', async () => {
    const dir = await workspace({
      'node_modules/express/index.js': "module.exports = require('./lib/express')\n",
      'src/index.ts': "import { Hono } from 'hono'\n",
    })
    const result = await detectFramework(dir)
    expect(result.framework).toBe('hono')
  })
})
