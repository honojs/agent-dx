import fs from 'node:fs/promises'
import { toSSG } from 'hono/ssg'
import app from './app.js'

const result = await toSSG(app, fs, { dir: 'dist' })
if (!result.success) {
  console.error(result.error)
  process.exit(1)
}
console.log(`Generated: ${result.files?.join(', ')}`)
