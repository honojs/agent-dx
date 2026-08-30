export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const low = sorted[mid - 1] ?? 0
  const high = sorted[mid] ?? 0
  return sorted.length % 2 === 0 ? (low + high) / 2 : high
}

export function percent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`
  return String(tokens)
}
