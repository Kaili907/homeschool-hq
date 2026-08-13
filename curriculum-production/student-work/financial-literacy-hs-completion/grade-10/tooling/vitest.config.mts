import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Standalone vitest project for the grade 10 Financial Literacy completion
 * lane. It does not modify shared configuration it does not own, and it does
 * not run the sibling lanes' tests.
 */
export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  test: {
    name: 'finlit-hs-completion-grade-10',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
  },
})
