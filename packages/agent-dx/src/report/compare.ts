import type { AgentDxReport } from '../schema.js'
import { formatDuration, formatTokens, percent } from '../stats.js'

/**
 * Experiment comparison: turn two reports (baseline vs candidate) into a
 * metric table. This is the core of the experiment workflow — run the
 * same suite against two variants of a target (CLI, Skill, Docs, Hono
 * core), then diff the summaries.
 */

export interface ComparisonRow {
  label: string
  baseline: string
  candidate: string
  change: string
}

export interface ExperimentComparison {
  suite: string
  /** e.g. runtime for adoption, task for practical. */
  subject: string
  baselineVariant: string
  candidateVariant: string
  model: string
  rows: ComparisonRow[]
}

function pointDelta(baseline: number, candidate: number): string {
  const delta = Math.round((candidate - baseline) * 100)
  return `${delta >= 0 ? '+' : ''}${delta}pt`
}

function relativeDelta(baseline: number, candidate: number): string {
  if (baseline === 0) {
    return candidate === 0 ? '0%' : 'n/a'
  }
  const delta = Math.round(((candidate - baseline) / baseline) * 100)
  return `${delta >= 0 ? '+' : ''}${delta}%`
}

export function compareReports(
  baseline: AgentDxReport,
  candidate: AgentDxReport
): ExperimentComparison {
  if (baseline.suite !== candidate.suite) {
    throw new Error(`Cannot compare different suites: "${baseline.suite}" vs "${candidate.suite}"`)
  }
  // Refuse comparisons across different measurements: a changed task,
  // fixture revision, runtime, scenario, or prompt is a different
  // experiment, and mixing them silently would produce plausible-looking
  // nonsense.
  if (baseline.suite === 'practical' && candidate.suite === 'practical') {
    if (baseline.task !== candidate.task) {
      throw new Error(`Cannot compare different tasks: "${baseline.task}" vs "${candidate.task}"`)
    }
    if (
      baseline.fixtureHash &&
      candidate.fixtureHash &&
      baseline.fixtureHash !== candidate.fixtureHash
    ) {
      throw new Error(
        `Cannot compare across fixture revisions: the "${baseline.task}" fixture changed between runs (${baseline.fixtureHash} vs ${candidate.fixtureHash})`
      )
    }
  }
  if (baseline.suite === 'adoption' && candidate.suite === 'adoption') {
    if (baseline.runtime !== candidate.runtime) {
      throw new Error(
        `Cannot compare different runtimes: "${baseline.runtime}" vs "${candidate.runtime}"`
      )
    }
    if (baseline.prompt && candidate.prompt && baseline.prompt !== candidate.prompt) {
      throw new Error(
        'Cannot compare across prompt revisions: the adoption prompt changed between runs'
      )
    }
  }

  const rows: ComparisonRow[] = []

  if (baseline.suite === 'adoption' && candidate.suite === 'adoption') {
    rows.push({
      label: 'Hono adoption',
      baseline: percent(baseline.summary.honoAdoption),
      candidate: percent(candidate.summary.honoAdoption),
      change: pointDelta(baseline.summary.honoAdoption, candidate.summary.honoAdoption),
    })
  }

  if (baseline.suite === 'practical' && candidate.suite === 'practical') {
    rows.push({
      label: 'Success rate',
      baseline: percent(baseline.summary.successRate),
      candidate: percent(candidate.summary.successRate),
      change: pointDelta(baseline.summary.successRate, candidate.summary.successRate),
    })
    if (
      baseline.summary.medianTokens !== undefined &&
      candidate.summary.medianTokens !== undefined
    ) {
      rows.push({
        label: 'Median tokens',
        baseline: formatTokens(baseline.summary.medianTokens),
        candidate: formatTokens(candidate.summary.medianTokens),
        change: relativeDelta(baseline.summary.medianTokens, candidate.summary.medianTokens),
      })
    }
    rows.push({
      label: 'Median duration',
      baseline: formatDuration(baseline.summary.medianDurationMs),
      candidate: formatDuration(candidate.summary.medianDurationMs),
      change: relativeDelta(baseline.summary.medianDurationMs, candidate.summary.medianDurationMs),
    })
    rows.push({
      label: 'Median tool calls',
      baseline: String(baseline.summary.medianToolCalls),
      candidate: String(candidate.summary.medianToolCalls),
      change: relativeDelta(baseline.summary.medianToolCalls, candidate.summary.medianToolCalls),
    })
    const baseCli = baseline.summary.honoCli
    const candCli = candidate.summary.honoCli
    if (baseCli && candCli && (baseCli.usageRate || candCli.usageRate)) {
      rows.push({
        label: 'Hono CLI usage rate',
        baseline: percent(baseCli.usageRate),
        candidate: percent(candCli.usageRate),
        change: pointDelta(baseCli.usageRate, candCli.usageRate),
      })
      rows.push({
        label: 'Median Hono CLI calls',
        baseline: String(baseCli.medianCalls),
        candidate: String(candCli.medianCalls),
        change: relativeDelta(baseCli.medianCalls, candCli.medianCalls),
      })
      rows.push({
        label: 'agent-context rate',
        baseline: percent(baseCli.agentContextRate),
        candidate: percent(candCli.agentContextRate),
        change: pointDelta(baseCli.agentContextRate, candCli.agentContextRate),
      })
    }
  }

  return {
    suite: baseline.suite,
    subject: baseline.suite === 'adoption' ? baseline.runtime : baseline.task,
    baselineVariant: baseline.variant ?? 'baseline',
    candidateVariant: candidate.variant ?? 'candidate',
    model:
      baseline.model === candidate.model
        ? baseline.model
        : `${baseline.model} vs ${candidate.model}`,
    rows,
  }
}

export function renderComparison(comparison: ExperimentComparison): string {
  const lines: string[] = []
  lines.push('Hono Agent DX')
  lines.push('')
  lines.push(`Suite: ${comparison.suite} (${comparison.subject})`)
  lines.push(`Model: ${comparison.model}`)
  lines.push('')

  const header = ['', 'Baseline', 'Candidate', 'Change']
  const rows = [
    header,
    ...comparison.rows.map((row) => [row.label, row.baseline, row.candidate, row.change]),
  ]
  const widths: number[] = []
  for (const row of rows) {
    row.forEach((cell, i) => {
      widths[i] = Math.max(widths[i] ?? 0, cell.length)
    })
  }
  for (const row of rows) {
    lines.push(
      row
        .map((cell, i) => (i === 0 ? cell.padEnd(widths[i] ?? 0) : cell.padStart(widths[i] ?? 0)))
        .join('   ')
        .trimEnd()
    )
  }
  return lines.join('\n')
}
