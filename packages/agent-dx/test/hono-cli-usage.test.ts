import { describe, expect, it } from 'vitest'
import { analyzeHonoCliCommand } from '../src/runner/flue-runner.js'

describe('analyzeHonoCliCommand', () => {
  it('counts direct and npx invocations', () => {
    expect(analyzeHonoCliCommand('hono routes')).toEqual({
      calls: 1,
      agentContext: false,
    })
    expect(analyzeHonoCliCommand('npx hono request -P /todos')).toEqual({
      calls: 1,
      agentContext: false,
    })
    expect(
      analyzeHonoCliCommand('./node_modules/.bin/hono routes --plain'),
    ).toEqual({ calls: 1, agentContext: false })
  })

  it('detects agent-context', () => {
    expect(analyzeHonoCliCommand('npx hono agent-context')).toEqual({
      calls: 1,
      agentContext: true,
    })
  })

  it('counts chained invocations separately', () => {
    const usage = analyzeHonoCliCommand(
      'cd . && npx hono agent-context && npx hono routes | head -20',
    )
    expect(usage).toEqual({ calls: 2, agentContext: true })
  })

  it('ignores unrelated commands and substrings', () => {
    expect(analyzeHonoCliCommand('npm install hono')).toEqual({
      calls: 0,
      agentContext: false,
    })
    expect(analyzeHonoCliCommand('cat hono.txt')).toEqual({
      calls: 0,
      agentContext: false,
    })
    expect(analyzeHonoCliCommand('echo "use hono routes"')).toEqual({
      calls: 0,
      agentContext: false,
    })
  })
})
