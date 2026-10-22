import { Hono } from 'hono'
import { slowDown } from './slow.js'

type Todo = {
  id: number
  title: string
  done: boolean
}

const todos: Todo[] = [
  { id: 1, title: 'Write docs', done: false },
  { id: 2, title: 'Set up CI', done: true },
  { id: 3, title: 'Ship v1', done: false },
  { id: 4, title: 'Pick a name', done: true },
]

const app = new Hono()

app.get('/', (c) => c.json({ message: 'Todo API' }))

app.get('/api/todos', async (c) => {
  await slowDown()
  return c.json(todos)
})

app.post('/api/todos', async (c) => {
  const body = await c.req.json<{ title: string }>()
  const todo: Todo = { id: todos.length + 1, title: body.title, done: false }
  todos.push(todo)
  return c.json(todo, 201)
})

export default app
