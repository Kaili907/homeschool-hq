// The repository's root-app vitest project only includes src/, tests/ and
// scripts/. This wave's validator lives under curriculum-authoring/, so it
// carries its own config — the same pattern as
// scripts/study-production-local-smoke.vitest.config.mjs.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['curriculum-authoring/full-family-highschool-9-12/release/*.test.ts'],
    fileParallelism: false,
    maxWorkers: 1,
  },
})
