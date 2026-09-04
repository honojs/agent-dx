import { isAdoptionReport } from '@hono/agent-dx/schema'
import { Hono } from 'hono'
import { AdoptionDetail, Home } from './app.js'
import { renderer } from './renderer.js'
import { loadReports } from './reports.js'

// `Env` is generated from wrangler.jsonc by `wrangler types`.
const app = new Hono<{ Bindings: Env }>()

app.use(renderer)

app.get('/', async (c) => {
  const reports = await loadReports(c.env.RESULTS)
  return c.render(<Home reports={reports} />)
})

app.get('/adoption/:runtime/:scenario', async (c) => {
  const { runtime, scenario } = c.req.param()
  const reports = (await loadReports(c.env.RESULTS))
    .filter(isAdoptionReport)
    .filter(
      (report) =>
        report.runtime === runtime &&
        (report.scenario ?? 'default') === scenario,
    )
  if (reports.length === 0) return c.notFound()
  return c.render(
    <AdoptionDetail runtime={runtime} scenario={scenario} reports={reports} />,
  )
})

export default app
