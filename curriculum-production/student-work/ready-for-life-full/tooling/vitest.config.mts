import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Standalone vitest project for the full Ready for Life student-work corpus
 * (grades 3-12). The repository's root vitest config only includes src/,
 * tests/, scripts/, supabase/, and netlify/, so this directory ships its
 * own config rather than modifying shared configuration this branch does
 * not own (src/curriculum/production-quality is imported read-only).
 */
export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  test: {
    name: 'rfl-full-student-work',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
