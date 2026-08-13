import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Standalone vitest project for the grades 3-8 Financial Literacy student-work
 * corpus. The repository root config only includes src/, tests/, scripts/,
 * supabase/, and netlify/, so this directory ships its own config rather than
 * modifying shared configuration it does not own. The production-readiness
 * gate under src/curriculum/production-quality is imported read-only.
 */
export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  test: {
    name: 'finlit-g38-student-work',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
