import { type AgentDxReport, isAdoptionReport } from '@hono/agent-dx/schema'
import { Hono } from 'hono'
import { jsxRenderer } from 'hono/jsx-renderer'
import { ssgParams } from 'hono/ssg'
import { AdoptionDetail, Home, Layout } from './app.js'

/**
 * The site as a function of the report data. scripts/ssg.mts renders it
 * to static HTML with `toSSG` for the assets-only production deploy.
 */
export function createSite(reports: AgentDxReport[]): Hono {
  const adoption = reports.filter(isAdoptionReport)
  const cells = new Map<string, { runtime: string; scenario: string }>()
  for (const report of adoption) {
    const scenario = report.scenario ?? 'default'
    cells.set(`${report.runtime}/${scenario}`, {
      runtime: report.runtime,
      scenario,
    })
  }

  const app = new Hono()
  app.use(jsxRenderer(({ children }) => <Layout>{children}</Layout>))
  app.get('/', (c) => c.render(<Home reports={reports} />))
  app.get('/adoption/:runtime/:scenario', ssgParams([...cells.values()]), (c) => {
    const { runtime, scenario } = c.req.param()
    const matching = adoption.filter(
      (report) => report.runtime === runtime && (report.scenario ?? 'default') === scenario
    )
    if (matching.length === 0) {
      return c.notFound()
    }
    return c.render(<AdoptionDetail runtime={runtime} scenario={scenario} reports={matching} />)
  })
  return app
}
