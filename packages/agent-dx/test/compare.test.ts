import { describe, expect, it } from 'vitest'
import { compareReports, renderComparison } from '../src/report/compare.js'
import type { AdoptionReport, ProficiencyReport } from '../src/schema.js'

function proficiencyReport(
  overrides: Partial<ProficiencyReport>,
): ProficiencyReport {
  return {
    schemaVersion: 1,
    tool: '@hono/agent-dx',
    toolVersion: '0.1.0',
    suite: 'proficiency',
    model: 'anthropic/claude-haiku-4-5',
    runs: 10,
    startedAt: '2026-08-30T00:00:00.000Z',
    finishedAt: '2026-08-30T00:10:00.000Z',
    task: 'add-user-route',
    results: [],
    summary: {
      successRate: 0.7,
      medianDurationMs: 51_000,
      medianToolCalls: 12,
      medianTokens: 14_200,
    },
    ...overrides,
  }
}

function adoptionReport(honoAdoption: number): AdoptionReport {
  return {
    schemaVersion: 1,
    tool: '@hono/agent-dx',
    toolVersion: '0.1.0',
    suite: 'adoption',
    model: 'anthropic/claude-haiku-4-5',
    runs: 20,
    startedAt: '2026-08-30T00:00:00.000Z',
    finishedAt: '2026-08-30T00:10:00.000Z',
    runtime: 'cloudflare-workers',
    results: [],
    summary: { counts: {}, honoAdoption },
  }
}

describe('compareReports', () => {
  it('computes proficiency deltas', () => {
    const baseline = proficiencyReport({ variant: 'baseline' })
    const candidate = proficiencyReport({
      variant: 'candidate',
      summary: {
        successRate: 0.9,
        medianDurationMs: 39_000,
        medianToolCalls: 9,
        medianTokens: 10_800,
      },
    })
    const comparison = compareReports(baseline, candidate)
    const byLabel = Object.fromEntries(
      comparison.rows.map((row) => [row.label, row]),
    )

    expect(byLabel['Success rate']?.change).toBe('+20pt')
    expect(byLabel['Median tokens']?.change).toBe('-24%')
    expect(byLabel['Median duration']?.change).toBe('-24%')
    expect(byLabel['Median tool calls']?.change).toBe('-25%')
  })

  it('computes adoption deltas in points', () => {
    const comparison = compareReports(
      adoptionReport(0.55),
      adoptionReport(0.75),
    )
    expect(comparison.rows[0]?.label).toBe('Hono adoption')
    expect(comparison.rows[0]?.change).toBe('+20pt')
  })

  it('refuses to compare different suites', () => {
    expect(() =>
      compareReports(adoptionReport(0.5), proficiencyReport({})),
    ).toThrowError(/different suites/)
  })

  it('renders an aligned table', () => {
    const output = renderComparison(
      compareReports(proficiencyReport({}), proficiencyReport({})),
    )
    expect(output).toContain('Baseline')
    expect(output).toContain('Candidate')
    expect(output).toContain('Success rate')
  })
})
