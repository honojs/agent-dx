# Quick Start Guide

## 1. Install Dependencies

```bash
npm install
```

## 2. Start Development Server

```bash
npm run dev
```

Your API will be available at `http://localhost:8787`

## 3. Test the API

### Health Check

```bash
curl http://localhost:8787/health
```

### Get All Users

```bash
curl http://localhost:8787/api/users
```

### Create a User

```bash
curl -X POST http://localhost:8787/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com"
  }'
```

### Get Specific User

```bash
curl http://localhost:8787/api/users/1
```

### Update a User

```bash
curl -X PUT http://localhost:8787/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith"
  }'
```

### Delete a User

```bash
curl -X DELETE http://localhost:8787/api/users/1
```

## 4. Build for Production

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

## 5. Deploy to Cloudflare

```bash
npm run deploy
```

You'll need:

- A Cloudflare account
- Wrangler CLI authenticated (`wrangler login`)
- A Cloudflare Workers project

## Key Features

✅ **RESTful API** - Full CRUD operations on users
✅ **TypeScript** - Complete type safety
✅ **Hono Framework** - Lightweight and fast
✅ **Middleware** - Logging, CORS, error handling
✅ **Validation** - Input validation and error responses
✅ **Type-safe Responses** - Consistent JSON format

## Project Files

- `src/index.ts` - Main application (251 lines)
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `wrangler.toml` - Cloudflare Workers config
- `README.md` - Full documentation
- `EXAMPLES.md` - Usage examples
- `ARCHITECTURE.md` - Architecture overview
- `.gitignore` - Git ignore rules

## Routes Available

| Method | Path           | Description     |
| ------ | -------------- | --------------- |
| GET    | /health        | Health check    |
| GET    | /api/users     | List all users  |
| GET    | /api/users/:id | Get user by ID  |
| POST   | /api/users     | Create new user |
| PUT    | /api/users/:id | Update user     |
| DELETE | /api/users/:id | Delete user     |

## Next Steps

1. Read `README.md` for full documentation
2. Check `EXAMPLES.md` for more usage examples
3. Review `ARCHITECTURE.md` for technical details
4. Modify `src/index.ts` to add your own routes
5. Deploy to Cloudflare Workers

## Troubleshooting

**Port already in use?**

```bash
npm run dev -- --port 3000
```

**TypeScript errors?**

```bash
npm run type-check
```

**Need to rebuild?**

```bash
npm run build
rm -rf dist
npm run build
```

For more help, see the full documentation in README.md
