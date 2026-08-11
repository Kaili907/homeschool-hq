/**
 * STUDY-A1-PRODUCTION-SAFE-CONTAINER — what the production Study container is
 * allowed to reach, pinned transitively.
 *
 * The measured bundle analysis found exactly one reason the mounted container
 * cannot ship: `src/study/runtimeFacade.ts`, whose 90-file closure carries the
 * release-candidate learner sentinel, the `LOCAL DEVELOPMENT ONLY` marker and
 * the frozen Math R1 content — and which reaches that content by TWO
 * independent edges. A container that merely stops naming the facade in its own
 * import list would satisfy a reviewer reading the file and would still ship the
 * content the first time anything three imports down reintroduced the edge.
 *
 * So the boundary is walked rather than read. This test starts at the production
 * container, follows every edge it can see, reports every edge it CANNOT see,
 * and holds the whole reachable set to the derivation recorded below. The walker
 * is ../../study/testing/importClosure.ts, shared with the production Tutor
 * wrapper's closure guard; the three ways a guard like this fails open are
 * documented there.
 *
 * ABSENCE IS NOT EVIDENCE ON ITS OWN, and this file is built around that.
 *
 * A forbidden-path list proves nothing if the paths are misspelled, and a
 * forbidden-marker list proves nothing if the markers appear nowhere. Both
 * failures read as a clean pass. So every rule below is CONTROLLED:
 *
 *   Every marker is asserted PRESENT in the preview container's closure and
 *   absent from this one. A marker that is absent from both is a marker that
 *   proves nothing, and it fails the control instead of passing quietly.
 *
 *   Every forbidden fragment is asserted to name a path that really exists, so
 *   a typo cannot masquerade as compliance. The twelve of them that the preview
 *   container genuinely reaches are additionally asserted PRESENT there; the
 *   remaining seven are labelled prospective, because no closure in the repo
 *   reaches them today and this file must not imply otherwise.
 *
 * WHY `study-engine/ui` IS ALLOWED HERE and forbidden in the wrapper's closure.
 * The wrapper is a Tutor and has no business in presentation. This is the
 * learner's surface, and `JarvisCore` is the caption component it has always
 * rendered — measured at 24,017 bytes with none of the four markers on it. It is
 * allowed by NAME rather than by prefix: the assertion below is an exact
 * two-file allow-list for everything under `adaptive-tutor/`, so the frozen
 * Core, the subject registry, the bridge and the content packages are all
 * foreclosed at once, including by edges nobody thought to forbid.
 */
import { existsSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { code, walkImportClosure, RC1_SENTINEL } from '../../study/testing/importClosure'

const repoRoot = resolve(process.cwd())

/** The production host a production App would render. */
const ENTRY_POINT = 'src/components/study/ProductionStudySessionContainer.tsx'

/**
 * The preview host, walked only as this file's control. It is the surface that
 * is SUPPOSED to reach all of this, so it is the thing that proves the rules
 * below can fire at all.
 */
const PREVIEW_ENTRY_POINT = 'src/components/study/StudySessionContainer.tsx'

/**
 * FORBIDDEN, each with the reason it is forbidden rather than a bare path — a
 * later reader has to be able to tell a rule from a habit — and each with a
 * real path so the fragment cannot be a typo.
 *
 * `witnessedByPreview` records whether the preview container actually reaches
 * it. Twelve do, and for those the control below is a genuine differential.
 * Seven do not: they are prospective rules against surfaces that exist in this
 * repository but are not on any container's path today, and calling them proven
 * would be a lie in a file whose whole job is to not tell one.
 */
const FORBIDDEN_MODULES: readonly {
  readonly fragment: string
  readonly realPath: string
  readonly because: string
  readonly witnessedByPreview: boolean
}[] = [
  { fragment: 'src/study/runtimeFacade', realPath: 'src/study/runtimeFacade.ts', because: 'the release-candidate host runtime — the one measured cause', witnessedByPreview: true },
  { fragment: 'src/study/runtimeCompatibility', realPath: 'src/study/runtimeCompatibility.ts', because: 'asserts portable-non-production release mode', witnessedByPreview: true },
  { fragment: 'src/components/study/StudySessionContainer', realPath: 'src/components/study/StudySessionContainer.tsx', because: 'the preview container, which owns the facade', witnessedByPreview: true },
  { fragment: 'study-engine/runtime/src/tutor-bridge', realPath: 'adaptive-tutor/study-engine/runtime/src/tutor-bridge.ts', because: 'carries the release-candidate learner sentinel', witnessedByPreview: true },
  { fragment: 'study-engine/runtime/src/student', realPath: 'adaptive-tutor/study-engine/runtime/src/student.ts', because: 'reaches production through tutor-bridge', witnessedByPreview: true },
  { fragment: 'study-engine/runtime/src/version', realPath: 'adaptive-tutor/study-engine/runtime/src/version.ts', because: 'release-candidate version surface', witnessedByPreview: true },
  { fragment: 'study-engine/runtime/src/health', realPath: 'adaptive-tutor/study-engine/runtime/src/health.ts', because: 'reports portable-non-production', witnessedByPreview: true },
  { fragment: 'study-engine/runtime/src/subject-registry', realPath: 'adaptive-tutor/study-engine/runtime/src/subject-registry.ts', because: 'the second independent edge to the frozen content', witnessedByPreview: true },
  { fragment: 'study-engine/bridges/tutor-core', realPath: 'adaptive-tutor/study-engine/bridges/tutor-core/src/orchestrator.ts', because: 'the frozen Tutor Core — injected, never imported by a host', witnessedByPreview: true },
  { fragment: 'adaptive-tutor/subjects/', realPath: 'adaptive-tutor/subjects/math/index.ts', because: 'frozen subject content packages', witnessedByPreview: true },
  { fragment: 'adaptive-tutor/core/', realPath: 'adaptive-tutor/core/engine/adaptive-tutor-engine.ts', because: 'the frozen Tutor engine', witnessedByPreview: true },
  { fragment: 'study-engine/integration-labs', realPath: 'adaptive-tutor/study-engine/integration-labs', because: 'vendored non-production copies', witnessedByPreview: true },
  { fragment: 'src/study/localDevelopmentPorts', realPath: 'src/study/localDevelopmentPorts.ts', because: 'preview ports', witnessedByPreview: false },
  { fragment: 'src/study/mountedPorts', realPath: 'src/study/mountedPorts.ts', because: 'mounted preview ports', witnessedByPreview: false },
  { fragment: 'src/study/demonstrations', realPath: 'src/study/demonstrations.ts', because: 'synthetic demonstration data', witnessedByPreview: false },
  { fragment: 'study-engine/prototype', realPath: 'adaptive-tutor/study-engine/prototype', because: 'prototype surface', witnessedByPreview: false },
  { fragment: 'runtime/src/browser', realPath: 'adaptive-tutor/study-engine/runtime/src/browser.ts', because: 'preview browser surface', witnessedByPreview: false },
  { fragment: 'runtime/src/romeo', realPath: 'adaptive-tutor/study-engine/runtime/src/romeo.ts', because: 'non-production content path', witnessedByPreview: false },
  { fragment: 'runtime/src/demonstrations', realPath: 'adaptive-tutor/study-engine/runtime/src/demonstrations.ts', because: 'demonstration surface', witnessedByPreview: false },
]

/**
 * The strings the reviewed bundle guard already refuses in a production build
 * (src/study/production/providerBundleSecurity.test.ts), restricted to the
 * preview-identity and frozen-content subset this closure is about.
 *
 * Two markers on that list are deliberately NOT here — `learner:synthetic-grade5-`
 * and `session12-local-forced-outcome-v1`. Neither appears anywhere in the
 * preview container's closure, so neither could distinguish a clean production
 * closure from a contaminated one, and including them would have added two
 * assertions that pass no matter what this card did.
 */
const PREVIEW_ONLY_MARKERS: readonly { readonly marker: string; readonly because: string }[] = [
  { marker: RC1_SENTINEL, because: 'the sentinel identity the preview bridge sends for every learner' },
  { marker: 'LOCAL DEVELOPMENT ONLY', because: 'the preview durability disclaimer' },
  { marker: 'portable-non-production', because: 'the release mode a production build must never assert' },
  { marker: 'assertAcceptedStudyRuntime', because: 'the assertion that production is not production' },
  { marker: 'Adaptive Math Intervention Content', because: 'the frozen Math R1 package manifest' },
  { marker: 'math-seq-pv-regroup-v1', because: 'a frozen Math R1 lesson sequence — real content, not a title' },
]

function carriers(files: readonly string[], marker: string): readonly string[] {
  // Comment-stripped, because these modules EXPLAIN in prose which markers they
  // must not carry and why. A build ships code, not the comment that says the
  // code must stay out — and a guard that failed on its own documentation is a
  // guard the next card deletes.
  return files.filter((file) => code(readFileSync(resolve(repoRoot, file), 'utf8')).includes(marker))
}

describe('production Study container import closure', () => {
  const closure = walkImportClosure(repoRoot, [ENTRY_POINT])
  const preview = walkImportClosure(repoRoot, [PREVIEW_ENTRY_POINT])

  it('resolves every edge it can see, and reports every edge it cannot', () => {
    // Ordered so a failure names the unseeable edges first: an unanalysable
    // edge invalidates every other claim this file makes, because the closure
    // below is only the closure of what the walker could follow.
    expect(closure.unanalysable).toEqual([])
    expect(closure.unresolved.map((edge) => `${relative(repoRoot, edge.from)} -> ${edge.specifier}`)).toEqual([])
    // One bare specifier, and it is React. Anything else arriving — a transport
    // client, a provider SDK, a preview package — is a visible change here
    // rather than a dependency nobody looked at.
    expect([...new Set(closure.packages.map((edge) => edge.specifier))]).toEqual(['react'])
  })

  it('names a real path for every rule it states', () => {
    // The typo guard. A fragment that matches nothing would make its rule pass
    // for the rest of time while forbidding nothing at all.
    const missing = FORBIDDEN_MODULES
      .filter((forbidden) => !existsSync(resolve(repoRoot, forbidden.realPath)))
      .map((forbidden) => forbidden.realPath)
    expect(missing).toEqual([])
    for (const forbidden of FORBIDDEN_MODULES) {
      expect(forbidden.realPath.replaceAll('\\', '/')).toContain(forbidden.fragment)
    }
  })

  it('reaches no forbidden module, and collects every violation before failing', () => {
    const violations: string[] = []
    for (const file of closure.files) {
      for (const forbidden of FORBIDDEN_MODULES) {
        if (file.includes(forbidden.fragment)) violations.push(`${file} (${forbidden.because})`)
      }
    }
    expect(violations).toEqual([])
  })

  it('CONTROL: the preview container reaches the twelve this card measured', () => {
    // Without this, the rule above would pass just as well against a fragment
    // list that named nothing on any real preview path. These twelve are the
    // measured contamination; the other seven are prospective and say so.
    const unwitnessed = FORBIDDEN_MODULES
      .filter((forbidden) => forbidden.witnessedByPreview)
      .filter((forbidden) => !preview.files.some((file) => file.includes(forbidden.fragment)))
      .map((forbidden) => forbidden.fragment)
    expect(unwitnessed).toEqual([])
    expect(FORBIDDEN_MODULES.filter((forbidden) => forbidden.witnessedByPreview)).toHaveLength(12)
  })

  it('carries none of the preview-only markers', () => {
    const found = PREVIEW_ONLY_MARKERS
      .flatMap(({ marker, because }) => carriers(closure.files, marker).map((file) => `${file}: ${marker} (${because})`))
    expect(found).toEqual([])
  })

  it('CONTROL: the preview container carries every one of them', () => {
    // The half that makes the assertion above mean something. A marker absent
    // from both closures distinguishes nothing, and would sit here forever
    // reading as a passing safety check.
    const vacuous = PREVIEW_ONLY_MARKERS
      .filter(({ marker }) => carriers(preview.files, marker).length === 0)
      .map(({ marker }) => marker)
    expect(vacuous).toEqual([])
  })

  it('reaches nothing under adaptive-tutor/ but the caption component it renders', () => {
    // An allow-list, not a deny-list, and it is the load-bearing assertion of
    // this file. Every route to the frozen content — the bridge, the student
    // surface, the subject registry, the Core, the aliased Math R1 package, and
    // any edge nobody has thought of — is refused by this one line.
    expect(closure.files.filter((file) => file.startsWith('adaptive-tutor/'))).toEqual([
      'adaptive-tutor/study-engine/ui/JarvisCore.tsx',
      'adaptive-tutor/study-engine/ui/jarvis-core.css',
    ])
  })

  it('reaches the shared safety-critical body it is supposed to reach', () => {
    // The positive half. Without it, a closure that had accidentally become
    // empty — an entry point renamed, a walker that stopped following — would
    // pass every assertion above while proving nothing at all. Each of these is
    // one of the rules the card requires production and preview to SHARE.
    expect(closure.files).toContain('src/components/study/studySessionSurface.tsx')
    expect(closure.files).toContain('src/components/study/productionTutorSeam.ts')
    // F4: the canonical parser's own module, reached as a real edge.
    expect(closure.files).toContain('src/study/contracts/tutor/results.ts')
    // HOST_AWAIT: the LaunchSettled witness, the same one the preview path uses.
    expect(closure.files).toContain('src/study/production/tutorLaunchOrdering.ts')
    // The durable safety-stop ledger and the host's own learner-facing words.
    expect(closure.files).toContain('src/study/safety/localStopLedger.ts')
    expect(closure.files).toContain('src/study/safety/learnerSafe.ts')
    expect(closure.files).toContain('adaptive-tutor/study-engine/ui/JarvisCore.tsx')
  })

  it('holds the closure to its measured size, so a new subtree is a visible change', () => {
    // Not a style rule, and deliberately an exact number rather than a band.
    // The forbidden list above can only refuse what someone thought of; this
    // notices anything arriving that nobody thought of. A card that legitimately
    // grows the closure updates this number and says in its message what it
    // added.
    //
    // 27 as measured on this card: 2 under adaptive-tutor/ (the caption
    // component and its stylesheet), 4 under src/components/study/ (the two
    // wrappers' production half, the shared body and its stylesheet) and 21
    // under src/study/ (the Tutor contract, the production contracts, the host
    // ports and types, the lifecycle, the launch ordering and the safety
    // ledger).
    //
    // The preview container's closure is 98 files for the same surface. The
    // difference is the whole of this card.
    expect(closure.files.length).toBe(27)
    expect(closure.files.filter((file) => file.startsWith('src/study/'))).toHaveLength(21)
    expect(preview.files.length).toBe(98)
  })
})
