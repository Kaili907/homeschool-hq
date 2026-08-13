import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Standalone vitest project for the grade-11 Financial Literacy completion
 * supplement. The repository's root config does not include
 * curriculum-production/, and this lane does not modify shared configuration it
 * does not own.
 */
export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  test: {
    name: 'finlit-g11-completion',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
  },
})
