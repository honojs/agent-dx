#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { compareReports, renderComparison } from './report/compare.js'
import { frameworkLabel, renderReport } from './report/console.js'
import type { AgentDxReport } from './schema.js'
import { parseReport } from './schema.js'
import { formatDuration } from './stats.js'
import { ADOPTION_RUNTIMES, runAdoptionSuite } from './suites/adoption/index.js'
import {
  PROFICIENCY_TASKS,
  runProficiencySuite,
} from './suites/proficiency/index.js'
import { TOOL_VERSION } from './version.js'

const HELP = `Hono Agent DX — measure the developer experience of coding agents using Hono.

Usage:
  agent-dx [options]                     Run an eval suite
  agent-dx compare <a.json> <b.json>     Compare two reports (baseline vs candidate)

Options:
  --suite <name>      Suite to run: adoption | proficiency (default: adoption)
  --runs <n>          Number of runs, each in a fresh conversation (default: 5)
  --concurrency <n>   Runs to execute in parallel (default: 4)
  --quiet             Hide per-tool-call progress output
  --model <id>        Model id, e.g. anthropic/claude-haiku-4-5 or
                      cloudflare-ai-gateway/claude-haiku-4-5
  --runtime <id>      Adoption runtime: ${Object.keys(ADOPTION_RUNTIMES).join(' | ')}
                      (default: cloudflare-workers)
  --task <id>         Proficiency task (default: add-user-route)
  --report <path>     Write the JSON report to this file
  --variant <label>   Label this run for experiments (e.g. baseline, candidate)
  --list              List available suites, runtimes, and tasks
  --version           Print the version
  --help              Show this help

Experiments (planned):
  --target <name>     What to evaluate: cli | skill | docs | hono
  --candidate <path>  The work-in-progress variant
  --against <ref>     The baseline to compare against (e.g. latest)

Environment:
  ANTHROPIC_API_KEY        Required for anthropic/* models (other providers
                           use their own keys, e.g. OPENAI_API_KEY)
  CLOUDFLARE_API_KEY       Required for cloudflare-ai-gateway/* models: an
  CLOUDFLARE_ACCOUNT_ID    AI Gateway token plus the account and gateway ids.
  CLOUDFLARE_GATEWAY_ID    With unified billing, no provider key is needed.

Examples:
  agent-dx --suite adoption --runs 20 --concurrency 5
  agent-dx --suite proficiency --runs 3 --report result.json
  agent-dx --suite adoption --model cloudflare-ai-gateway/claude-haiku-4-5
  agent-dx compare baseline.json candidate.json
`

const PROVIDER_ENV_KEYS: Record<string, string[]> = {
  anthropic: ['ANTHROPIC_API_KEY'],
  openai: ['OPENAI_API_KEY'],
  google: ['GEMINI_API_KEY'],
  // Cloudflare AI Gateway (supports unified billing): the "API key" is an
  // AI Gateway token sent as cf-aig-authorization; no provider key needed.
  'cloudflare-ai-gateway': [
    'CLOUDFLARE_API_KEY',
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_GATEWAY_ID',
  ],
}

function fail(message: string): never {
  console.error(`agent-dx: ${message}`)
  process.exit(1)
}

function printList(): void {
  console.log('Suites:')
  console.log(
    '  adoption      Does the agent choose Hono given a neutral prompt?',
  )
  console.log(
    '  proficiency   Can the agent correctly modify an existing Hono project?',
  )
  console.log('')
  console.log('Adoption runtimes:')
  for (const runtime of Object.values(ADOPTION_RUNTIMES)) {
    console.log(`  ${runtime.id.padEnd(20)} ${runtime.displayName}`)
  }
  console.log('')
  console.log('Proficiency tasks:')
  for (const task of Object.values(PROFICIENCY_TASKS)) {
    console.log(`  ${task.id.padEnd(20)} ${task.description}`)
  }
}

async function loadReport(path: string): Promise<AgentDxReport> {
  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch {
    fail(`could not read report file: ${path}`)
  }
  const report = parseReport(JSON.parse(raw))
  if (!report) fail(`not a valid @hono/agent-dx report: ${path}`)
  return report
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      suite: { type: 'string' },
      runs: { type: 'string' },
      concurrency: { type: 'string' },
      quiet: { type: 'boolean' },
      model: { type: 'string' },
      runtime: { type: 'string' },
      task: { type: 'string' },
      report: { type: 'string' },
      variant: { type: 'string' },
      target: { type: 'string' },
      candidate: { type: 'string' },
      against: { type: 'string' },
      list: { type: 'boolean' },
      help: { type: 'boolean' },
      version: { type: 'boolean' },
    },
  })

  if (values.help) {
    console.log(HELP)
    return
  }
  if (values.version) {
    console.log(TOOL_VERSION)
    return
  }
  if (values.list) {
    printList()
    return
  }

  if (positionals[0] === 'compare') {
    const [, baselinePath, candidatePath] = positionals
    if (!baselinePath || !candidatePath) {
      fail('usage: agent-dx compare <baseline.json> <candidate.json>')
    }
    const baseline = await loadReport(baselinePath)
    const candidate = await loadReport(candidatePath)
    console.log(renderComparison(compareReports(baseline, candidate)))
    return
  }
  if (positionals.length > 0) {
    fail(`unknown command "${positionals[0]}" — see agent-dx --help`)
  }

  if (values.target || values.candidate || values.against) {
    console.error(
      'Experiment orchestration (--target / --candidate / --against) is not',
    )
    console.error(
      'implemented yet. For now, run each variant yourself and compare:',
    )
    console.error('')
    console.error(
      '  agent-dx --suite proficiency --variant baseline  --report baseline.json',
    )
    console.error('  # ...switch to the candidate setup...')
    console.error(
      '  agent-dx --suite proficiency --variant candidate --report candidate.json',
    )
    console.error('  agent-dx compare baseline.json candidate.json')
    process.exit(1)
  }

  const suite = values.suite ?? 'adoption'
  if (suite !== 'adoption' && suite !== 'proficiency') {
    fail(`unknown suite "${suite}" — expected "adoption" or "proficiency"`)
  }
  const runs = Number.parseInt(values.runs ?? '5', 10)
  if (!Number.isInteger(runs) || runs < 1) {
    fail(`--runs must be a positive integer, got "${values.runs}"`)
  }
  const concurrency = Number.parseInt(values.concurrency ?? '4', 10)
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    fail(
      `--concurrency must be a positive integer, got "${values.concurrency}"`,
    )
  }
  const model = values.model ?? 'anthropic/claude-haiku-4-5'

  const provider = model.split('/')[0] ?? ''
  const missingEnv = (PROVIDER_ENV_KEYS[provider] ?? []).filter(
    (key) => !process.env[key],
  )
  if (missingEnv.length > 0) {
    fail(
      `${missingEnv.join(', ')} not set — required to run models from "${provider}"`,
    )
  }

  console.error(
    `Running ${suite} suite (model: ${model}, runs: ${runs}, concurrency: ${concurrency})...`,
  )

  const onRunStarted = (index: number) => {
    console.error(`  run ${index}/${runs} started`)
  }
  const onRunProgress = values.quiet
    ? undefined
    : (index: number, progress: { toolName: string; detail?: string }) => {
        const detail = progress.detail ? ` ${progress.detail}` : ''
        console.error(`  run ${index}/${runs}: ${progress.toolName}${detail}`)
      }

  let report: AgentDxReport
  if (suite === 'adoption') {
    report = await runAdoptionSuite({
      model,
      runs,
      concurrency,
      runtime: values.runtime ?? 'cloudflare-workers',
      onRunStarted,
      onRunProgress,
      onRunFinished: (run) => {
        const label =
          run.outcome === 'failed' ? 'failed' : frameworkLabel(run.framework)
        console.error(
          `  run ${run.index}/${runs} done: ${label} ` +
            `(${run.metrics.toolCalls} tool calls, ${formatDuration(run.metrics.durationMs)})`,
        )
      },
    })
  } else {
    report = await runProficiencySuite({
      model,
      runs,
      concurrency,
      task: values.task ?? 'add-user-route',
      onRunStarted,
      onRunProgress,
      onRunFinished: (run) => {
        const label =
          run.outcome === 'failed' ? 'failed' : run.success ? 'pass' : 'FAIL'
        console.error(
          `  run ${run.index}/${runs} done: ${label} ` +
            `(${run.metrics.toolCalls} tool calls, ${formatDuration(run.metrics.durationMs)})`,
        )
      },
    })
  }

  if (values.variant) report.variant = values.variant

  console.log('')
  console.log(renderReport(report))

  if (values.report) {
    await writeFile(values.report, `${JSON.stringify(report, null, 2)}\n`)
    console.error(`\nReport written to ${values.report}`)
  }
}

main().catch((error) => {
  console.error(
    `agent-dx: ${error instanceof Error ? error.message : String(error)}`,
  )
  process.exit(1)
})
