import { Hono } from 'hono'
import { products } from '../data.js'

export const productsRouter = new Hono()

productsRouter.get('/', (c) => {
  const inStock = c.req.query('inStock')
  if (inStock === 'true') {
    return c.json(products.filter((p) => p.stock > 0))
  }
  return c.json(products)
})

productsRouter.get('/:id', (c) => {
  const product = products.find((p) => p.id === Number(c.req.param('id')))
  return product ? c.json(product) : c.json({ error: 'product not found' }, 404)
})

productsRouter.get('/:id/stock', (c) => {
  const product = products.find((p) => p.id === Number(c.req.param('id')))
  if (!product) return c.json({ error: 'product not found' }, 404)
  return c.json({ id: product.id, stock: product.stock })
})

productsRouter.post('/', async (c) => {
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

productsRouter.put('/:id/stock', async (c) => {
  const product = products.find((p) => p.id === Number(c.req.param('id')))
  if (!product) return c.json({ error: 'product not found' }, 404)
  const body = await c.req.json<{ stock: number }>()
  product.stock = body.stock
  return c.json(product)
})

productsRouter.delete('/:id', (c) => {
  const index = products.findIndex((p) => p.id === Number(c.req.param('id')))
  if (index === -1) return c.json({ error: 'product not found' }, 404)
  products.splice(index, 1)
  return c.body(null, 204)
})
