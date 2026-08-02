/// <reference types="vitest/config" />

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'supabase/**/*.test.ts', 'tests/**/*.test.js'],
    pool: 'threads',
    maxWorkers: 4,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
  // fs.strict off: the dev server is launched via an 8.3 short path (spaces in the
  // real path), which Vite's default allow-list check doesn't recognize as the root.
  server: { port: 5173, strictPort: true, fs: { strict: false } },
})
