import { createMiddleware } from 'hono/factory'
import { features } from '../config/flags.js'

/** Hide API sections whose feature flag is off. */
export const featureGate = createMiddleware(async (c, next) => {
  const [, , section] = c.req.path.split('/')
  if (section && features[section] === false) {
    return c.json({ error: 'not found' }, 404)
  }
  await next()
})
