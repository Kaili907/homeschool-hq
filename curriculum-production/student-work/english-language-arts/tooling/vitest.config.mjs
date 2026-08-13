import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Standalone vitest project for the ELA student-work corpus.
//
// The repository's root vitest config only includes src/, tests/, scripts/,
// supabase/, and netlify/ (see vite.config.ts), so this directory ships its
// own config rather than modifying shared configuration this branch does not
// own — same approach as curriculum-production/student-work/mathematics.
export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  test: {
    name: 'ela-student-work',
    include: ['tests/**/*.test.{ts,mjs}'],
    environment: 'node',
    testTimeout: 240_000,
    hookTimeout: 240_000,
  },
})
