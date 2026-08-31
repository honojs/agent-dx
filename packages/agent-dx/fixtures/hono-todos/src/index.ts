import { Hono } from 'hono'
import { logger } from 'hono/logger'

type Todo = {
  id: number
  title: string
  done: boolean
}

const todos: Todo[] = [
  { id: 1, title: 'Write docs', done: false },
  { id: 2, title: 'Ship v1', done: false },
]

const api = new Hono()

api.get('/api/todos', (c) => c.json(todos))

api.post('/api/todos', async (c) => {
  const body = await c.req.json<{ title: string }>()
  const todo: Todo = { id: todos.length + 1, title: body.title, done: false }
  todos.push(todo)
  return c.json(todo, 201)
})

const app = new Hono()

app.use(logger())

app.get('/', (c) => c.json({ message: 'Todo API' }))

app.route('/api', api)

export default app
