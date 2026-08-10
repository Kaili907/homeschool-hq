/// <reference types="vitest/config" />

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { frozenPackageAliases } from './scripts/frozen-package-aliases.mjs'

export const viteConfig = defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Frozen Math R1 subject package, consumed through the study runtime's
    // subject registry (see adaptive-tutor/study-engine/runtime/src/frozen-math-r1.d.ts).
    // Declared in ./scripts/frozen-package-aliases.mjs so the server build
    // resolves the specifier to the same file this one does.
    alias: frozenPackageAliases,
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'root-app',
          include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.js'],
          pool: 'threads',
          maxWorkers: 4,
          testTimeout: 120_000,
          hookTimeout: 120_000,
          sequence: { groupOrder: 1 },
        },
      },
      {
        extends: true,
        test: {
          name: 'root-supabase',
          include: ['supabase/**/*.test.ts'],
          // Embedded database tests exhaust Node when several start together.
          maxWorkers: 1,
          fileParallelism: false,
          testTimeout: 120_000,
          hookTimeout: 120_000,
          sequence: { groupOrder: 2 },
        },
      },
      {
        extends: true,
        test: {
          name: 'netlify-functions',
          environment: 'node',
          include: ['netlify/**/*.test.{js,mjs,ts}'],
          maxWorkers: 4,
          sequence: { groupOrder: 3 },
          // Server handlers fail closed when this deploy-time gate is absent.
          // The test project intentionally supplies the enabled test setting.
          env: { ACADEMY_STUDY_ENABLED: 'true' },
        },
      },
    ],
  },
  // fs.strict off: the dev server is launched via an 8.3 short path (spaces in the
  // real path), which Vite's default allow-list check doesn't recognize as the root.
  server: { port: 5173, strictPort: true, fs: { strict: false } },
})

export default viteConfig
