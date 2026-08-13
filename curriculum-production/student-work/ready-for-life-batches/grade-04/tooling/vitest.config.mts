import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Standalone vitest project for this batch's grade-4 Ready for Life
 * student-work corpus. The repository's root vitest config only includes
 * src/, tests/, scripts/, supabase/, and netlify/, so this directory ships
 * its own config rather than modifying shared configuration this branch
 * does not own (src/curriculum/production-quality is imported read-only).
 * Mirrors the sibling ready-for-life-full/tooling/vitest.config.mts.
 */
export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  test: {
    name: 'rfl-batches-grade-04',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
