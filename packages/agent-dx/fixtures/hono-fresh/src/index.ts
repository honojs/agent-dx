import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => c.json({ name: 'hono-fresh-api' }))

export default app
