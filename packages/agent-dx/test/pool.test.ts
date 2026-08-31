import { describe, expect, it } from 'vitest'
import { runPool } from '../src/pool.js'

const tick = () => new Promise((resolve) => setTimeout(resolve, 1))

describe('runPool', () => {
  it('preserves result order by job index', async () => {
    const results = await runPool(5, 3, async (index) => {
      // Later jobs finish first to prove ordering is by index, not by time.
      await new Promise((resolve) => setTimeout(resolve, (5 - index) * 5))
      return index * 10
    })
    expect(results).toEqual([0, 10, 20, 30, 40])
  })

  it('never exceeds the concurrency limit', async () => {
    let inFlight = 0
    let maxInFlight = 0
    await runPool(10, 3, async () => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await tick()
      inFlight -= 1
    })
    expect(maxInFlight).toBeLessThanOrEqual(3)
    expect(maxInFlight).toBeGreaterThan(1)
  })

  it('caps workers at the job count and handles concurrency 1', async () => {
    const order: number[] = []
    await runPool(3, 100, async (index) => {
      order.push(index)
      await tick()
    })
    expect(order.sort()).toEqual([0, 1, 2])

    const sequential: number[] = []
    await runPool(3, 1, async (index) => {
      sequential.push(index)
      await tick()
    })
    expect(sequential).toEqual([0, 1, 2])
  })
})
