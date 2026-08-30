import { init, useModel, useResponseFinish, useSandbox } from '@flue/runtime'
import { local, start } from '@flue/runtime/node'
import type { RunMetrics, TokenUsage } from '../schema.js'

/**
 * Runs one agent turn with Flue in a fresh conversation, attached to a
 * local sandbox rooted at the given workspace directory.
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
}

export interface AgentRunOutcome {
  outcome: 'completed' | 'failed'
  text: string
  metrics: RunMetrics
  error?: string
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000

function extractTokenUsage(
  metadata: Record<string, unknown> | undefined,
): TokenUsage | undefined {
  const usage = metadata?.usage
  if (typeof usage !== 'object' || usage === null) return undefined
  const record = usage as Record<string, unknown>
  const input = typeof record.input === 'number' ? record.input : undefined
  const output = typeof record.output === 'number' ? record.output : undefined
  if (input === undefined && output === undefined) return undefined
  const total =
    typeof record.totalTokens === 'number'
      ? record.totalTokens
      : (input ?? 0) + (output ?? 0)
  return { input: input ?? 0, output: output ?? 0, total }
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
        parts.push(
          typeof current === 'object'
            ? JSON.stringify(current)
            : String(current),
        )
      } catch {
        parts.push(String(current))
      }
      current = undefined
    }
  }
  return parts.join(' — caused by: ')
}

export async function runAgent(
  options: AgentRunOptions,
): Promise<AgentRunOutcome> {
  const { model, instructions, prompt, workspace } = options
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const agent = () => {
    useModel(model)
    useSandbox(local({ cwd: workspace }))
    // Attach aggregate token usage to the reply metadata so the harness
    // can report it without any provider-specific plumbing.
    useResponseFinish(({ response }) => ({
      usage: {
        input: response.usage.input,
        output: response.usage.output,
        totalTokens: response.usage.totalTokens,
      },
    }))
    return instructions
  }

  const startedAt = Date.now()
  const toolCallCounts: Record<string, number> = {}
  let toolCalls = 0
  let tokens: TokenUsage | undefined

  const noteMetadata = (metadata: unknown) => {
    if (typeof metadata !== 'object' || metadata === null) return
    tokens = extractTokenUsage(metadata as Record<string, unknown>) ?? tokens
  }

  const flue = await start({ agents: [{ agent, name: 'agent-dx-runner' }] })
  try {
    const handle = init(agent)
    const receipt = await handle.dispatch(prompt)
    const reply = await handle.read(receipt, {
      signal: AbortSignal.timeout(timeoutMs),
      onEvent: (chunk) => {
        if (chunk.type === 'tool-input') {
          toolCalls += 1
          toolCallCounts[chunk.toolName] =
            (toolCallCounts[chunk.toolName] ?? 0) + 1
        } else if (
          chunk.type === 'message-metadata' ||
          chunk.type === 'message-started'
        ) {
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
      },
      error: errorMessage(error),
    }
  } finally {
    await flue.stop()
  }
}
