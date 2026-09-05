/**
 * Render the site to static HTML in dist-ssg/, ready to deploy as a
 * Workers assets-only site (wrangler.deploy.jsonc). Reads every report
 * from the results bucket via the R2 REST API.
 *
 * Needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_R2_TOKEN.
 */
import { cpSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parseReport } from '@hono/agent-dx/schema'
import { toSSG } from 'hono/ssg'
import { createSite } from '../src/site.js'

const account = process.env.CLOUDFLARE_ACCOUNT_ID
const token = process.env.CLOUDFLARE_R2_TOKEN
if (!account || !token) {
  console.error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_R2_TOKEN are required.')
  process.exit(1)
}

const BUCKET = 'agent-dx-results'
const API = `https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/${BUCKET}/objects`
const HEADERS = { Authorization: `Bearer ${token}` }
const OUT = join(import.meta.dirname, '..', 'dist-ssg')

async function listKeys(): Promise<string[]> {
  const keys: string[] = []
  let cursor: string | undefined
  do {
    const url = new URL(API)
    url.searchParams.set('per_page', '1000')
    if (cursor) url.searchParams.set('cursor', cursor)
    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) throw new Error(`list failed: ${res.status}`)
    const body = (await res.json()) as {
      result: { key: string }[]
      result_info?: { cursor?: string; is_truncated?: boolean }
    }
    keys.push(...body.result.map((object) => object.key))
    cursor = body.result_info?.is_truncated
      ? body.result_info.cursor
      : undefined
  } while (cursor)
  return keys
}

const reportKeys = (await listKeys()).filter((key) => key.endsWith('.json'))
console.error(`loading ${reportKeys.length} reports`)

const reports = []
for (const key of reportKeys) {
  const res = await fetch(`${API}/${encodeURIComponent(key)}`, {
    headers: HEADERS,
  })
  if (!res.ok) {
    console.error(`skip ${key}: ${res.status}`)
    continue
  }
  try {
    const report = parseReport(await res.json())
    if (report) reports.push(report)
  } catch {
    console.error(`skip ${key}: not a report`)
  }
}
reports.sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))
console.error(`rendering site from ${reports.length} reports`)

await toSSG(
  createSite(reports),
  {
    writeFile: async (
      path: string,
      data: string | ArrayBuffer | Uint8Array,
    ) => {
      const file = join(OUT, path.replace(/^\.?\//, ''))
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, typeof data === 'string' ? data : Buffer.from(data))
      console.error(`rendered ${file}`)
    },
    mkdir: async () => {},
  },
  { dir: '' },
)
cpSync(join(import.meta.dirname, '..', 'public'), OUT, { recursive: true })
console.error('static site ready in dist-ssg/')
