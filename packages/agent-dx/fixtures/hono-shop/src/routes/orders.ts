import { Hono } from 'hono'
import { orders, products, users } from '../data.js'

const app = new Hono()

app.get('/', (c) => {
  const status = c.req.query('status')
  if (status) {
    return c.json(orders.filter((o) => o.status === status))
  }
  return c.json(orders)
})

app.get('/:id', (c) => {
  const order = orders.find((o) => o.id === Number(c.req.param('id')))
  return order ? c.json(order) : c.json({ error: 'order not found' }, 404)
})

app.get('/:id/items', (c) => {
  const order = orders.find((o) => o.id === Number(c.req.param('id')))
  if (!order) return c.json({ error: 'order not found' }, 404)
  return c.json(products.filter((p) => order.productIds.includes(p.id)))
})

app.post('/', async (c) => {
  const body = await c.req.json<{ userId: number; productIds: number[] }>()
  if (!users.some((u) => u.id === body.userId)) {
    return c.json({ error: 'unknown user' }, 400)
  }
  const order = {
    id: orders.length + 1,
    userId: body.userId,
    productIds: body.productIds,
    status: 'pending' as const,
  }
  orders.push(order)
  return c.json(order, 201)
})

app.put('/:id/status', async (c) => {
  const order = orders.find((o) => o.id === Number(c.req.param('id')))
  if (!order) return c.json({ error: 'order not found' }, 404)
  const body = await c.req.json<{ status: typeof order.status }>()
  order.status = body.status
  return c.json(order)
})

app.delete('/:id', (c) => {
  const index = orders.findIndex((o) => o.id === Number(c.req.param('id')))
  if (index === -1) return c.json({ error: 'order not found' }, 404)
  orders.splice(index, 1)
  return c.body(null, 204)
})

export default app
