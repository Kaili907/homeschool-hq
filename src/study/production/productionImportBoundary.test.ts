import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const sourceRoot = resolve(here, '..', '..')

describe('production Study import boundary', () => {
  it('does not statically import preview ports or the sentinel runtime from either root boundary', () => {
    const app = readFileSync(join(sourceRoot, 'App.tsx'), 'utf8')
    const legacyApp = readFileSync(join(sourceRoot, 'LegacyApp.tsx'), 'utf8')
    expect(app).not.toMatch(/from ['"]\.\/study\/(?:localDevelopmentPorts|mountedPorts)['"]/)
    expect(app).not.toMatch(/from ['"]\.\/components\/study\/StudySessionRoute['"]/)
    expect(app).toContain("import('./LegacyApp')")
    expect(legacyApp).not.toMatch(/from ['"]\.\/study\/(?:localDevelopmentPorts|mountedPorts)['"]/)
    expect(legacyApp).not.toMatch(/from ['"]\.\/components\/study\/StudySessionRoute['"]/)
    expect(legacyApp).toContain('import.meta.env.DEV')
    expect(legacyApp).toContain("import('./study/mountedPorts')")
  })

  it('keeps local, memory, test, preview, synthetic and sentinel identifiers out of the production root', () => {
    const productionText = readdirSync(here)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .map((name) => readFileSync(join(here, name), 'utf8'))
      .join('\n')
    expect(productionText).not.toMatch(/localDevelopmentPorts|memory-store|test provider|learner:local-release-candidate/i)
  })
})
