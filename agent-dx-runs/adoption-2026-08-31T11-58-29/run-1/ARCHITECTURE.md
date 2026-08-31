# Architecture Overview

## Application Structure

```
cloudflare-workers-api/
├── src/
│   └── index.ts              # Main application file
├── package.json              # Project dependencies and scripts
├── tsconfig.json             # TypeScript compiler configuration
├── wrangler.toml             # Cloudflare Workers configuration
├── README.md                 # Full documentation
├── EXAMPLES.md               # Usage examples and recipes
├── ARCHITECTURE.md           # This file
└── .gitignore                # Git ignore rules
```

## Technology Stack

### Framework & Runtime

- **Hono** (v3.11.0) - Lightweight web framework optimized for edge computing
- **Cloudflare Workers** - Serverless execution environment on Cloudflare's global network
- **TypeScript** (v5.2.0) - Type-safe JavaScript development

### Development Tools

- **Wrangler** (v3.12.0) - Official Cloudflare Workers CLI
- **Node.js** - Local development runtime

## Core Components

### 1. Application Setup (`src/index.ts`)

The main application file contains:

#### Initialization

```typescript
const app = new Hono()
```

Creates a new Hono application instance that handles all routing and middleware.

#### Middleware Stack

1. **Logger Middleware** - Logs all incoming requests
2. **CORS Middleware** - Enables cross-origin requests
3. **Error Handler** - Catches and formats errors into JSON responses
4. **404 Handler** - Handles undefined routes

#### Route Handlers

- `GET /health` - Health check endpoint
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get a specific user
- `POST /api/users` - Create a new user
- `PUT /api/users/:id` - Update a user
- `DELETE /api/users/:id` - Delete a user

### 2. Data Layer

Uses an in-memory `Map<number, User>` for storing user data:

```typescript
const users: Map<number, User> = new Map()
```

**Note**: In production, replace with a real database (e.g., D1, Postgres, etc.)

### 3. Type System

TypeScript interfaces ensure type safety:

```typescript
interface User {
  id: number
  name: string
  email: string
  createdAt: string
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  timestamp: string
}
```

## Request/Response Flow

```
┌─────────────┐
│   Request   │
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│  Logger Middleware│
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  CORS Middleware │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Route Handler   │
│  - Validation    │
│  - Processing    │
│  - Response      │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Error Handler   │ (if error occurs)
│  (if needed)     │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│   JSON Response  │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│   Client         │
└──────────────────┘
```

## Middleware System

### Logger

Logs every request with method, path, and status. Built into Hono.

### CORS

Handles cross-origin requests for web, mobile, and third-party API clients.

### Error Handler

Catches errors and returns consistent JSON error responses:

```typescript
{
  "success": false,
  "error": "Error message",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

## API Response Format

All responses follow a consistent structure:

### Success

```json
{
  "success": true,
  "data": {/* resource or array */},
  "timestamp": "2024-01-15T10:00:00Z"
}
```

### Error

```json
{
  "success": false,
  "error": "Error description",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

## Validation Strategy

1. **Type Validation** - TypeScript ensures compile-time type safety
2. **Runtime Validation** - Request body validation in route handlers
3. **Error Handling** - HTTP exceptions with descriptive messages

### Validation Examples

- Email format validation (contains "@")
- Required fields validation (name, email)
- Type checking (ID must be numeric)
- Resource existence checking (404 if not found)

## Deployment Architecture

```
┌─────────────────────────────────────────┐
│      Your Local Machine                 │
│  ├─ npm run build  (TypeScript → JS)   │
│  └─ npm run deploy (Upload to CF)      │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│    Cloudflare Global Network            │
│  ├─ 200+ Data Centers                  │
│  ├─ Automatic Scaling                  │
│  ├─ Built-in DDoS Protection           │
│  └─ Instant Deployment                 │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│      Client Requests                    │
│  ├─ Routed to nearest data center      │
│  ├─ Low latency response                │
│  └─ Always available                    │
└─────────────────────────────────────────┘
```

## Performance Characteristics

- **Cold Start**: ~1ms (Workers are always warm)
- **Response Time**: <10ms typical (bare execution)
- **Memory**: ~1-5MB per Worker
- **Concurrency**: Unlimited (auto-scaling)
- **Cost**: Pay-as-you-go billing per request

## Extension Points

### Add a New Route

Edit `src/index.ts` and add a new route handler:

```typescript
app.get('/api/items', (c) => {
  // Your logic
})
```

### Add Custom Middleware

```typescript
app.use('/api/*', async (c, next) => {
  // Pre-processing
  await next()
  // Post-processing
})
```

### Connect to a Database

```typescript
const db = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
  .bind(id)
  .first()
```

### Use Environment Variables

```typescript
const apiKey = c.env.API_KEY
const dbUrl = c.env.DATABASE_URL
```

## Security Considerations

1. **CORS** - Configured to allow cross-origin requests (adjust for production)
2. **Input Validation** - All inputs validated before processing
3. **Error Messages** - Non-sensitive error messages returned to clients
4. **Type Safety** - TypeScript prevents many common vulnerabilities
5. **Secrets Management** - Use Wrangler secrets for sensitive data

## Next Steps for Production

1. Replace in-memory storage with a real database
2. Add authentication/authorization
3. Implement rate limiting
4. Add request/response logging
5. Set up monitoring and alerts
6. Configure custom domain
7. Enable analytics
