import { jsxRenderer } from 'hono/jsx-renderer'
import { ViteClient } from 'vite-ssr-components/hono'
import { Layout } from './app.js'

export const renderer = jsxRenderer(({ children }) => (
  <Layout head={<ViteClient />}>{children}</Layout>
))
