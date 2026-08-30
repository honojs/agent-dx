export * from './schema.js'
export { compareReports, renderComparison } from './report/compare.js'
export type { ComparisonRow, ExperimentComparison } from './report/compare.js'
export {
  frameworkLabel,
  renderAdoptionReport,
  renderProficiencyReport,
  renderReport,
} from './report/console.js'
export { detectFramework } from './suites/adoption/detect.js'
export type { DetectionResult } from './suites/adoption/detect.js'
export { ADOPTION_RUNTIMES, runAdoptionSuite } from './suites/adoption/index.js'
export {
  PROFICIENCY_TASKS,
  runProficiencySuite,
} from './suites/proficiency/index.js'
export type { ProficiencyTask } from './suites/proficiency/task.js'
export { runAgent } from './runner/flue-runner.js'
export type { AgentRunOptions, AgentRunOutcome } from './runner/flue-runner.js'
export { TOOL_VERSION } from './version.js'
