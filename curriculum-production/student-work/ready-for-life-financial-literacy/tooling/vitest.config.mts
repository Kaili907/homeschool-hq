import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Standalone vitest project for the Ready for Life / Financial Literacy
 * student-work corpus. The repository's root vitest config only includes
 * src/, tests/, scripts/, supabase/, and netlify/, so this directory ships
 * its own config rather than modifying shared configuration that this
 * branch does not own (this branch's src/curriculum/production-quality
 * gate is imported read-only, not modified).
 */
export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  test: {
    name: 'rfl-finlit-student-work',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
