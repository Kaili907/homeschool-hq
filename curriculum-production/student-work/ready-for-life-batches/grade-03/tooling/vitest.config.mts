import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Standalone vitest project for the Grade 3 Ready for Life batch. The
 * repository's root vitest config only includes src/, tests/, scripts/,
 * supabase/, and netlify/, so this directory ships its own config rather
 * than modifying shared configuration this branch does not own
 * (src/curriculum/production-quality is imported read-only).
 */
export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  test: {
    name: 'rfl-batch-grade-03',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
