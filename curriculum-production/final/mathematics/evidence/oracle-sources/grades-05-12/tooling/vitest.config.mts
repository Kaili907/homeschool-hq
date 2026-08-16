import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Standalone vitest project for the mathematics student-work corpus.
 *
 * The repository's root vitest config only includes src/, tests/, scripts/,
 * supabase/, and netlify/, so this directory ships its own config rather than
 * modifying shared configuration that this branch does not own.
 */
export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  test: {
    name: 'math-student-work',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 240_000,
    hookTimeout: 240_000,
  },
})
