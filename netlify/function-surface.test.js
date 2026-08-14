import { readFile, readdir } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const CALLABLE_ALLOWLIST = Object.freeze([
  'admin-access',
  'admin-audit',
  'admin-authorization',
  'admin-configuration',
  'admin-correlations',
  'admin-costs',
  'admin-curriculum',
  'admin-engine-performance',
  'admin-health',
  'admin-learners',
  'admin-overview',
  'admin-production-readiness',
  'admin-provider-pricing-terms',
  'admin-safety-operations',
  'admin-study-operations',
  'anthropic',
  'production-item-assessment',
  'study-academic-runtime',
  'study-adult-review',
  'study-adult-review-deliver',
  'study-adult-review-health',
  'study-adult-review-scheduled-worker',
  'study-adult-review-worker',
  'study-bound-content',
  'study-parent-notifications',
  'study-production-readiness',
  'study-safety-classify',
  'study-session-issue',
  'study-session-telemetry-deliver',
  'study-session-verify',
  'tts',
])

describe('Netlify callable function surface', () => {
  it('configures a dedicated entrypoint directory outside production modules and tests', async () => {
    const config = await readFile('netlify.toml', 'utf8')
    expect(config).toMatch(/^\s*functions = "netlify\/function-entrypoints"\s*$/m)
  })

  it('contains exactly the reviewed production-function allowlist', async () => {
    const entries = (await readdir('netlify/function-entrypoints'))
      .filter((name) => name.endsWith('.js'))
      .map((name) => name.slice(0, -3))
      .sort()
    expect(entries).toEqual([...CALLABLE_ALLOWLIST].sort())
    expect(entries.filter((name) => /(?:test|fixture|resolver|helper|debug)/i.test(name))).toEqual([])
  })

  it('keeps entrypoints as handler-only delegates to non-entrypoint production modules', async () => {
    for (const name of CALLABLE_ALLOWLIST) {
      const source = await readFile(`netlify/function-entrypoints/${name}.js`, 'utf8')
      expect(source.trim()).toBe(`export { handler } from '../functions/${name}.js'`)
    }
  })
})
