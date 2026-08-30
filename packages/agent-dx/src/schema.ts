/**
 * Shared result schema.
 *
 * The CLI writes reports in this shape, CI stores them under `results/`,
 * and the web app reads them back. Keep this file dependency-free so it
 * can be imported from any context.
 */

export const SCHEMA_VERSION = 1

export type SuiteName = 'adoption' | 'proficiency'

/** What an experiment evaluates. Only the type is defined in v0. */
export type TargetName = 'cli' | 'skill' | 'docs' | 'hono'

/** Canonical framework identifiers for adoption classification. */
export type FrameworkId =
  | 'hono'
  | 'raw-handler'
  | 'elysia'
  | 'h3'
  | 'express'
  | 'fastify'
  | 'itty-router'
  | 'other'
  | 'failed'

export interface TokenUsage {
  input: number
  output: number
  total: number
}

export interface RunMetrics {
  durationMs: number
  toolCalls: number
  /** Tool name -> number of invocations. */
  toolCallCounts: Record<string, number>
  /** Present only when the runner could observe token usage. */
  tokens?: TokenUsage
}

export interface AdoptionRun {
  index: number
  outcome: 'completed' | 'failed'
  framework: FrameworkId
  /** Human-readable hints for why the run was classified this way. */
  evidence: string[]
  /** Non-framework packages we could not classify, kept for later triage. */
  unknownPackages: string[]
  metrics: RunMetrics
  error?: string
}

export interface ProficiencyCheck {
  name: string
  passed: boolean
  detail?: string
}

export interface ProficiencyRun {
  index: number
  outcome: 'completed' | 'failed'
  success: boolean
  checks: ProficiencyCheck[]
  metrics: RunMetrics
  error?: string
}

interface ReportBase {
  schemaVersion: typeof SCHEMA_VERSION
  tool: '@hono/agent-dx'
  toolVersion: string
  suite: SuiteName
  model: string
  runs: number
  startedAt: string
  finishedAt: string
  /** Label for experiment comparison, e.g. "baseline" or "candidate". */
  variant?: string
  /** What the experiment evaluates, when part of an experiment. */
  target?: TargetName
}

export interface AdoptionSummary {
  /** FrameworkId -> run count. */
  counts: Record<string, number>
  /** Hono runs / total runs, in [0, 1]. */
  honoAdoption: number
}

export interface AdoptionReport extends ReportBase {
  suite: 'adoption'
  runtime: string
  results: AdoptionRun[]
  summary: AdoptionSummary
}

export interface ProficiencySummary {
  /** Successful runs / total runs, in [0, 1]. */
  successRate: number
  medianDurationMs: number
  medianToolCalls: number
  medianTokens?: number
}

export interface ProficiencyReport extends ReportBase {
  suite: 'proficiency'
  task: string
  results: ProficiencyRun[]
  summary: ProficiencySummary
}

export type AgentDxReport = AdoptionReport | ProficiencyReport

export function isAdoptionReport(
  report: AgentDxReport,
): report is AdoptionReport {
  return report.suite === 'adoption'
}

export function isProficiencyReport(
  report: AgentDxReport,
): report is ProficiencyReport {
  return report.suite === 'proficiency'
}

/** Best-effort validation for JSON loaded from disk. */
export function parseReport(json: unknown): AgentDxReport | null {
  if (typeof json !== 'object' || json === null) return null
  const report = json as Record<string, unknown>
  if (report.schemaVersion !== SCHEMA_VERSION) return null
  if (report.tool !== '@hono/agent-dx') return null
  if (report.suite !== 'adoption' && report.suite !== 'proficiency') return null
  if (!Array.isArray(report.results)) return null
  return json as AgentDxReport
}
