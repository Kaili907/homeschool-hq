/**
 * STUDY-A1-PROD-TUTOR-WRAPPER Phase 6 — what the production Tutor wrapper is
 * allowed to reach, pinned transitively.
 *
 * The wrapper's whole reason for existing is that the frozen preview bridge
 * cannot be promoted. Saying so in a comment is worth nothing: an ordinary
 * refactor two cards from now can add one import and put the release-candidate
 * sentinel, the `portable-non-production` health report, or a preview port back
 * on the production path, and every test would still pass because none of them
 * changes behaviour on the paths those tests drive.
 *
 * So the boundary is walked rather than asserted. This test starts at the
 * wrapper's five production modules, follows every edge it can see, and holds
 * the whole reachable set to the derivation recorded below.
 *
 * The walker itself lives in ../testing/importClosure.ts, where the production
 * container's closure guard shares it. The three ways a guard like this fails
 * open — stopping at the first violation, modelling `import` but not `require`,
 * and modelling `require('x')` but not `const r = require; r('x')` — are
 * documented and handled there. The entry points, the forbidden list and the
 * size pin below are this guard's own.
 */
import { readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { code, walkImportClosure, RC1_SENTINEL } from '../testing/importClosure'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..', '..')

/**
 * The wrapper's production surface. Every module a host would import to run a
 * production Tutor turn, so the closure below is the closure that actually
 * ships — not just the adapter's.
 */
const ENTRY_POINTS = [
  'src/study/production/tutorAdapter.ts',
  'src/study/production/tutorRuntime.ts',
  'src/study/production/tutorPseudonym.ts',
  'src/study/production/tutorPresentation.ts',
  'src/study/production/tutorLaunchOrdering.ts',
]

/**
 * FORBIDDEN, and each entry with the reason it is forbidden rather than a bare
 * path — a later reader has to be able to tell a rule from a habit.
 */
const FORBIDDEN_MODULES: readonly { readonly fragment: string; readonly because: string }[] = [
  { fragment: 'study-engine/runtime/src/tutor-bridge', because: 'carries the release-candidate learner sentinel' },
  { fragment: 'study-engine/runtime/src/student', because: 'reaches production through tutor-bridge' },
  { fragment: 'study-engine/runtime/src/version', because: 'release-candidate version surface' },
  { fragment: 'study-engine/runtime/src/health', because: 'reports portable-non-production' },
  { fragment: 'study-engine/integration-labs', because: 'vendored non-production copies' },
  { fragment: 'study-engine/prototype', because: 'prototype surface' },
  { fragment: 'study-engine/ui', because: 'preview presentation' },
  { fragment: 'runtime/src/browser', because: 'preview browser surface' },
  { fragment: 'runtime/src/romeo', because: 'non-production content path' },
  { fragment: 'runtime/src/demonstrations', because: 'demonstration surface' },
  { fragment: 'src/study/localDevelopmentPorts', because: 'preview ports' },
  { fragment: 'src/study/mountedPorts', because: 'mounted preview ports' },
  { fragment: 'src/study/runtimeFacade', because: 'the release-candidate host runtime' },
  { fragment: 'src/study/runtimeCompatibility', because: 'asserts portable-non-production release mode' },
  { fragment: 'src/study/demonstrations', because: 'synthetic demonstration data' },
]

describe('production Tutor wrapper import closure', () => {
  const closure = walkImportClosure(repoRoot, ENTRY_POINTS)

  it('resolves every edge it can see, and reports every edge it cannot', () => {
    // Ordered so a failure names the unseeable edges first: an unanalysable
    // edge invalidates every other claim this file makes, because the closure
    // below is only the closure of what the walker could follow.
    expect(closure.unanalysable).toEqual([])
    expect(closure.unresolved.map((edge) => `${relative(repoRoot, edge.from)} -> ${edge.specifier}`)).toEqual([])
    expect(closure.packages.map((edge) => `${relative(repoRoot, edge.from)} -> ${edge.specifier}`)).toEqual([])
  })

  it('reaches no forbidden module, and collects every violation before failing', () => {
    const violations: string[] = []
    for (const file of closure.files) {
      for (const forbidden of FORBIDDEN_MODULES) {
        if (file.includes(forbidden.fragment)) {
          violations.push(`${file} (${forbidden.because})`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('does not reach the frozen preview bridge or the release-candidate runtime surfaces', () => {
    // Stated separately from the fragment sweep because these are the four the
    // card names by hand, and a fragment list is easy to edit down.
    expect(closure.files).not.toContain('adaptive-tutor/study-engine/runtime/src/tutor-bridge.ts')
    expect(closure.files).not.toContain('adaptive-tutor/study-engine/runtime/src/student.ts')
    expect(closure.files).not.toContain('adaptive-tutor/study-engine/runtime/src/version.ts')
    expect(closure.files).not.toContain('adaptive-tutor/study-engine/runtime/src/health.ts')
  })

  it('carries the release-candidate learner sentinel nowhere in its production closure', () => {
    const carriers = closure.files.filter((file) => readFileSync(resolve(repoRoot, file), 'utf8').includes(RC1_SENTINEL))
    expect(carriers).toEqual([])
  })

  it('never asserts the portable-non-production release mode', () => {
    // `assertAcceptedStudyRuntime` REQUIRES `release.mode === 'portable-non-production'`.
    // A production wrapper calling it would be asserting that production is not
    // production, and would throw on any build that ever reported otherwise.
    //
    // Scanned on the comment-stripped form, unlike the sentinel above: this
    // asks whether the closure CALLS it, and a comment explaining why it must
    // not be called is the documentation, not the violation.
    const carriers = closure.files.filter((file) =>
      code(readFileSync(resolve(repoRoot, file), 'utf8')).includes('assertAcceptedStudyRuntime'))
    expect(carriers).toEqual([])
  })

  it('routes learner-facing prose through the reviewed sanitizer', () => {
    /**
     * A STRUCTURAL guard, and it is structural because the behavioural one
     * cannot exist against the content that ships today.
     *
     * Measured rather than assumed: every utterance reachable by driving the
     * frozen Core engine over both registered subjects, all registered math
     * programs and several answers, for six turns each, is a FIXED POINT of
     * `sanitizeLearnerFacingText` — 0 of them change, and 0 raise a privacy
     * action. The frozen content is clean prose with no contact details, no
     * diagnosis language and no name prefix, which is exactly what a reviewed
     * corpus should be.
     *
     * So a mutant that deleted the sanitizer call and showed the raw utterance
     * instead would be behaviourally EQUIVALENT today: no test driving the real
     * engine could tell the two apart. That is a statement about the corpus, not
     * about the risk — the sanitizer is there for the output this wrapper cannot
     * see yet, from a hosted Tutor or a later content pack, and it must be wired
     * in BEFORE such output exists rather than after.
     *
     * The call site is therefore pinned directly. ./tutorAdapter.test.ts holds
     * the other half — that the value returned is a fixed point of the
     * sanitizer, so the output travels rather than the input.
     */
    const adapter = code(readFileSync(resolve(repoRoot, 'src/study/production/tutorAdapter.ts'), 'utf8'))
    expect(adapter).toMatch(/sanitizeLearnerFacingText\(utterance\)/)
    expect(adapter).toMatch(/visibleText = safe\.text/)
    // And the sanitizer's own module is genuinely in the closure, so the import
    // above is a real edge rather than a name that resolves to nothing.
    expect(closure.files).toContain('adaptive-tutor/study-engine/bridges/tutor-core/src/privacy.ts')
  })

  it('reaches the frozen primitives it is supposed to reach', () => {
    // The positive half. Without it, a closure that had accidentally become
    // empty — an entry point renamed, a walker that stopped following — would
    // pass every assertion above while proving nothing at all.
    expect(closure.files).toContain('adaptive-tutor/study-engine/bridges/tutor-core/src/orchestrator.ts')
    expect(closure.files).toContain('adaptive-tutor/study-engine/bridges/tutor-core/src/safety-gateway.ts')
    expect(closure.files).toContain('adaptive-tutor/study-engine/bridges/tutor-core/src/privacy.ts')
    expect(closure.files).toContain('adaptive-tutor/core/engine/adaptive-tutor-engine.ts')
    expect(closure.files).toContain('adaptive-tutor/study-engine/runtime/src/subject-registry.ts')
    expect(closure.files).toContain('adaptive-tutor/study-engine/runtime/src/safety.ts')
    expect(closure.files).toContain('adaptive-tutor/study-engine/contracts/versioning.ts')
    expect(closure.files).toContain('adaptive-tutor/study-engine/schemas/learning-evidence.schema.ts')
    // Followed through the alias rather than allowed past it.
    expect(closure.files).toContain('adaptive-tutor/subjects/math/index.ts')
  })

  it('holds the closure to its measured size, so a new subtree is a visible change', () => {
    // Not a style rule, and deliberately an exact number rather than a band.
    // The forbidden list above can only refuse what someone thought of; this
    // notices anything arriving that nobody thought of. A card that legitimately
    // grows the closure updates this number and says in its message what it
    // added — which is the whole cost, and it is the right cost for the one
    // boundary that keeps a release-candidate surface out of production.
    //
    // 91 as measured on this card: 70 under adaptive-tutor/ (the frozen bridge
    // primitives, the frozen Core, the subject registry and the aliased frozen
    // Math R1 package) and 21 under src/study/ (the Tutor contract, the host
    // ports and types, the lifecycle, and the wrapper's own five modules).
    //
    // STUDY-A1-TUTOR-CONTENT-ELIGIBILITY-CONTRACT added the two, both under
    // src/study/ and neither reaching anything new: contracts/tutor/eligibility.ts
    // (the transport-facing vocabulary and parsers, which see no content at
    // all) and production/tutorContentEligibility.ts (the decision, which sees
    // the subject registry the adapter already reached). The adaptive-tutor/
    // half is unchanged, and that is the half this guard exists for.
    expect(closure.files.length).toBe(91)
    expect(closure.files.filter((file) => file.startsWith('src/study/'))).toHaveLength(21)
    expect(closure.files.filter((file) => file.startsWith('adaptive-tutor/'))).toHaveLength(70)
  })
})
