import { Hono } from 'hono'
import { orders, products, users } from '../data.js'

export const ordersRouter = new Hono()

ordersRouter.get('/orders', (c) => {
  const status = c.req.query('status')
  if (status) {
    return c.json(orders.filter((o) => o.status === status))
  }
  return c.json(orders)
})

ordersRouter.get('/orders/:id', (c) => {
  const order = orders.find((o) => o.id === Number(c.req.param('id')))
  return order ? c.json(order) : c.json({ error: 'order not found' }, 404)
})

ordersRouter.get('/orders/:id/items', (c) => {
  const order = orders.find((o) => o.id === Number(c.req.param('id')))
  if (!order) return c.json({ error: 'order not found' }, 404)
  return c.json(products.filter((p) => order.productIds.includes(p.id)))
})

ordersRouter.post('/orders', async (c) => {
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

ordersRouter.put('/orders/:id/status', async (c) => {
  const order = orders.find((o) => o.id === Number(c.req.param('id')))
  if (!order) return c.json({ error: 'order not found' }, 404)
  const body = await c.req.json<{ status: typeof order.status }>()
  order.status = body.status
  return c.json(order)
})

ordersRouter.delete('/orders/:id', (c) => {
  const index = orders.findIndex((o) => o.id === Number(c.req.param('id')))
  if (index === -1) return c.json({ error: 'order not found' }, 404)
  orders.splice(index, 1)
  return c.body(null, 204)
})
