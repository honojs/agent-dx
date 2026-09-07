import type { PracticalCheck } from '../../schema.js'

/**
 * A practical task gives the agent an existing project (the fixture)
 * plus a small change request, then grades the modified workspace with
 * hidden, deterministic checks. The agent never sees the grader.
 */
export interface PracticalTask {
  id: string
  description: string
  /** Name of a directory under this package's `fixtures/`. */
  fixture: string
  /** The change request shown to the agent. */
  prompt: string
  /**
   * Further change requests, sent one at a time in the same conversation
   * once the agent finishes the previous one. The grader then checks the
   * final state — every step's contract must still hold.
   */
  followUps?: string[]
  /** Hidden checks, run against the workspace after the agent finishes. */
  grade(workspace: string): Promise<PracticalCheck[]>
}
