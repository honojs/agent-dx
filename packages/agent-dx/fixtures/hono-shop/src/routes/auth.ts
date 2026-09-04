import { Hono } from 'hono'
import { users } from '../data.js'

const sessions = new Map<string, number>()

const app = new Hono()

app.post('/login', async (c) => {
  const body = await c.req.json<{ email: string }>()
  const user = users.find((u) => u.email === body.email)
  if (!user) return c.json({ error: 'unknown email' }, 401)
  const token = `session-${user.id}-${sessions.size + 1}`
  sessions.set(token, user.id)
  return c.json({ token })
})

app.post('/logout', async (c) => {
  const body = await c.req.json<{ token: string }>()
  sessions.delete(body.token)
  return c.json({ ok: true })
})

app.get('/me', (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  const userId = token ? sessions.get(token) : undefined
  const user = users.find((u) => u.id === userId)
  return user ? c.json(user) : c.json({ error: 'not signed in' }, 401)
})

export default app
