import { describe, expect, it } from 'vitest'
import {
  analyzeHonoCliCommand,
  isCliErrorEnvelope,
} from '../src/runner/flue-runner.js'

describe('analyzeHonoCliCommand', () => {
  it('counts direct and npx invocations with their subcommand', () => {
    expect(analyzeHonoCliCommand('hono routes')).toEqual({
      calls: 1,
      agentContext: false,
      commands: { routes: 1 },
    })
    expect(analyzeHonoCliCommand('npx hono request -P /todos')).toEqual({
      calls: 1,
      agentContext: false,
      commands: { request: 1 },
    })
    expect(
      analyzeHonoCliCommand('./node_modules/.bin/hono routes --plain'),
    ).toEqual({ calls: 1, agentContext: false, commands: { routes: 1 } })
  })

  it('detects agent-context and help entry points', () => {
    expect(analyzeHonoCliCommand('npx hono agent-context')).toEqual({
      calls: 1,
      agentContext: true,
      commands: { 'agent-context': 1 },
    })
    expect(analyzeHonoCliCommand('npx hono --help')).toEqual({
      calls: 1,
      agentContext: false,
      commands: { help: 1 },
    })
  })

  it('separates request --trace from plain request', () => {
    expect(analyzeHonoCliCommand('npx hono request -P /todos --trace')).toEqual(
      {
        calls: 1,
        agentContext: false,
        commands: { 'request --trace': 1 },
      },
    )
  })

  it('counts chained invocations separately', () => {
    const usage = analyzeHonoCliCommand(
      'cd . && npx hono agent-context && npx hono routes | head -20',
    )
    expect(usage).toEqual({
      calls: 2,
      agentContext: true,
      commands: { 'agent-context': 1, routes: 1 },
    })
  })

  it('ignores unrelated commands and substrings', () => {
    for (const command of [
      'npm install hono',
      'cat hono.txt',
      'echo "use hono routes"',
    ]) {
      expect(analyzeHonoCliCommand(command).calls).toBe(0)
    }
  })
})

describe('isCliErrorEnvelope', () => {
  it('detects ok:false envelopes in strings and objects', () => {
    expect(isCliErrorEnvelope('{"ok":false,"error":"no route"}')).toBe(true)
    expect(isCliErrorEnvelope({ ok: false, error: 'no route' })).toBe(true)
    expect(isCliErrorEnvelope('{"ok": false }')).toBe(true)
  })

  it('ignores successful envelopes and unrelated output', () => {
    expect(isCliErrorEnvelope('{"ok":true,"routes":[]}')).toBe(false)
    expect(isCliErrorEnvelope('plain text output')).toBe(false)
    expect(isCliErrorEnvelope(undefined)).toBe(false)
  })
})
