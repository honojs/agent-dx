import { Hono } from 'hono'
import { Page } from './app.js'
import { loadReports } from './reports.js'

type Bindings = {
  RESULTS: R2Bucket
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const reports = await loadReports(c.env.RESULTS)
  c.header('Cache-Control', 'public, max-age=300')
  return c.html(`<!DOCTYPE html>${<Page reports={reports} />}`)
})

export default app
