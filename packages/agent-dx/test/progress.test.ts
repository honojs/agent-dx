import { describe, expect, it } from 'vitest'
import { formatProgressDetail } from '../src/runner/flue-runner.js'

const ws = '/var/folders/ab/T/agent-dx-adoption-x1'

describe('formatProgressDetail', () => {
  it('makes file paths workspace-relative', () => {
    expect(formatProgressDetail(`${ws}/src/index.ts`, ws)).toBe('src/index.ts')
  })

  it('rewrites workspace references inside commands', () => {
    expect(formatProgressDetail(`cd ${ws} && npm run typecheck`, ws)).toBe(
      'cd . && npm run typecheck',
    )
    expect(formatProgressDetail(`/private${ws}/src/app.ts`, ws)).toBe(
      'src/app.ts',
    )
  })

  it('keeps only the first line and caps the length', () => {
    expect(formatProgressDetail('echo one\necho two', ws)).toBe('echo one')
    expect(formatProgressDetail('x'.repeat(200), ws)).toHaveLength(80)
  })

  it('returns undefined for empty results', () => {
    expect(formatProgressDetail('\n\n', ws)).toBeUndefined()
  })
})
