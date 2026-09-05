/**
 * Render the site to static HTML in dist-ssg/, ready to deploy as a
 * Workers assets-only site (wrangler.deploy.jsonc). The script runs on
 * Node, so it reaches R2 through the same binding the app uses, pointed
 * at the remote bucket by getPlatformProxy.
 */
import { cpSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { toSSG } from 'hono/ssg'
import { getPlatformProxy } from 'wrangler'
import { loadReports } from '../src/reports.js'
import { createSite } from '../src/site.js'

const root = join(import.meta.dirname, '..')
const out = join(root, 'dist-ssg')

const proxy = await getPlatformProxy<{ RESULTS: R2Bucket }>({
  configPath: join(root, 'wrangler.ssg.jsonc'),
  remoteBindings: true,
})
const reports = await loadReports(proxy.env.RESULTS)
console.error(`rendering site from ${reports.length} reports`)

await toSSG(
  createSite(reports),
  {
    writeFile: async (path, data) => {
      const file = join(out, path.replace(/^\.?\//, ''))
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, typeof data === 'string' ? data : Buffer.from(data))
      console.error(`rendered ${file}`)
    },
    mkdir: async () => {},
  },
  { dir: '' }
)
cpSync(join(root, 'public'), out, { recursive: true })
await proxy.dispose()
console.error('static site ready in dist-ssg/')
