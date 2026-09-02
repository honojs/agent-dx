import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { requestId } from './middleware/request-id.js'
import admin from './routes/admin.js'
import auth from './routes/auth.js'
import orders from './routes/orders.js'
import products from './routes/products.js'
import users from './routes/users.js'

const app = new Hono()

app.use(logger())
app.use(requestId)

app.get('/', (c) => c.json({ name: 'hono-shop-api', version: '0.1.0' }))
app.get('/health', (c) => c.json({ ok: true }))

app.route('/api/users', users)
app.route('/api/products', products)
app.route('/api/orders', orders)
app.route('/api/admin', admin)
app.route('/auth', auth)

app.notFound((c) => c.json({ error: 'not found' }, 404))

export default app
