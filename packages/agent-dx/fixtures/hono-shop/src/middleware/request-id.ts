import { createMiddleware } from 'hono/factory'

let counter = 0

export const requestId = createMiddleware(async (c, next) => {
  counter += 1
  c.header('X-Request-Id', `req-${counter}`)
  await next()
})
