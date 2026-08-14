import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/hosted-sync-r2/acceptance.test.ts'],
    environment: 'node',
  },
})
