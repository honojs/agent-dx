import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { exec } from '../../exec.js'
import { fixtureDir } from '../../fixtures.js'
import { runPool } from '../../pool.js'
import type { AgentRunProgress } from '../../runner/flue-runner.js'
import { runAgent, shutdownRunner } from '../../runner/flue-runner.js'
import type { ProficiencyReport, ProficiencyRun } from '../../schema.js'
import { SCHEMA_VERSION } from '../../schema.js'
import { median } from '../../stats.js'
import { TOOL_VERSION } from '../../version.js'
import {
  createWorkspaceFrom,
  persistWorkspace,
  removeWorkspace,
} from '../../workspace.js'
import type { ProficiencyTask } from './task.js'
import { addUserRouteTask } from './tasks/add-user-route.js'

/**
 * Proficiency suite: hand the agent an existing Hono project and a small
 * change request, then grade the result with hidden deterministic checks.
 *
 * New tasks are added by implementing `ProficiencyTask` and registering
 * them in `PROFICIENCY_TASKS` (planned: routing, 404 debugging,
 * middleware scope, validation, RPC typing, performance).
 */

export const PROFICIENCY_TASKS: Record<string, ProficiencyTask> = {
  [addUserRouteTask.id]: addUserRouteTask,
}

const INSTRUCTIONS = [
  'You are an autonomous coding agent working in an existing project.',
  'Dependencies are already installed in node_modules.',
  'Make the requested change directly in the project files.',
  'Do not ask questions. When the change is complete, stop and summarize briefly.',
].join('\n')

export interface ProficiencySuiteOptions {
  model: string
  runs: number
  task: string
  timeoutMs?: number
  /** How many runs to execute in parallel (default 1). */
  concurrency?: number
  /** Keep each run's modified workspace under this directory. */
  keepDir?: string
  onRunStarted?: (index: number) => void
  onRunProgress?: (index: number, progress: AgentRunProgress) => void
  onRunFinished?: (run: ProficiencyRun) => void
}

/**
 * Copy the fixture into a staging workspace and install its dependencies
 * once; each run then clones the prepared workspace so runs stay cheap
 * and identical.
 */
async function prepareFixture(task: ProficiencyTask): Promise<string> {
  const prepared = await createWorkspaceFrom(
    'fixture',
    fixtureDir(task.fixture),
  )
  const install = await exec(
    'npm',
    ['install', '--no-audit', '--no-fund', '--loglevel=error'],
    {
      cwd: prepared,
      timeoutMs: 300_000,
    },
  )
  if (!install.ok) {
    await removeWorkspace(prepared)
    throw new Error(
      `Fixture install failed for "${task.fixture}":\n${install.stderr}`,
    )
  }
  return prepared
}

export async function runProficiencySuite(
  options: ProficiencySuiteOptions,
): Promise<ProficiencyReport> {
  const task = PROFICIENCY_TASKS[options.task]
  if (!task) {
    const known = Object.keys(PROFICIENCY_TASKS).join(', ')
    throw new Error(
      `Unknown proficiency task "${options.task}". Known tasks: ${known}`,
    )
  }

  const startedAt = new Date().toISOString()
  const prepared = await prepareFixture(task)

  let results: ProficiencyRun[]
  try {
    results = await runPool(
      options.runs,
      options.concurrency ?? 1,
      async (jobIndex) => {
        const index = jobIndex + 1
        options.onRunStarted?.(index)
        const workspace = await createWorkspaceFrom('proficiency', prepared)
        try {
          const outcome = await runAgent({
            model: options.model,
            instructions: INSTRUCTIONS,
            prompt: task.prompt,
            workspace,
            timeoutMs: options.timeoutMs,
            onProgress: (progress) => options.onRunProgress?.(index, progress),
          })
          let run: ProficiencyRun
          if (outcome.outcome === 'failed') {
            run = {
              index,
              outcome: 'failed',
              success: false,
              checks: [],
              metrics: outcome.metrics,
              error: outcome.error,
            }
          } else {
            // The grader only runs after the agent is done; the agent never
            // sees the checks.
            await rm(`${workspace}/.agent-dx`, {
              recursive: true,
              force: true,
            })
            const checks = await task.grade(workspace)
            run = {
              index,
              outcome: 'completed',
              success:
                checks.length > 0 && checks.every((check) => check.passed),
              checks,
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
      },
    )
  } finally {
    await shutdownRunner()
    await removeWorkspace(prepared)
  }

  const tokenTotals = results
    .map((run) => run.metrics.tokens?.total)
    .filter((total): total is number => typeof total === 'number')

  return {
    schemaVersion: SCHEMA_VERSION,
    tool: '@hono/agent-dx',
    toolVersion: TOOL_VERSION,
    suite: 'proficiency',
    model: options.model,
    runs: options.runs,
    startedAt,
    finishedAt: new Date().toISOString(),
    task: task.id,
    results,
    summary: {
      successRate:
        options.runs === 0
          ? 0
          : results.filter((run) => run.success).length / options.runs,
      medianDurationMs: median(results.map((run) => run.metrics.durationMs)),
      medianToolCalls: median(results.map((run) => run.metrics.toolCalls)),
      medianTokens: tokenTotals.length > 0 ? median(tokenTotals) : undefined,
    },
  }
}
