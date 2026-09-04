import { Hono } from 'hono'
import { orders, products, users } from '../data.js'

const app = new Hono()

app.use('*', async (c, next) => {
  if (c.req.header('X-Admin-Key') !== 'letmein') {
    return c.json({ error: 'forbidden' }, 403)
  }
  await next()
})

app.get('/stats', (c) =>
  c.json({
    users: users.length,
    products: products.length,
    orders: orders.length,
  }),
)

app.get('/orders/pending', (c) =>
  c.json(orders.filter((o) => o.status === 'pending')),
)

app.post('/products/:id/restock', async (c) => {
  const product = products.find((p) => p.id === Number(c.req.param('id')))
  if (!product) return c.json({ error: 'product not found' }, 404)
  const body = await c.req.json<{ amount: number }>()
  product.stock += body.amount
  return c.json(product)
})

app.delete('/users/:id', (c) => {
  const index = users.findIndex((u) => u.id === Number(c.req.param('id')))
  if (index === -1) return c.json({ error: 'user not found' }, 404)
  users.splice(index, 1)
  return c.body(null, 204)
})

export default app
