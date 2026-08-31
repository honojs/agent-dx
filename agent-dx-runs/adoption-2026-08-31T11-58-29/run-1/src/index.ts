import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'

// Types
interface User {
  id: number
  name: string
  email: string
  createdAt: string
}

interface CreateUserRequest {
  name: string
  email: string
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  timestamp: string
}

// Mock database
const users: Map<number, User> = new Map([
  [
    1,
    {
      id: 1,
      name: 'Alice Johnson',
      email: 'alice@example.com',
      createdAt: '2024-01-15T10:00:00Z',
    },
  ],
  [
    2,
    {
      id: 2,
      name: 'Bob Smith',
      email: 'bob@example.com',
      createdAt: '2024-02-20T14:30:00Z',
    },
  ],
])

let nextUserId = 3

// Initialize Hono app
const app = new Hono()

// Middleware: Logging
app.use('*', logger())

// Middleware: CORS
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
)

// Middleware: Custom error handler
app.onError((err, c) => {
  console.error('Error:', err)

  if (err instanceof HTTPException) {
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: err.message,
        timestamp: new Date().toISOString(),
      },
      err.status,
    )
  }

  return c.json<ApiResponse<null>>(
    {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    },
    500,
  )
})

// Routes

// Health check
app.get('/health', (c) => {
  return c.json(
    {
      success: true,
      data: { status: 'healthy', timestamp: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    },
    200,
  )
})

// Get all users
app.get('/api/users', (c) => {
  const allUsers = Array.from(users.values())

  return c.json<ApiResponse<User[]>>(
    {
      success: true,
      data: allUsers,
      timestamp: new Date().toISOString(),
    },
    200,
  )
})

// Get a single user by ID
app.get('/api/users/:id', (c) => {
  const id = parseInt(c.req.param('id'), 10)

  if (isNaN(id)) {
    throw new HTTPException(400, { message: 'Invalid user ID' })
  }

  const user = users.get(id)

  if (!user) {
    throw new HTTPException(404, { message: `User with ID ${id} not found` })
  }

  return c.json<ApiResponse<User>>(
    {
      success: true,
      data: user,
      timestamp: new Date().toISOString(),
    },
    200,
  )
})

// Create a new user
app.post('/api/users', async (c) => {
  let body: CreateUserRequest

  try {
    body = await c.req.json()
  } catch {
    throw new HTTPException(400, { message: 'Invalid JSON payload' })
  }

  // Validation
  if (!body.name || !body.email) {
    throw new HTTPException(400, { message: 'Name and email are required' })
  }

  if (!body.email.includes('@')) {
    throw new HTTPException(400, { message: 'Invalid email format' })
  }

  const newUser: User = {
    id: nextUserId++,
    name: body.name,
    email: body.email,
    createdAt: new Date().toISOString(),
  }

  users.set(newUser.id, newUser)

  return c.json<ApiResponse<User>>(
    {
      success: true,
      data: newUser,
      timestamp: new Date().toISOString(),
    },
    201,
  )
})

// Update a user
app.put('/api/users/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)

  if (isNaN(id)) {
    throw new HTTPException(400, { message: 'Invalid user ID' })
  }

  const user = users.get(id)
  if (!user) {
    throw new HTTPException(404, { message: `User with ID ${id} not found` })
  }

  let body: Partial<CreateUserRequest>
  try {
    body = await c.req.json()
  } catch {
    throw new HTTPException(400, { message: 'Invalid JSON payload' })
  }

  // Update fields
  if (body.name) user.name = body.name
  if (body.email) {
    if (!body.email.includes('@')) {
      throw new HTTPException(400, { message: 'Invalid email format' })
    }
    user.email = body.email
  }

  users.set(id, user)

  return c.json<ApiResponse<User>>(
    {
      success: true,
      data: user,
      timestamp: new Date().toISOString(),
    },
    200,
  )
})

// Delete a user
app.delete('/api/users/:id', (c) => {
  const id = parseInt(c.req.param('id'), 10)

  if (isNaN(id)) {
    throw new HTTPException(400, { message: 'Invalid user ID' })
  }

  const user = users.get(id)
  if (!user) {
    throw new HTTPException(404, { message: `User with ID ${id} not found` })
  }

  users.delete(id)

  return c.json<ApiResponse<null>>(
    {
      success: true,
      timestamp: new Date().toISOString(),
    },
    200,
  )
})

// 404 handler
app.notFound((c) => {
  return c.json<ApiResponse<null>>(
    {
      success: false,
      error: 'Not found',
      timestamp: new Date().toISOString(),
    },
    404,
  )
})

// Export for Cloudflare Workers
export default app
