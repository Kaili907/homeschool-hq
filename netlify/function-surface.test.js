import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  ALLOWED_NETLIFY_FUNCTIONS,
  inspectNetlifyFunctionSurface,
} from '../scripts/audit-web-release/lib.mjs'

describe('Netlify callable function surface', () => {
  it('configures a dedicated entrypoint directory outside production modules and tests', async () => {
    const config = await readFile('netlify.toml', 'utf8')
    expect(config).toMatch(/^\s*functions = "netlify\/function-entrypoints"\s*$/m)
  })

  it('contains exactly the reviewed production-function allowlist', async () => {
    const surface = inspectNetlifyFunctionSurface('netlify/function-entrypoints')
    expect(surface.findings).toEqual([])
    expect(surface.forbiddenEntries).toEqual([])
    expect(surface.callable).toEqual([...ALLOWED_NETLIFY_FUNCTIONS].sort())
  })

  it('keeps entrypoints as handler-only delegates to non-entrypoint production modules', async () => {
    for (const name of ALLOWED_NETLIFY_FUNCTIONS) {
      const source = await readFile(`netlify/function-entrypoints/${name}.js`, 'utf8')
      expect(source.trim()).toBe(`export { handler } from '../functions/${name}.js'`)
    }
  })
})
