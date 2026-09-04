export * from './schema.js'
export { compareReports, renderComparison } from './report/compare.js'
export type { ComparisonRow, ExperimentComparison } from './report/compare.js'
export {
  frameworkLabel,
  renderAdoptionReport,
  renderPracticalReport,
  renderReport,
} from './report/console.js'
export { detectFramework } from './suites/adoption/detect.js'
export type { DetectionResult } from './suites/adoption/detect.js'
export { ADOPTION_RUNTIMES, runAdoptionSuite } from './suites/adoption/index.js'
export { PRACTICAL_TASKS, runPracticalSuite } from './suites/practical/index.js'
export type { PracticalTask } from './suites/practical/task.js'
export { runAgent } from './runner/flue-runner.js'
export type { AgentRunOptions, AgentRunOutcome } from './runner/flue-runner.js'
export { TOOL_VERSION } from './version.js'
