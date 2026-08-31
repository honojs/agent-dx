# API Usage Examples

## Running the Application

### Local Development

```bash
npm install
npm run dev
```

The API will be available at `http://localhost:8787`

### Production Deployment

```bash
npm run build
npm run deploy
```

## Example Requests

### 1. Check Health Status

```bash
curl http://localhost:8787/health
```

### 2. Fetch All Users

```bash
curl http://localhost:8787/api/users
```

### 3. Fetch a Specific User

```bash
curl http://localhost:8787/api/users/1
```

### 4. Create a New User

```bash
curl -X POST http://localhost:8787/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Diana Prince",
    "email": "diana@example.com"
  }'
```

### 5. Update an Existing User

```bash
curl -X PUT http://localhost:8787/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Johnson Updated",
    "email": "alice.new@example.com"
  }'
```

### 6. Delete a User

```bash
curl -X DELETE http://localhost:8787/api/users/1
```

## JavaScript/TypeScript Examples

### Fetch all users in a browser or Node.js app

```typescript
const response = await fetch('http://localhost:8787/api/users')
const data = await response.json()
console.log(data)
```

### Create a new user

```typescript
const response = await fetch('http://localhost:8787/api/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Eve Wilson',
    email: 'eve@example.com',
  }),
})

const newUser = await response.json()
console.log(newUser)
```

### Update a user

```typescript
const userId = 1
const response = await fetch(`http://localhost:8787/api/users/${userId}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Updated Name',
    email: 'newemail@example.com',
  }),
})

const updatedUser = await response.json()
console.log(updatedUser)
```

### Delete a user

```typescript
const userId = 1
const response = await fetch(`http://localhost:8787/api/users/${userId}`, {
  method: 'DELETE',
})

const result = await response.json()
console.log(result)
```

## Response Format

All responses follow a consistent format:

### Success Response

```json
{
  "success": true,
  "data": {/* payload */},
  "timestamp": "2024-01-15T10:00:00Z"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

## HTTP Status Codes

- `200 OK` - Successful GET, PUT, or DELETE
- `201 Created` - Successful POST (resource created)
- `400 Bad Request` - Invalid input or malformed request
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

## Error Cases

### Missing Required Fields

```bash
curl -X POST http://localhost:8787/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User"}'
```

Response (400):

```json
{
  "success": false,
  "error": "Name and email are required",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

### Invalid Email Format

```bash
curl -X POST http://localhost:8787/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "email": "not-an-email"}'
```

Response (400):

```json
{
  "success": false,
  "error": "Invalid email format",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

### User Not Found

```bash
curl http://localhost:8787/api/users/999
```

Response (404):

```json
{
  "success": false,
  "error": "User with ID 999 not found",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

## Adding New Features

### Add a New Route

Edit `src/index.ts` and add:

```typescript
app.get('/api/status', (c) => {
  return c.json({
    success: true,
    data: { status: 'operational' },
    timestamp: new Date().toISOString(),
  })
})
```

### Add Custom Middleware

```typescript
app.use('/api/*', async (c, next) => {
  console.log(`API request: ${c.req.method} ${c.req.path}`)
  await next()
})
```

### Add Request Body Validation

```typescript
import { validator } from 'hono/validator'

app.post(
  '/api/users',
  validator('json', (value) => {
    if (!value.name || typeof value.name !== 'string') {
      return false
    }
    return true
  }),
  (c) => {
    // Handler code
  },
)
```

## Environment Variables

To use environment variables with Cloudflare Workers, add them to `wrangler.toml`:

```toml
[env.production]
vars = { DATABASE_URL = "https://example.com/db" }
```

Then access them in your code:

```typescript
const dbUrl = c.env.DATABASE_URL
```
