import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Frozen Tutor Core and subject packages own Node-native test runners. Keep
  // the host Vitest gate scoped to host-owned suites so neither package is
  // reinterpreted as an empty Vitest suite; each package runs its own checks.
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.js', 'supabase/**/*.test.ts'],
  },
  // fs.strict off: the dev server is launched via an 8.3 short path (spaces in the
  // real path), which Vite's default allow-list check doesn't recognize as the root.
  server: { port: 5173, strictPort: true, fs: { strict: false } },
})
