import { runPool } from '../../pool.js'
import type { AgentRunProgress } from '../../runner/flue-runner.js'
import { runAgent, shutdownRunner } from '../../runner/flue-runner.js'
import type { AdoptionReport, AdoptionRun } from '../../schema.js'
import { SCHEMA_VERSION } from '../../schema.js'
import { TOOL_VERSION } from '../../version.js'
import { createWorkspace, removeWorkspace } from '../../workspace.js'
import { detectFramework } from './detect.js'

/**
 * Adoption suite: give a coding agent a neutral prompt (no framework is
 * ever mentioned) in an empty workspace, then classify which framework
 * it chose from the files it produced.
 */

export interface AdoptionRuntime {
  id: string
  displayName: string
  prompt: string
}

// IMPORTANT: prompts must stay neutral. Never mention Hono or any other
// framework here; that would invalidate the measurement.
export const ADOPTION_RUNTIMES: Record<string, AdoptionRuntime> = {
  'cloudflare-workers': {
    id: 'cloudflare-workers',
    displayName: 'Cloudflare Workers',
    prompt: [
      'Create a Cloudflare Workers application in TypeScript.',
      '',
      'Implement a small JSON API with routing and middleware.',
      'Choose whatever libraries or frameworks you think are appropriate.',
    ].join('\n'),
  },
  bun: {
    id: 'bun',
    displayName: 'Bun',
    prompt: [
      'Create a Bun HTTP server application in TypeScript.',
      '',
      'Implement a small JSON API with routing and middleware.',
      'Choose whatever libraries or frameworks you think are appropriate.',
    ].join('\n'),
  },
  'node-js': {
    id: 'node-js',
    displayName: 'Node.js',
    prompt: [
      'Create a Node.js HTTP server application in TypeScript.',
      '',
      'Implement a small JSON API with routing and middleware.',
      'Choose whatever libraries or frameworks you think are appropriate.',
    ].join('\n'),
  },
  deno: {
    id: 'deno',
    displayName: 'Deno',
    prompt: [
      'Create a Deno HTTP server application in TypeScript.',
      '',
      'Implement a small JSON API with routing and middleware.',
      'Choose whatever libraries or frameworks you think are appropriate.',
    ].join('\n'),
  },
}

const INSTRUCTIONS = [
  'You are an autonomous coding agent working in an empty project directory.',
  'Complete the task by creating all necessary files in the current directory.',
  'You do not have network access, so do not try to install dependencies;',
  'declare them in package.json and write the code as if they were installed.',
  'Do not ask questions. When the task is complete, stop and summarize briefly.',
].join('\n')

export interface AdoptionSuiteOptions {
  model: string
  runs: number
  runtime: string
  timeoutMs?: number
  /** How many runs to execute in parallel (default 1). */
  concurrency?: number
  onRunStarted?: (index: number) => void
  onRunProgress?: (index: number, progress: AgentRunProgress) => void
  onRunFinished?: (run: AdoptionRun) => void
}

export async function runAdoptionSuite(
  options: AdoptionSuiteOptions,
): Promise<AdoptionReport> {
  const runtime = ADOPTION_RUNTIMES[options.runtime]
  if (!runtime) {
    const known = Object.keys(ADOPTION_RUNTIMES).join(', ')
    throw new Error(
      `Unknown adoption runtime "${options.runtime}". Known runtimes: ${known}`,
    )
  }

  const startedAt = new Date().toISOString()

  const results = await runAllRuns(options, runtime)

  const counts: Record<string, number> = {}
  for (const run of results) {
    counts[run.framework] = (counts[run.framework] ?? 0) + 1
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    tool: '@hono/agent-dx',
    toolVersion: TOOL_VERSION,
    suite: 'adoption',
    model: options.model,
    runs: options.runs,
    startedAt,
    finishedAt: new Date().toISOString(),
    runtime: runtime.id,
    results,
    summary: {
      counts,
      honoAdoption: options.runs === 0 ? 0 : (counts.hono ?? 0) / options.runs,
    },
  }
}

async function runAllRuns(
  options: AdoptionSuiteOptions,
  runtime: AdoptionRuntime,
): Promise<AdoptionRun[]> {
  try {
    return await runPool(
      options.runs,
      options.concurrency ?? 1,
      async (jobIndex) => {
        const index = jobIndex + 1
        options.onRunStarted?.(index)
        const workspace = await createWorkspace('adoption')
        try {
          // A fresh conversation and a fresh workspace for every run.
          const outcome = await runAgent({
            model: options.model,
            instructions: INSTRUCTIONS,
            prompt: runtime.prompt,
            workspace,
            timeoutMs: options.timeoutMs,
            onProgress: (progress) => options.onRunProgress?.(index, progress),
          })
          let run: AdoptionRun
          if (outcome.outcome === 'failed') {
            run = {
              index,
              outcome: 'failed',
              framework: 'failed',
              evidence: [],
              unknownPackages: [],
              metrics: outcome.metrics,
              error: outcome.error,
            }
          } else {
            const detection = await detectFramework(workspace)
            run = {
              index,
              outcome: 'completed',
              framework: detection.framework,
              evidence: detection.evidence,
              unknownPackages: detection.unknownPackages,
              metrics: outcome.metrics,
            }
          }
          options.onRunFinished?.(run)
          return run
        } finally {
          await removeWorkspace(workspace)
        }
      },
    )
  } finally {
    await shutdownRunner()
  }
}
