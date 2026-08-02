import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '../../adaptive-tutor/study-engine/integration-labs/student-runtime/node_modules/@playwright/test/index.mjs'

const evidenceRoot = path.resolve(process.env.MATH_R1_EVIDENCE ?? '../evidence/final/browser')
const harnessDirectory = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  testDir: harnessDirectory,
  testMatch: 'tutor-math-r1.spec.mjs',
  workers: 1,
  retries: 0,
  timeout: 30_000,
  outputDir: path.join(evidenceRoot, 'playwright-output'),
  reporter: [
    ['line'],
    ['json', { outputFile: path.join(evidenceRoot, 'playwright-results.json') }],
  ],
  use: {
    baseURL: process.env.MATH_R1_BASE_URL ?? 'http://127.0.0.1:4174/',
    headless: true,
    viewport: { width: 1280, height: 900 },
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
  projects: [
    { name: 'bundled-chromium', use: { browserName: 'chromium' } },
    { name: 'edge', use: { browserName: 'chromium', channel: 'msedge' } },
    { name: 'chrome', use: { browserName: 'chromium', channel: 'chrome' } },
  ],
})
