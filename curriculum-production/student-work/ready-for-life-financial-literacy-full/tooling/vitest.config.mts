import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Standalone vitest project for the full-coverage RFL/FinLit feasibility
 * evidence, mirroring the 24-lesson slice's tooling rather than modifying
 * shared configuration this branch does not own.
 */
export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  test: {
    name: 'rfl-finlit-full',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
  },
})
