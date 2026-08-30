import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { type AgentDxReport, parseReport } from '@hono/agent-dx'

/**
 * Load every report from the repository's `results/` directory.
 * The same JSON files are written by the CLI and stored by CI, so the
 * website always renders exactly what the eval produced.
 */

const DEFAULT_RESULTS_DIR = fileURLToPath(
  new URL('../../../results', import.meta.url),
)

export async function loadReports(
  dir = process.env.RESULTS_DIR ?? DEFAULT_RESULTS_DIR,
): Promise<AgentDxReport[]> {
  let files: string[]
  try {
    files = await readdir(dir)
  } catch {
    return []
  }
  const reports: AgentDxReport[] = []
  for (const file of files.filter((f) => f.endsWith('.json')).sort()) {
    try {
      const report = parseReport(
        JSON.parse(await readFile(`${dir}/${file}`, 'utf8')),
      )
      if (report) reports.push(report)
    } catch {
      // Skip unreadable or invalid files.
    }
  }
  // Newest first.
  return reports.sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))
}
