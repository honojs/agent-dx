# Cloudflare Workers JSON API

A lightweight, TypeScript-based JSON API built with [Hono](https://hono.dev/) and deployed on Cloudflare Workers.

## Features

- ✅ **TypeScript** - Full type safety and IDE support
- ✅ **Hono Framework** - Lightweight and edge-computing optimized
- ✅ **RESTful API** - CRUD operations on users
- ✅ **Middleware** - Logging, CORS, error handling
- ✅ **Validation** - Request validation and error responses
- ✅ **Type-safe Responses** - Consistent API response format

## Project Structure

```
├── src/
│   └── index.ts          # Main application and routes
├── wrangler.toml         # Cloudflare Workers configuration
├── tsconfig.json         # TypeScript configuration
├── package.json          # Dependencies and scripts
└── README.md             # This file
```

## Setup

1. **Install dependencies** (if needed):

   ```bash
   npm install
   ```

2. **Type checking**:

   ```bash
   npm run type-check
   ```

3. **Build**:
   ```bash
   npm run build
   ```

## Development

Run the development server locally:

```bash
npm run dev
```

This starts a local server at `http://localhost:8787`

## Deployment

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

## API Endpoints

### Health Check

- **GET** `/health`

  Returns the API health status.

  Response:

  ```json
  {
    "success": true,
    "data": {
      "status": "healthy",
      "timestamp": "2024-01-15T10:00:00Z"
    },
    "timestamp": "2024-01-15T10:00:00Z"
  }
  ```

### Get All Users

- **GET** `/api/users`

  Returns a list of all users.

  Response (200):

  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "name": "Alice Johnson",
        "email": "alice@example.com",
        "createdAt": "2024-01-15T10:00:00Z"
      },
      {
        "id": 2,
        "name": "Bob Smith",
        "email": "bob@example.com",
        "createdAt": "2024-02-20T14:30:00Z"
      }
    ],
    "timestamp": "2024-01-15T10:00:00Z"
  }
  ```

### Get User by ID

- **GET** `/api/users/:id`

  Returns a specific user.

  Response (200):

  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "name": "Alice Johnson",
      "email": "alice@example.com",
      "createdAt": "2024-01-15T10:00:00Z"
    },
    "timestamp": "2024-01-15T10:00:00Z"
  }
  ```

  Error (404):

  ```json
  {
    "success": false,
    "error": "User with ID 999 not found",
    "timestamp": "2024-01-15T10:00:00Z"
  }
  ```

### Create User

- **POST** `/api/users`

  Creates a new user.

  Request:

  ```json
  {
    "name": "Charlie Brown",
    "email": "charlie@example.com"
  }
  ```

  Response (201):

  ```json
  {
    "success": true,
    "data": {
      "id": 3,
      "name": "Charlie Brown",
      "email": "charlie@example.com",
      "createdAt": "2024-01-15T10:00:00Z"
    },
    "timestamp": "2024-01-15T10:00:00Z"
  }
  ```

  Error (400):

  ```json
  {
    "success": false,
    "error": "Name and email are required",
    "timestamp": "2024-01-15T10:00:00Z"
  }
  ```

### Update User

- **PUT** `/api/users/:id`

  Updates an existing user.

  Request:

  ```json
  {
    "name": "Alice Updated",
    "email": "alice.updated@example.com"
  }
  ```

  Response (200):

  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "name": "Alice Updated",
      "email": "alice.updated@example.com",
      "createdAt": "2024-01-15T10:00:00Z"
    },
    "timestamp": "2024-01-15T10:00:00Z"
  }
  ```

### Delete User

- **DELETE** `/api/users/:id`

  Deletes a user.

  Response (200):

  ```json
  {
    "success": true,
    "timestamp": "2024-01-15T10:00:00Z"
  }
  ```

## Middleware

### Logging

Logs all incoming requests with method, path, and status code.

### CORS

Enables CORS for all origins with support for common HTTP methods and headers.

### Error Handling

Catches and formats all errors into consistent JSON responses with appropriate HTTP status codes.

## Testing with cURL

```bash
# Health check
curl http://localhost:8787/health

# Get all users
curl http://localhost:8787/api/users

# Get a specific user
curl http://localhost:8787/api/users/1

# Create a new user
curl -X POST http://localhost:8787/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "New User", "email": "new@example.com"}'

# Update a user
curl -X PUT http://localhost:8787/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name"}'

# Delete a user
curl -X DELETE http://localhost:8787/api/users/1
```

## Technologies

- **Hono** - Lightweight web framework for edge computing
- **TypeScript** - Type-safe JavaScript
- **Cloudflare Workers** - Edge computing platform
- **Wrangler** - Cloudflare Workers CLI

## License

MIT
