import { join } from 'node:path'
import { runPool } from '../../pool.js'
import type { AgentRunProgress } from '../../runner/flue-runner.js'
import { runAgent, shutdownRunner } from '../../runner/flue-runner.js'
import type { AdoptionReport, AdoptionRun } from '../../schema.js'
import { SCHEMA_VERSION } from '../../schema.js'
import { TOOL_VERSION } from '../../version.js'
import { createWorkspace, persistWorkspace, removeWorkspace } from '../../workspace.js'
import { detectFramework } from './detect.js'

/**
 * Adoption suite: give a coding agent a prompt in an empty workspace,
 * then classify which framework it chose from the files it produced.
 *
 * A measurement is a (runtime, scenario) pair: the runtime fixes the
 * platform, the scenario fixes the task and how much it invites a
 * framework — from "entirely the agent's idea" to "explicitly asked".
 */

export interface AdoptionRuntime {
  id: string
  displayName: string
  /** First prompt line establishing the platform. */
  intro: string
}

// IMPORTANT: prompts must stay neutral about the choice itself. Never
// mention Hono or any concrete framework, and outside the `framework`
// scenario never hint that one should be used — even the word
// "middleware" nudges agents toward frameworks.
export const ADOPTION_RUNTIMES: Record<string, AdoptionRuntime> = {
  'cloudflare-workers': {
    id: 'cloudflare-workers',
    displayName: 'Cloudflare Workers',
    intro: 'Create a Cloudflare Workers application in TypeScript.',
  },
  bun: {
    id: 'bun',
    displayName: 'Bun',
    intro: 'Create an HTTP server in TypeScript that runs on Bun.',
  },
  'node-js': {
    id: 'node-js',
    displayName: 'Node.js',
    intro: 'Create an HTTP server in TypeScript that runs on Node.js.',
  },
  deno: {
    id: 'deno',
    displayName: 'Deno',
    intro: 'Create an HTTP server in TypeScript that runs on Deno.',
  },
}

export interface AdoptionScenario {
  id: string
  description: string
  /** Prompt lines appended after the runtime intro. */
  task: string[]
}

const API_TASK =
  'Implement a JSON API for managing todos: endpoints to list, create, and delete todos, input validation, and consistent JSON error responses.'

export const ADOPTION_SCENARIOS: Record<string, AdoptionScenario> = {
  minimal: {
    id: 'minimal',
    description: 'One trivial endpoint — using a framework is entirely the agent’s idea',
    task: ['It should respond to GET /health with the JSON {"ok":true}.'],
  },
  routes: {
    id: 'routes',
    description: 'A few endpoints with a path parameter — where hand-rolled routing starts to hurt',
    task: [
      'It should respond to GET /health with the JSON {"ok":true},',
      'to GET /users with a JSON list of users,',
      'and to GET /users/123 with the JSON {"id":"123"} for any user id in the path.',
    ],
  },
  api: {
    id: 'api',
    description: 'A realistic JSON API — does complexity make the agent reach for one?',
    task: [API_TASK],
  },
  framework: {
    id: 'framework',
    description: 'Explicitly asked to use a web framework — which one gets picked?',
    task: [API_TASK, 'Use a web framework of your choice.'],
  },
}

/** Build the full prompt for one (runtime, scenario) measurement. */
export function adoptionPrompt(runtime: AdoptionRuntime, scenario: AdoptionScenario): string {
  return [runtime.intro, '', ...scenario.task].join('\n')
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
  scenario: string
  timeoutMs?: number
  /** How many runs to execute in parallel (default 1). */
  concurrency?: number
  /** Keep each run's generated workspace under this directory. */
  keepDir?: string
  onRunStarted?: (index: number) => void
  onRunProgress?: (index: number, progress: AgentRunProgress) => void
  onRunFinished?: (run: AdoptionRun) => void
}

export async function runAdoptionSuite(options: AdoptionSuiteOptions): Promise<AdoptionReport> {
  const runtime = ADOPTION_RUNTIMES[options.runtime]
  if (!runtime) {
    const known = Object.keys(ADOPTION_RUNTIMES).join(', ')
    throw new Error(`Unknown adoption runtime "${options.runtime}". Known runtimes: ${known}`)
  }
  const scenario = ADOPTION_SCENARIOS[options.scenario]
  if (!scenario) {
    const known = Object.keys(ADOPTION_SCENARIOS).join(', ')
    throw new Error(`Unknown adoption scenario "${options.scenario}". Known scenarios: ${known}`)
  }

  const startedAt = new Date().toISOString()

  const results = await runAllRuns(options, adoptionPrompt(runtime, scenario))

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
    scenario: scenario.id,
    prompt: adoptionPrompt(runtime, scenario),
    results,
    summary: {
      counts,
      honoAdoption: options.runs === 0 ? 0 : (counts.hono ?? 0) / options.runs,
    },
  }
}

async function runAllRuns(options: AdoptionSuiteOptions, prompt: string): Promise<AdoptionRun[]> {
  try {
    return await runPool(options.runs, options.concurrency ?? 1, async (jobIndex) => {
      const index = jobIndex + 1
      options.onRunStarted?.(index)
      const workspace = await createWorkspace('adoption')
      try {
        // A fresh conversation and a fresh workspace for every run.
        const outcome = await runAgent({
          model: options.model,
          instructions: INSTRUCTIONS,
          prompt,
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
        if (options.keepDir) {
          run.workspace = join(options.keepDir, `run-${index}`)
          await persistWorkspace(workspace, run.workspace)
        }
        options.onRunFinished?.(run)
        return run
      } finally {
        await removeWorkspace(workspace)
      }
    })
  } finally {
    await shutdownRunner()
  }
}
