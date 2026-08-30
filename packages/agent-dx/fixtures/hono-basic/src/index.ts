import { Hono } from 'hono'
import { logger } from 'hono/logger'

const app = new Hono()

app.use(logger())

app.get('/', (c) => c.json({ message: 'Hello' }))
app.get('/health', (c) => c.json({ ok: true }))

export default app
