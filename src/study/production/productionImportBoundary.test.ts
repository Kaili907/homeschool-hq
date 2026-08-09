import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const sourceRoot = resolve(here, '..', '..')

describe('production Study import boundary', () => {
  it('does not statically import preview ports or the sentinel runtime from App', () => {
    const app = readFileSync(join(sourceRoot, 'App.tsx'), 'utf8')
    expect(app).not.toMatch(/from ['"]\.\/study\/(?:localDevelopmentPorts|mountedPorts)['"]/)
    expect(app).not.toMatch(/from ['"]\.\/components\/study\/StudySessionRoute['"]/)
    expect(app).toContain('import.meta.env.DEV')
    expect(app).toContain("import('./study/mountedPorts')")
  })

  /**
   * STUDY-A1-F4-PARSE-BEFORE-HOST-C Phase 13 — a regression tripwire, and only
   * that. It is not a proof: it reads text, so a determined edit can route
   * around it. What it catches is the realistic regression — someone
   * reintroducing the branded type to "tidy up" the `unknown` parameter, which
   * is exactly how the host would start trusting a compile-time fact again.
   *
   * The host's dependency should be `unknown -> canonical parser`, and the
   * three assertions below say that in the three ways it could be undone: the
   * type reappearing anywhere, the parser import going away, and the parameter
   * widening back off `unknown`.
   */
  it('keeps the branded result type out of the production Study host', () => {
    const container = readFileSync(join(sourceRoot, 'components', 'study', 'StudySessionContainer.tsx'), 'utf8')
    // The host names the branded type nowhere — not as an import, not as an
    // annotation, and not in an assertion.
    expect(container).not.toContain('ValidatedStudyTutorResult')
    // It depends on the canonical parser instead, as a VALUE import.
    expect(container).toContain('acceptStudyTutorResult')
    expect(container).toContain('const result = acceptStudyTutorResult(raw)')
    // And the one ingestion edge still takes untrusted input.
    expect(container).toContain('function acceptedTurnResult(raw: unknown)')
  })

  it('keeps local, memory, test, preview, synthetic and sentinel identifiers out of the production root', () => {
    const productionText = readdirSync(here)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .map((name) => readFileSync(join(here, name), 'utf8'))
      .join('\n')
    expect(productionText).not.toMatch(/localDevelopmentPorts|memory-store|test provider|learner:local-release-candidate/i)
  })
})
