import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { code } from '../testing/importClosure'

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
   *
   * STUDY-A1-PRODUCTION-SAFE-CONTAINER — the crossing moved from the container
   * body to the production Tutor seam, which is the only module that ingests a
   * production Tutor's result. It did not multiply: the assertion below that it
   * has exactly one call site is the part of this test that the move made
   * necessary.
   */
  it('keeps the branded result type out of the production Study host', () => {
    const hostDirectory = join(sourceRoot, 'components', 'study')
    const seam = readFileSync(join(hostDirectory, 'productionTutorSeam.ts'), 'utf8')
    // The host names the branded type nowhere — not as an import, not as an
    // annotation, and not in an assertion.
    expect(seam).not.toContain('ValidatedStudyTutorResult')
    // It depends on the canonical parser instead, as a VALUE import.
    expect(seam).toContain('acceptStudyTutorResult')
    expect(seam).toContain('const result = acceptStudyTutorResult(raw)')
    // And the one ingestion edge still takes untrusted input.
    expect(seam).toContain('function acceptedTurnResult(raw: unknown)')

    // ONE crossing across the whole Study host, and one caller of it. A second
    // normalizer somewhere in this directory is how a production result would
    // start reaching the durable branches without being reparsed.
    //
    // Scanned on the comment-stripped form: the shared body explains in prose
    // WHY the crossing is not in it, and that explanation is the documentation,
    // not the violation.
    const hostFiles = readdirSync(hostDirectory)
      .filter((name) => (name.endsWith('.ts') || name.endsWith('.tsx')) && !name.includes('.test.'))
    const crossings = hostFiles.filter((name) =>
      code(readFileSync(join(hostDirectory, name), 'utf8')).includes('acceptStudyTutorResult'))
    expect(crossings).toEqual(['productionTutorSeam.ts'])
    // Declared once and called once — two occurrences in the seam's code and no
    // more, so there is no second path into the durable branches that skips it.
    expect(code(seam).match(/function acceptedTurnResult\(raw: unknown\)/g)).toHaveLength(1)
    expect(code(seam).match(/\bacceptedTurnResult\b/g)).toHaveLength(2)

    // The branded type stays out of the shared body and out of both wrappers
    // too, not just out of the seam — that is where a "tidy up" would put it.
    // Raw text here rather than comment-stripped, and deliberately: the parser
    // is a call the host must make exactly once, but the branded type is a name
    // the host must not carry at all, so mentioning it anywhere is the signal.
    for (const name of hostFiles) {
      expect(readFileSync(join(hostDirectory, name), 'utf8')).not.toContain('ValidatedStudyTutorResult')
    }
  })

  /**
   * STUDY-A1-PRODUCTION-SAFE-CONTAINER — the HARD RULE, as a test.
   *
   * The card's constraint is not "a production container exists"; it is that
   * creating one did NOT create a second copy of the rules that protect a child.
   * A preview copy and a production copy of the safety-stop write would agree on
   * the day they were written and diverge silently afterwards, and the
   * divergence would only be visible at the moment it mattered.
   *
   * Each name below is one of those rules. `cancel('safety-stop')` rather than
   * `lifecycle.cancel(` because the route and App legitimately cancel the epoch
   * for navigation, learner switch and authorization loss — it is the
   * safety-stop cancellation specifically that must exist once.
   */
  it('keeps the safety-critical session body in exactly one file', () => {
    const hostDirectory = join(sourceRoot, 'components', 'study')
    const hostFiles = readdirSync(hostDirectory)
      .filter((name) => (name.endsWith('.ts') || name.endsWith('.tsx')) && !name.includes('.test.'))
    const SHARED_ONCE: readonly { readonly call: string; readonly rule: string }[] = [
      { call: 'settleStudyTutorLaunch', rule: 'HOST_AWAIT: the launch is awaited before anything durable' },
      { call: 'prepareDurableStudySession', rule: 'HOST_AWAIT: the durable preparation set behind the witness' },
      { call: 'recordLocalSessionSafetyStop', rule: 'safety-stop mapping: the durable ledger write' },
      { call: "cancel('safety-stop')", rule: 'safety-stop mapping: the lifecycle cancellation' },
      { call: 'isSessionStoppedByLocalLedger', rule: 'safety-stop mapping: the durable stop lock' },
      { call: 'interruptionMessage', rule: 'interruption mapping' },
      { call: 'saveSession(', rule: 'privacy: what a durable session row may carry' },
      { call: 'assertCompleteStudyPortBundle', rule: 'the port completeness gate' },
    ]
    for (const { call, rule } of SHARED_ONCE) {
      const owners = hostFiles.filter((name) => code(readFileSync(join(hostDirectory, name), 'utf8')).includes(call))
      // Reported as an object so a failure names the rule, not just a filename.
      expect({ rule, owners }).toEqual({ rule, owners: ['studySessionSurface.tsx'] })
    }
    // And both wrappers RENDER that body rather than reimplementing it — the
    // positive half, without which deleting a wrapper would pass the above.
    for (const wrapper of ['StudySessionContainer.tsx', 'ProductionStudySessionContainer.tsx']) {
      expect(code(readFileSync(join(hostDirectory, wrapper), 'utf8'))).toContain('<StudySessionSurface')
    }
  })

  /**
   * PRODUCTION_ROUTE_NOT_MOUNTED, stated over the whole source tree rather than
   * over the two files a reader would think to check.
   */
  it('mounts the production container nowhere outside tests', () => {
    const referrers: string[] = []
    const walk = (directory: string): void => {
      for (const item of readdirSync(directory, { withFileTypes: true })) {
        const full = join(directory, item.name)
        if (item.isDirectory()) { walk(full); continue }
        if (!/\.tsx?$/.test(item.name) || item.name.includes('.test.')) continue
        if (full.endsWith(join('study', 'ProductionStudySessionContainer.tsx'))) continue
        // Comment-stripped: the preview container's header points a reader at
        // its production counterpart, and a cross-reference is documentation.
        // A MOUNT is code, and code is what this walk looks at.
        if (code(readFileSync(full, 'utf8')).includes('ProductionStudySessionContainer')) {
          referrers.push(full.slice(sourceRoot.length + 1).replaceAll('\\', '/'))
        }
      }
    }
    walk(sourceRoot)
    // Its own definition is excluded above; anything else naming it would be a
    // mount, and this card mounts it nowhere.
    expect(referrers).toEqual([])
  })

  it('keeps local, memory, test, preview, synthetic and sentinel identifiers out of the production root', () => {
    const productionText = readdirSync(here)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .map((name) => readFileSync(join(here, name), 'utf8'))
      .join('\n')
    expect(productionText).not.toMatch(/localDevelopmentPorts|memory-store|test provider|learner:local-release-candidate/i)
  })
})
