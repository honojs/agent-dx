import { init, useInitialData, useModel, useResponseFinish, useSandbox } from '@flue/runtime'
import type { Flue } from '@flue/runtime/node'
import { local, start } from '@flue/runtime/node'
import type { HonoCliUsage, RunMetrics, TokenUsage } from '../schema.js'

/**
 * Runs one agent turn with Flue in a fresh conversation, attached to a
 * local sandbox rooted at the given workspace directory.
 *
 * Flue allows exactly one runtime per process, so a single shared runtime
 * serves every run; per-run configuration (model, instructions, sandbox
 * root) travels in the conversation's initialData. This is what makes
 * concurrent runs possible.
 *
 * This is the single code path used for every suite, locally and in CI.
 * Additional runners (e.g. Cloudflare Sandbox) can be added later behind
 * the same `AgentRunOutcome` contract.
 */

export interface AgentRunOptions {
  /** Flue model id, e.g. "anthropic/claude-haiku-4-5". */
  model: string
  /** System instructions for the agent. */
  instructions: string
  /** The user task prompt. */
  prompt: string
  /** Directory the agent can read/write/execute in. */
  workspace: string
  timeoutMs?: number
  /** Called on every tool invocation, for live progress output. */
  onProgress?: (progress: AgentRunProgress) => void
}

export interface AgentRunProgress {
  toolName: string
  /** Short human-readable hint, e.g. a file path or a command. */
  detail?: string
}

export interface AgentRunOutcome {
  outcome: 'completed' | 'failed'
  text: string
  metrics: RunMetrics
  error?: string
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000
const MAX_TRANSCRIPT_COMMANDS = 100
const MAX_TRANSCRIPT_COMMAND_LENGTH = 200

interface RunnerInit {
  model: string
  instructions: string
  cwd: string
}

function AgentDxRunner(): string {
  const config = useInitialData<RunnerInit>()
  useModel(config.model)
  useSandbox(local({ cwd: config.cwd }))
  // Attach aggregate token usage to the reply metadata so the harness
  // can report it without any provider-specific plumbing.
  useResponseFinish(({ response }) => ({
    usage: {
      input: response.usage.input,
      output: response.usage.output,
      totalTokens: response.usage.totalTokens,
    },
  }))
  return config.instructions
}

let runtime: Promise<Flue> | null = null

function acquireRuntime(): Promise<Flue> {
  runtime ??= start({ agents: [AgentDxRunner] })
  return runtime
}

/** Stop the shared Flue runtime. Call once after all runs have finished. */
export async function shutdownRunner(): Promise<void> {
  if (!runtime) return
  const started = runtime
  runtime = null
  await (await started).stop()
}

function extractTokenUsage(metadata: Record<string, unknown> | undefined): TokenUsage | undefined {
  const usage = metadata?.usage
  if (typeof usage !== 'object' || usage === null) return undefined
  const record = usage as Record<string, unknown>
  const input = typeof record.input === 'number' ? record.input : undefined
  const output = typeof record.output === 'number' ? record.output : undefined
  if (input === undefined && output === undefined) return undefined
  const total =
    typeof record.totalTokens === 'number' ? record.totalTokens : (input ?? 0) + (output ?? 0)
  return { input: input ?? 0, output: output ?? 0, total }
}

/**
 * Detect Hono CLI invocations inside one bash command. A command may
 * chain several invocations (`cd . && npx hono routes | head`), so it is
 * split on shell separators first. Deterministic by construction.
 *
 * Command keys are the subcommand (`routes`, `request`, `agent-context`,
 * `help` for `--help`/`-h`), with `request --trace` and `request --batch`
 * counted as their own keys so those modes are visible in breakdowns.
 */
export function analyzeHonoCliCommand(
  command: string
): Pick<HonoCliUsage, 'calls' | 'agentContext' | 'commands'> {
  const usage: Pick<HonoCliUsage, 'calls' | 'agentContext' | 'commands'> = {
    calls: 0,
    agentContext: false,
    commands: {},
  }
  for (const segment of command.split(/&&|\|\||[;|\n]/)) {
    const text = segment.trim()
    const match = text.match(/^(?:npx\s+)?(?:\.?\/?node_modules\/\.bin\/)?hono\s+(.*)$/)
    if (!match) continue
    usage.calls += 1
    const tokens = (match[1] ?? '').split(/\s+/)
    const first = tokens[0] ?? ''
    let key: string
    if (first === '--help' || first === '-h') key = 'help'
    else if (first.startsWith('-')) key = first.replace(/^-+/, '')
    else key = first || 'unknown'
    if (key === 'request' && tokens.includes('--batch')) {
      key = 'request --batch'
    } else if (key === 'request' && tokens.includes('--trace')) {
      key = 'request --trace'
    }
    usage.commands[key] = (usage.commands[key] ?? 0) + 1
    if (key === 'agent-context') usage.agentContext = true
  }
  return usage
}

/**
 * Does a Hono CLI tool result contain an error envelope (`"ok": false`)?
 * The CLI prints JSON envelopes by design, so this is a stable signal.
 */
export function isCliErrorEnvelope(output: unknown): boolean {
  try {
    const text = typeof output === 'string' ? output : JSON.stringify(output)
    return typeof text === 'string' && /"ok"\s*:\s*false/.test(text)
  } catch {
    return false
  }
}

/**
 * Compress a tool-input hint for one-line progress output: make paths
 * workspace-relative, keep only the first line, and cap the length.
 */
export function formatProgressDetail(hint: string, workspace: string): string | undefined {
  const detail = hint
    .replaceAll(`/private${workspace}/`, '')
    .replaceAll(`/private${workspace}`, '.')
    .replaceAll(`${workspace}/`, '')
    .replaceAll(workspace, '.')
    .split('\n')[0]
    ?.trim()
    .slice(0, 80)
  return detail === '' ? undefined : detail
}

/** Flatten an error's cause chain so run reports carry the real reason. */
function errorMessage(error: unknown): string {
  const parts: string[] = []
  let current: unknown = error
  while (current !== undefined && current !== null && parts.length < 5) {
    if (current instanceof Error) {
      parts.push(current.message)
      current = current.cause
    } else {
      try {
        parts.push(typeof current === 'object' ? JSON.stringify(current) : String(current))
      } catch {
        parts.push(String(current))
      }
      current = undefined
    }
  }
  return parts.join(' — caused by: ')
}

export async function runAgent(options: AgentRunOptions): Promise<AgentRunOutcome> {
  const { model, instructions, prompt, workspace } = options
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const startedAt = Date.now()
  const toolCallCounts: Record<string, number> = {}
  let toolCalls = 0
  let tokens: TokenUsage | undefined
  const honoCli: HonoCliUsage = {
    calls: 0,
    agentContext: false,
    commands: {},
    errors: 0,
    recovered: false,
  }
  const honoCliToolCalls = new Set<string>()
  const commands: string[] = []

  const noteMetadata = (metadata: unknown) => {
    if (typeof metadata !== 'object' || metadata === null) return
    tokens = extractTokenUsage(metadata as Record<string, unknown>) ?? tokens
  }

  await acquireRuntime()
  try {
    // A fresh conversation per run: init() without an id mints a new one.
    const handle = init(AgentDxRunner)
    const initialData: RunnerInit = { model, instructions, cwd: workspace }
    const receipt = await handle.dispatch({ message: prompt, initialData })
    const reply = await handle.read(receipt, {
      signal: AbortSignal.timeout(timeoutMs),
      onEvent: (chunk) => {
        if (chunk.type === 'tool-input') {
          toolCalls += 1
          toolCallCounts[chunk.toolName] = (toolCallCounts[chunk.toolName] ?? 0) + 1
          const input = chunk.input as Record<string, unknown> | null
          if (typeof input?.command === 'string') {
            if (commands.length < MAX_TRANSCRIPT_COMMANDS) {
              commands.push(
                input.command.length > MAX_TRANSCRIPT_COMMAND_LENGTH
                  ? `${input.command.slice(0, MAX_TRANSCRIPT_COMMAND_LENGTH)}…`
                  : input.command
              )
            }
            const usage = analyzeHonoCliCommand(input.command)
            if (usage.calls > 0) {
              if (honoCli.errors > 0) honoCli.recovered = true
              honoCli.calls += usage.calls
              honoCli.agentContext = honoCli.agentContext || usage.agentContext
              for (const [key, count] of Object.entries(usage.commands)) {
                honoCli.commands[key] = (honoCli.commands[key] ?? 0) + count
              }
              honoCliToolCalls.add(chunk.toolCallId)
            }
          }
          if (options.onProgress) {
            const hint = input?.path ?? input?.file_path ?? input?.command
            options.onProgress({
              toolName: chunk.toolName,
              detail: typeof hint === 'string' ? formatProgressDetail(hint, workspace) : undefined,
            })
          }
        } else if (chunk.type === 'tool-output' && honoCliToolCalls.has(chunk.toolCallId)) {
          if (isCliErrorEnvelope(chunk.output)) honoCli.errors += 1
        } else if (chunk.type === 'tool-output-error' && honoCliToolCalls.has(chunk.toolCallId)) {
          honoCli.errors += 1
        } else if (chunk.type === 'message-metadata' || chunk.type === 'message-started') {
          noteMetadata((chunk as { metadata?: unknown }).metadata)
        }
      },
    })
    noteMetadata(reply.metadata)
    return {
      outcome: 'completed',
      text: reply.text,
      metrics: {
        durationMs: Date.now() - startedAt,
        toolCalls,
        toolCallCounts,
        tokens,
        honoCli: honoCli.calls > 0 ? honoCli : undefined,
        commands: commands.length > 0 ? commands : undefined,
      },
    }
  } catch (error) {
    return {
      outcome: 'failed',
      text: '',
      metrics: {
        durationMs: Date.now() - startedAt,
        toolCalls,
        toolCallCounts,
        tokens,
        honoCli: honoCli.calls > 0 ? honoCli : undefined,
        commands: commands.length > 0 ? commands : undefined,
      },
      error: errorMessage(error),
    }
  }
}
