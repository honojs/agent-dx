import type { PracticalCheck } from '../../../schema.js'
import { runCheckScript, typecheckCheck } from '../grading.js'
import type { PracticalTask } from '../task.js'

/**
 * Task: build a shop API from scratch against an executable acceptance
 * spec. The request carries the spec as batch JSONL lines (one request
 * per line, `expect` = the required response, `save` captures a field
 * for later `{{id}}` placeholders) — the form that turned out to be the
 * best-performing way to hand an agent a contract.
 *
 * The prompt never names a tool: how the agent runs the spec (a
 * hand-rolled script, a server, or `hono batch`) is what we measure.
 */

const SPEC_JSONL = [
  '{"method":"POST","path":"/api/products","body":{"name":"Mug","price":12,"stock":3},"save":{"id":".id"},"expect":{"status":201}}',
  '{"method":"POST","path":"/api/products","body":{"name":"x"},"expect":{"status":400}}',
  '{"path":"/api/products","expect":{"status":200}}',
  '{"path":"/api/products/{{id}}","expect":{"status":200}}',
  '{"method":"POST","path":"/api/cart/items","body":{"productId":"{{id}}","quantity":2},"expect":{"status":201}}',
  '{"method":"POST","path":"/api/cart/items","body":{"productId":"{{id}}","quantity":999},"expect":{"status":400}}',
  '{"method":"POST","path":"/api/cart/items","body":{"productId":424242,"quantity":1},"expect":{"status":404}}',
  '{"path":"/api/cart","expect":{"status":200}}',
  '{"method":"POST","path":"/api/checkout","expect":{"status":200}}',
  '{"path":"/api/products/{{id}}","expect":{"status":200,"body":{"stock":1}}}',
  '{"method":"POST","path":"/api/checkout","expect":{"status":400}}',
].join('\n')

const CHECK_SCRIPT = `
const checks = []
const add = (name, passed, detail) => checks.push(detail ? { name, passed, detail } : { name, passed })
const json = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const status = async (res, expected, name) => add(name, res.status === expected, 'status ' + res.status)
try {
  const { default: app } = await import('../src/index.ts')
  const created = await app.request('/api/products', json({ name: 'Mug', price: 12, stock: 3 }))
  await status(created, 201, 'POST /api/products creates (201)')
  let id = 1
  try {
    id = (await created.json()).id ?? 1
  } catch {}
  await status(await app.request('/api/products', json({ name: 'x' })), 400, 'POST /api/products rejects invalid bodies')
  await status(await app.request('/api/products'), 200, 'GET /api/products lists')
  await status(await app.request('/api/products/' + id), 200, 'GET /api/products/:id works')
  await status(await app.request('/api/cart/items', json({ productId: id, quantity: 2 })), 201, 'POST /api/cart/items adds (201)')
  await status(await app.request('/api/cart/items', json({ productId: id, quantity: 999 })), 400, 'cart add rejects quantity over stock')
  await status(await app.request('/api/cart/items', json({ productId: 424242, quantity: 1 })), 404, 'cart add 404s unknown product')
  const cart = await app.request('/api/cart')
  let total = false
  try {
    total = cart.status === 200 && typeof (await cart.json()).total === 'number'
  } catch {}
  add('GET /api/cart returns items with a total', total, 'status ' + cart.status)
  await status(await app.request('/api/checkout', { method: 'POST' }), 200, 'POST /api/checkout works (200)')
  let stockDown = false
  try {
    stockDown = (await (await app.request('/api/products/' + id)).json()).stock === 1
  } catch {}
  add('checkout decrements stock', stockDown)
  await status(await app.request('/api/checkout', { method: 'POST' }), 400, 'checkout 400s on an empty cart')
} catch (error) {
  add('app is importable from src/index.ts', false, String(error))
}
console.log('__AGENT_DX__' + JSON.stringify(checks))
`

async function grade(workspace: string): Promise<PracticalCheck[]> {
  return [await typecheckCheck(workspace), ...(await runCheckScript(workspace, CHECK_SCRIPT))]
}

export const buildShopTask: PracticalTask = {
  id: 'build-shop',
  description: 'Build a shop API from scratch against an executable acceptance spec',
  fixture: 'hono-fresh',
  prompt: [
    'Build a small shop API in this project:',
    '- Products: GET /api/products (list), GET /api/products/:id, POST /api/products (name, price, stock required; reject invalid bodies with 400).',
    '- Cart: POST /api/cart/items adds {productId, quantity} (404 unknown product, 400 quantity over stock), GET /api/cart returns items with a total, DELETE /api/cart/items/:productId removes one.',
    '- Checkout: POST /api/checkout empties the cart, decrements product stock, returns an order summary; 400 when the cart is empty.',
    'The acceptance spec is the following lines, one request per line in order: `expect` is the required response, and `save` captures a field from the response for later `{{id}}` placeholders. Keep working until every line holds:',
    SPEC_JSONL,
  ].join('\n'),
  grade,
}
