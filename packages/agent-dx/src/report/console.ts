import type { AdoptionReport, AgentDxReport, FrameworkId, PracticalReport } from '../schema.js'
import { formatDuration, formatTokens, percent } from '../stats.js'

const FRAMEWORK_LABELS: Record<FrameworkId, string> = {
  hono: 'Hono',
  'raw-handler': 'Raw handler',
  elysia: 'Elysia',
  h3: 'H3',
  express: 'Express',
  oak: 'Oak',
  fastify: 'Fastify',
  'itty-router': 'itty-router',
  other: 'Other',
  failed: 'Failed',
}

export function frameworkLabel(id: string): string {
  return FRAMEWORK_LABELS[id as FrameworkId] ?? id
}

function table(rows: string[][]): string {
  const widths: number[] = []
  for (const row of rows) {
    row.forEach((cell, i) => {
      widths[i] = Math.max(widths[i] ?? 0, cell.length)
    })
  }
  return rows
    .map((row) =>
      row
        .map((cell, i) => (i === 0 ? cell.padEnd(widths[i] ?? 0) : cell.padStart(widths[i] ?? 0)))
        .join('  ')
        .trimEnd()
    )
    .join('\n')
}

export function renderAdoptionReport(report: AdoptionReport): string {
  const lines: string[] = []
  lines.push('Hono Agent DX')
  lines.push('')
  lines.push(`Suite: adoption`)
  lines.push(`Runtime: ${report.runtime}`)
  if (report.scenario) {
    lines.push(`Scenario: ${report.scenario}`)
  }
  lines.push(`Model: ${report.model}`)
  lines.push(`Runs: ${report.runs}`)
  if (report.variant) {
    lines.push(`Variant: ${report.variant}`)
  }
  lines.push('')

  const entries = Object.entries(report.summary.counts).sort((a, b) => b[1] - a[1])
  const rows = entries.map(([framework, count]) => [
    frameworkLabel(framework),
    percent(count / report.runs),
    `${count}/${report.runs}`,
  ])
  lines.push(table(rows))
  lines.push('')
  lines.push(`Hono adoption: ${percent(report.summary.honoAdoption)}`)

  const unknown = new Set(report.results.flatMap((run) => run.unknownPackages))
  if (unknown.size > 0) {
    lines.push('')
    lines.push(`Unclassified packages seen: ${[...unknown].sort().join(', ')}`)
  }
  return lines.join('\n')
}

export function renderPracticalReport(report: PracticalReport): string {
  const lines: string[] = []
  lines.push('Hono Agent DX')
  lines.push('')
  lines.push(`Suite: practical`)
  lines.push(`Task: ${report.task}`)
  lines.push(`Model: ${report.model}`)
  lines.push(`Runs: ${report.runs}`)
  if (report.variant) {
    lines.push(`Variant: ${report.variant}`)
  }
  lines.push('')

  const rows: string[][] = [
    ['Success rate', percent(report.summary.successRate)],
    ['Median duration', formatDuration(report.summary.medianDurationMs)],
    ['Median tool calls', String(report.summary.medianToolCalls)],
  ]
  if (report.summary.medianTokens !== undefined) {
    rows.push(['Median tokens', formatTokens(report.summary.medianTokens)])
  }
  if (report.honoCli || (report.summary.honoCli?.usageRate ?? 0) > 0) {
    const cli = report.summary.honoCli
    rows.push(['Hono CLI usage rate', percent(cli?.usageRate ?? 0)])
    rows.push(['Median Hono CLI calls', String(cli?.medianCalls ?? 0)])
    rows.push(['agent-context rate', percent(cli?.agentContextRate ?? 0)])
  }
  lines.push(table(rows))

  const failed = report.results.filter((run) => !run.success)
  if (failed.length > 0) {
    lines.push('')
    lines.push('Failed runs:')
    for (const run of failed) {
      const reasons =
        run.outcome === 'failed'
          ? [run.error ?? 'agent run failed']
          : run.checks.filter((check) => !check.passed).map((check) => check.name)
      lines.push(`  #${run.index}: ${reasons.join('; ')}`)
    }
  }
  return lines.join('\n')
}

export function renderReport(report: AgentDxReport): string {
  return report.suite === 'adoption' ? renderAdoptionReport(report) : renderPracticalReport(report)
}
