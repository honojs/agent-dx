import { Hono } from 'hono'
import { orders, users } from '../data.js'

export const usersRouter = new Hono()

usersRouter.get('/', (c) => c.json(users))

usersRouter.get('/:id', (c) => {
  const user = users.find((u) => u.id === Number(c.req.param('id')))
  return user ? c.json(user) : c.json({ error: 'user not found' }, 404)
})

usersRouter.get('/:id/orders', (c) => {
  const id = Number(c.req.param('id'))
  return c.json(orders.filter((o) => o.userId === id))
})

usersRouter.post('/', async (c) => {
  const body = await c.req.json<{ name: string; email: string }>()
  const user = { id: users.length + 1, name: body.name, email: body.email }
  users.push(user)
  return c.json(user, 201)
})

usersRouter.put('/:id', async (c) => {
  const user = users.find((u) => u.id === Number(c.req.param('id')))
  if (!user) return c.json({ error: 'user not found' }, 404)
  const body = await c.req.json<Partial<{ name: string; email: string }>>()
  if (body.name) user.name = body.name
  if (body.email) user.email = body.email
  return c.json(user)
})

usersRouter.delete('/:id', (c) => {
  const index = users.findIndex((u) => u.id === Number(c.req.param('id')))
  if (index === -1) return c.json({ error: 'user not found' }, 404)
  users.splice(index, 1)
  return c.body(null, 204)
})
