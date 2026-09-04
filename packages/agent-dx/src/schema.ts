/**
 * Shared result schema.
 *
 * The CLI writes reports in this shape, CI stores them under `results/`,
 * and the web app reads them back. Keep this file dependency-free so it
 * can be imported from any context.
 */

export const SCHEMA_VERSION = 2

export type SuiteName = 'adoption' | 'practical'

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
  /** Hono CLI usage observed in bash tool calls. */
  honoCli?: HonoCliUsage
  /**
   * Bash commands the agent executed, in order (each entry truncated, list
   * capped). The last entry of a timed-out run is usually the command that
   * hung — kept for exactly that kind of diagnosis.
   */
  commands?: string[]
}

export interface HonoCliUsage {
  /** Number of bash tool calls invoking the Hono CLI. */
  calls: number
  /** Whether `hono agent-context` was invoked (the designed entry point). */
  agentContext: boolean
  /** Subcommand -> invocation count (`request --trace` counted separately). */
  commands: Record<string, number>
  /** CLI error envelopes (`"ok": false`) received back. */
  errors: number
  /** Whether the run kept using the CLI after receiving an error envelope. */
  recovered: boolean
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
  /** Where the generated workspace was kept, when the run kept it. */
  workspace?: string
}

export interface PracticalCheck {
  name: string
  passed: boolean
  detail?: string
}

export interface PracticalRun {
  index: number
  outcome: 'completed' | 'failed'
  success: boolean
  checks: PracticalCheck[]
  metrics: RunMetrics
  error?: string
  /** Where the modified workspace was kept, when the run kept it. */
  workspace?: string
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
  /** Which scenario was measured, e.g. "minimal" | "api" | "framework". */
  scenario?: string
  /** The exact prompt the agent received; prompts may evolve, so results are only comparable when this matches. */
  prompt?: string
  results: AdoptionRun[]
  summary: AdoptionSummary
}

export interface PracticalSummary {
  /** Successful runs / total runs, in [0, 1]. */
  successRate: number
  medianDurationMs: number
  medianToolCalls: number
  medianTokens?: number
  /** Hono CLI usage across runs. */
  honoCli?: {
    medianCalls: number
    /** Runs that invoked the CLI at all / total runs, in [0, 1]. */
    usageRate: number
    /** Runs that invoked `hono agent-context` / total runs, in [0, 1]. */
    agentContextRate: number
    /** Subcommand -> total invocations across runs. */
    commands: Record<string, number>
    /** Runs that received at least one CLI error envelope. */
    errorRuns: number
    /** Of those, runs that kept using the CLI afterwards. */
    recoveredRuns: number
  }
}

export interface PracticalReport extends ReportBase {
  suite: 'practical'
  task: string
  /** Content hash of the pristine fixture; a changed fixture changes the task, so results are only comparable when this matches. */
  fixtureHash?: string
  /** npm spec of the Hono CLI injected into the fixture, when one was. */
  honoCli?: string
  /** Exact version the spec resolved to at run time (specs like "@next" move). */
  honoCliVersion?: string
  /** Name of the skill injected into the fixture, when one was. */
  skill?: string
  /** Content hash of the injected skill directory (skills evolve too). */
  skillHash?: string
  results: PracticalRun[]
  summary: PracticalSummary
}

export type AgentDxReport = AdoptionReport | PracticalReport

export function isAdoptionReport(
  report: AgentDxReport,
): report is AdoptionReport {
  return report.suite === 'adoption'
}

export function isPracticalReport(
  report: AgentDxReport,
): report is PracticalReport {
  return report.suite === 'practical'
}

/** Best-effort validation for JSON loaded from disk. */
export function parseReport(json: unknown): AgentDxReport | null {
  if (typeof json !== 'object' || json === null) return null
  const report = json as Record<string, unknown>
  if (report.schemaVersion !== SCHEMA_VERSION) return null
  if (report.tool !== '@hono/agent-dx') return null
  if (report.suite !== 'adoption' && report.suite !== 'practical') return null
  if (!Array.isArray(report.results)) return null
  return json as AgentDxReport
}
