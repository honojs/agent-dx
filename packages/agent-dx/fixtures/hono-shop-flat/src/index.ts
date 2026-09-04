import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { requestId } from 'hono/request-id'
import { orders, products, users } from './data.js'

const sessions = new Map<string, number>()

const app = new Hono()

app.use(logger())
app.use(requestId())

app.get('/', (c) => c.json({ name: 'hono-shop-api', version: '0.1.0' }))
app.get('/health', (c) => c.json({ ok: true }))

// Users
app.get('/api/users', (c) => c.json(users))

app.get('/api/users/:id', (c) => {
  const user = users.find((u) => u.id === Number(c.req.param('id')))
  return user ? c.json(user) : c.json({ error: 'user not found' }, 404)
})

app.get('/api/users/:id/orders', (c) => {
  const id = Number(c.req.param('id'))
  return c.json(orders.filter((o) => o.userId === id))
})

app.post('/api/users', async (c) => {
  const body = await c.req.json<{ name: string; email: string }>()
  const user = { id: users.length + 1, name: body.name, email: body.email }
  users.push(user)
  return c.json(user, 201)
})

app.put('/api/users/:id', async (c) => {
  const user = users.find((u) => u.id === Number(c.req.param('id')))
  if (!user) return c.json({ error: 'user not found' }, 404)
  const body = await c.req.json<Partial<{ name: string; email: string }>>()
  if (body.name) user.name = body.name
  if (body.email) user.email = body.email
  return c.json(user)
})

app.delete('/api/users/:id', (c) => {
  const index = users.findIndex((u) => u.id === Number(c.req.param('id')))
  if (index === -1) return c.json({ error: 'user not found' }, 404)
  users.splice(index, 1)
  return c.body(null, 204)
})

// Products
app.get('/api/products', (c) => {
  const inStock = c.req.query('inStock')
  if (inStock === 'true') {
    return c.json(products.filter((p) => p.stock > 0))
  }
  return c.json(products)
})

app.get('/api/products/:id', (c) => {
  const product = products.find((p) => p.id === Number(c.req.param('id')))
  return product ? c.json(product) : c.json({ error: 'product not found' }, 404)
})

app.get('/api/products/:id/stock', (c) => {
  const product = products.find((p) => p.id === Number(c.req.param('id')))
  if (!product) return c.json({ error: 'product not found' }, 404)
  return c.json({ id: product.id, stock: product.stock })
})

app.post('/api/products', async (c) => {
  const body = await c.req.json<{ name: string; price: number }>()
  const product = {
    id: products.length + 1,
    name: body.name,
    price: body.price,
    stock: 0,
  }
  products.push(product)
  return c.json(product, 201)
})

app.put('/api/products/:id/stock', async (c) => {
  const product = products.find((p) => p.id === Number(c.req.param('id')))
  if (!product) return c.json({ error: 'product not found' }, 404)
  const body = await c.req.json<{ stock: number }>()
  product.stock = body.stock
  return c.json(product)
})

app.delete('/api/products/:id', (c) => {
  const index = products.findIndex((p) => p.id === Number(c.req.param('id')))
  if (index === -1) return c.json({ error: 'product not found' }, 404)
  products.splice(index, 1)
  return c.body(null, 204)
})

// Orders
app.get('/api/orders', (c) => {
  const status = c.req.query('status')
  if (status) {
    return c.json(orders.filter((o) => o.status === status))
  }
  return c.json(orders)
})

app.get('/api/orders/:id', (c) => {
  const order = orders.find((o) => o.id === Number(c.req.param('id')))
  return order ? c.json(order) : c.json({ error: 'order not found' }, 404)
})

app.get('/api/orders/:id/items', (c) => {
  const order = orders.find((o) => o.id === Number(c.req.param('id')))
  if (!order) return c.json({ error: 'order not found' }, 404)
  return c.json(products.filter((p) => order.productIds.includes(p.id)))
})

app.post('/api/orders', async (c) => {
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

app.put('/api/orders/:id/status', async (c) => {
  const order = orders.find((o) => o.id === Number(c.req.param('id')))
  if (!order) return c.json({ error: 'order not found' }, 404)
  const body = await c.req.json<{ status: (typeof orders)[number]['status'] }>()
  order.status = body.status
  return c.json(order)
})

app.delete('/api/orders/:id', (c) => {
  const index = orders.findIndex((o) => o.id === Number(c.req.param('id')))
  if (index === -1) return c.json({ error: 'order not found' }, 404)
  orders.splice(index, 1)
  return c.body(null, 204)
})

// Admin (guarded)
app.use('/api/admin/*', async (c, next) => {
  if (c.req.header('X-Admin-Key') !== 'letmein') {
    return c.json({ error: 'forbidden' }, 403)
  }
  await next()
})

app.get('/api/admin/stats', (c) =>
  c.json({
    users: users.length,
    products: products.length,
    orders: orders.length,
  }),
)

app.get('/api/admin/orders/pending', (c) =>
  c.json(orders.filter((o) => o.status === 'pending')),
)

app.post('/api/admin/products/:id/restock', async (c) => {
  const product = products.find((p) => p.id === Number(c.req.param('id')))
  if (!product) return c.json({ error: 'product not found' }, 404)
  const body = await c.req.json<{ amount: number }>()
  product.stock += body.amount
  return c.json(product)
})

app.delete('/api/admin/users/:id', (c) => {
  const index = users.findIndex((u) => u.id === Number(c.req.param('id')))
  if (index === -1) return c.json({ error: 'user not found' }, 404)
  users.splice(index, 1)
  return c.body(null, 204)
})

// Auth
app.post('/auth/login', async (c) => {
  const body = await c.req.json<{ email: string }>()
  const user = users.find((u) => u.email === body.email)
  if (!user) return c.json({ error: 'unknown email' }, 401)
  const token = `session-${user.id}-${sessions.size + 1}`
  sessions.set(token, user.id)
  return c.json({ token })
})

app.post('/auth/logout', async (c) => {
  const body = await c.req.json<{ token: string }>()
  sessions.delete(body.token)
  return c.json({ ok: true })
})

app.get('/auth/me', (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  const userId = token ? sessions.get(token) : undefined
  const user = users.find((u) => u.id === userId)
  return user ? c.json(user) : c.json({ error: 'not signed in' }, 401)
})

export default app
