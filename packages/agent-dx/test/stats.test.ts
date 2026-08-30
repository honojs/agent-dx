import { describe, expect, it } from 'vitest'
import { formatDuration, formatTokens, median, percent } from '../src/stats.js'

describe('median', () => {
  it('returns 0 for an empty list', () => {
    expect(median([])).toBe(0)
  })
  it('handles odd and even lengths', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })
})

describe('formatting', () => {
  it('formats percentages', () => {
    expect(percent(0.75)).toBe('75%')
  })
  it('formats durations', () => {
    expect(formatDuration(500)).toBe('500ms')
    expect(formatDuration(51_000)).toBe('51s')
  })
  it('formats tokens', () => {
    expect(formatTokens(14_200)).toBe('14.2k')
    expect(formatTokens(950)).toBe('950')
  })
})
