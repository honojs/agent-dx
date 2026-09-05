import { type AgentDxReport, parseReport } from '@hono/agent-dx/schema'

/**
 * Load every report from the results R2 bucket.
 * The same JSON files are produced by the CLI (`--report`) and uploaded
 * by the eval workflow, so the website renders exactly what an eval
 * produced. Reports are returned newest first.
 */
export async function loadReports(bucket: R2Bucket): Promise<AgentDxReport[]> {
  const reports: AgentDxReport[] = []
  let cursor: string | undefined
  do {
    const page = await bucket.list({ cursor })
    for (const object of page.objects) {
      if (!object.key.endsWith('.json')) {
        continue
      }
      const body = await bucket.get(object.key)
      if (!body) {
        continue
      }
      try {
        const report = parseReport(await body.json())
        if (report) {
          reports.push(report)
        }
      } catch {
        // Skip objects that are not valid JSON reports.
      }
    }
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
  return reports.sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))
}
