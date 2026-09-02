import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { requestId } from './middleware/request-id.js'
import { adminRouter } from './routes/admin.js'
import { authRouter } from './routes/auth.js'
import { ordersRouter } from './routes/orders.js'
import { productsRouter } from './routes/products.js'
import { usersRouter } from './routes/users.js'

const app = new Hono()

app.use(logger())
app.use(requestId)

app.get('/', (c) => c.json({ name: 'hono-shop-api', version: '0.1.0' }))
app.get('/health', (c) => c.json({ ok: true }))

app.route('/api/users', usersRouter)
app.route('/api/products', productsRouter)
app.route('/api/orders', ordersRouter)
app.route('/api/admin', adminRouter)
app.route('/auth', authRouter)

app.notFound((c) => c.json({ error: 'not found' }, 404))

export default app
