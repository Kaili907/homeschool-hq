import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Standalone vitest project for the Grade 3/4 mathematics student-work corpus.
 *
 * The repository's root vitest config does not include this directory, so it
 * ships its own config rather than modifying shared configuration this
 * pipeline does not own — matching the pattern of the grades 5-12 sibling
 * pipeline's own tooling/vitest.config.mts.
 */
export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  test: {
    name: 'math-g34-student-work',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 240_000,
    hookTimeout: 240_000,
  },
})
