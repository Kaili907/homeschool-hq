import { defineConfig } from 'vitest/config'

// Scoped to this directory deliberately: this release owns only
// curriculum-authoring/full-family-grade34/release/**, so its test runner
// config lives here instead of extending the shared root vite.config.ts.
// Run from the repo root: npx vitest run --config curriculum-authoring/full-family-grade34/release/vitest.config.mjs
export default defineConfig({
  test: {
    name: 'grade34-release',
    include: ['curriculum-authoring/full-family-grade34/release/*.test.ts'],
  },
})
