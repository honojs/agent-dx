import { describe, expect, it } from 'vitest'
import {
  ADOPTION_RUNTIMES,
  ADOPTION_SCENARIOS,
  adoptionPrompt,
} from '../src/suites/adoption/index.js'

// Rule: adoption prompts must never name a framework, and only the
// `framework` scenario may suggest using one at all.
const FRAMEWORK_NAMES = /hono|elysia|h3\b|express|fastify|itty|koa|nest/i
const FRAMEWORK_HINTS = /framework|library|middleware/i

describe('adoption prompts stay neutral', () => {
  for (const runtime of Object.values(ADOPTION_RUNTIMES)) {
    for (const scenario of Object.values(ADOPTION_SCENARIOS)) {
      const prompt = adoptionPrompt(runtime, scenario)
      it(`${runtime.id} × ${scenario.id} names no framework`, () => {
        expect(prompt).not.toMatch(FRAMEWORK_NAMES)
      })
      if (scenario.id !== 'framework') {
        it(`${runtime.id} × ${scenario.id} does not hint at frameworks`, () => {
          expect(prompt).not.toMatch(FRAMEWORK_HINTS)
        })
      }
    }
  }
})
