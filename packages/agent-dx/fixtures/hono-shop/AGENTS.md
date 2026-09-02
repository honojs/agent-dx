# hono-shop-api

A shop JSON API built with Hono: users, products, orders, auth, and an admin area.

- The entry point is `src/index.ts`. It must keep exporting the Hono app as the default export.
- Routers live in `src/routes/` and are mounted in the entry point; shared middleware lives in `src/middleware/`.
- Dependencies are already installed.
- Run `npm run typecheck` to typecheck the project.
