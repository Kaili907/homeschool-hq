import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))

export default defineConfig({
  root,
  cacheDir: resolve(root, '../../../node_modules/.vite-rfl-production'),
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
