/**
 * Run `count` jobs with at most `concurrency` in flight, preserving result
 * order by job index. Runs are independent agent conversations, so this is
 * safe for every suite.
 */
export async function runPool<T>(
  count: number,
  concurrency: number,
  worker: (index: number) => Promise<T>
): Promise<T[]> {
  const results = Array.from({ length: count }) as T[]
  let next = 0
  const size = Math.max(1, Math.min(concurrency, count))
  const workers = Array.from({ length: size }, async () => {
    while (next < count) {
      const index = next
      next += 1
      results[index] = await worker(index)
    }
  })
  await Promise.all(workers)
  return results
}
