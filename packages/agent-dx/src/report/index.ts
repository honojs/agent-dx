/**
 * Pure reporting utilities, exported as `@hono/agent-dx/report` so
 * non-Node consumers (e.g. the results website running on Workers) can
 * use them without pulling in the Flue runner or suites.
 */
export { compareReports, renderComparison } from './compare.js'
export type { ComparisonRow, ExperimentComparison } from './compare.js'
export {
  frameworkLabel,
  renderAdoptionReport,
  renderProficiencyReport,
  renderReport,
} from './console.js'
