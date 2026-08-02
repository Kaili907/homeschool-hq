import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/schedule-recovery/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: false,
    sequence: {
      concurrent: false,
    },
  },
})
