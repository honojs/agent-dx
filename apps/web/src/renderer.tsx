import { jsxRenderer } from 'hono/jsx-renderer'
import { Link, ViteClient } from 'vite-ssr-components/hono'
import { Layout } from './app.js'

export const renderer = jsxRenderer(({ children }) => (
  <Layout
    head={
      <>
        <ViteClient />
        <Link href='/src/style.css' rel='stylesheet' />
      </>
    }
  >
    {children}
  </Layout>
))
