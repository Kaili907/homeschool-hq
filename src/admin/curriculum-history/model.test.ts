import { describe, expect, it } from 'vitest'
import type {
  CurriculumActivationCandidate,
  CurriculumActivationHistoryEntry,
  CurriculumActivationStatus,
} from '../curriculum-activation'
import type { CurriculumReleaseRegistrySummary } from './contracts'
import { buildCurriculumReleaseHistoryModel } from './model'

const REQUESTS = [
  '50000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000002',
  '50000000-0000-4000-8000-000000000003',
]

function release(version: string, day: number): CurriculumReleaseRegistrySummary {
  return {
    packageId: `manuel-academy-curriculum-${version.replaceAll('.', '-')}`,
    version,
    status: 'published',
    registeredAt: `2026-08-${String(day).padStart(2, '0')}T15:00:00.000Z`,
    authoredOn: `2026-08-${String(Math.max(day - 1, 1)).padStart(2, '0')}`,
    provenanceClass: 'legacy_import',
    sourceCommit: String(day).repeat(40).slice(0, 40),
    sourceRoot: `curriculum-content/manuel-academy/${version}`,
    stagingId: null,
    fileCount: 10,
    byteCount: 100,
    counts: { courses: 1, units: 2, lessons: 3, assessments: 1, texts: 1, schedules: 1 },
  }
}

function stagedRelease(version: string, day: number): CurriculumReleaseRegistrySummary {
  return {
    packageId: 'manuel-academy-curriculum-v1',
    version,
    status: 'published',
    registeredAt: `2026-08-${String(day).padStart(2, '0')}T15:00:00.000Z`,
    authoredOn: null,
    provenanceClass: 'staged_publish',
    sourceCommit: null,
    sourceRoot: null,
    stagingId: '20000000-0000-4000-8000-000000000001',
    fileCount: 12,
    byteCount: 4096,
    counts: { courses: 1, units: 2, lessons: 3, assessments: 1, texts: 0, schedules: 1 },
  }
}

function candidate(
  summary: CurriculumReleaseRegistrySummary,
  overrides: Partial<CurriculumActivationCandidate> = {},
): CurriculumActivationCandidate {
  return {
    releaseVersion: summary.version,
    status: 'published',
    registeredAt: summary.registeredAt,
    artifactState: 'available',
    eligible: true,
    previouslyActive: false,
    active: false,
    ...overrides,
  }
}

function transition(
  pointerRevision: number,
  previousReleaseVersion: string | null,
  newReleaseVersion: string,
  transitionKind: CurriculumActivationHistoryEntry['transitionKind'],
): CurriculumActivationHistoryEntry {
  return {
    pointerRevision,
    previousReleaseVersion,
    newReleaseVersion,
    transitionKind,
    reasonCode: transitionKind === 'migration_seed'
      ? null : transitionKind === 'activation' ? 'release.activated' : 'release.rolled_back',
    correlationId: transitionKind === 'migration_seed' ? null : REQUESTS[pointerRevision - 2],
    transitionedAt: `2026-08-${String(9 + pointerRevision).padStart(2, '0')}T16:00:00.000Z`,
  }
}

function status(
  releases: readonly CurriculumReleaseRegistrySummary[],
  candidates: readonly CurriculumActivationCandidate[],
  history: readonly CurriculumActivationHistoryEntry[],
): CurriculumActivationStatus {
  const current = history[0]
  return {
    schemaVersion: 1,
    environment: 'production',
    authority: 'default_current_curriculum',
    existingLearnersRepinned: false,
    pointer: {
      releaseVersion: current.newReleaseVersion,
      revision: current.pointerRevision,
      transitionKind: current.transitionKind,
      bindingMode: current.transitionKind === 'migration_seed' ? 'registry_only' : 'default_authority',
      transitionedAt: current.transitionedAt,
    },
    candidates,
    history,
    historyTruncated: false,
  }
}

describe('curriculum release history governance model', () => {
  it('treats the single legacy release as incomplete provenance with verified evidence, not invalid', () => {
    const legacy = release('1.0.0', 9)
    const activation = status(
      [legacy],
      [candidate(legacy, { active: true, previouslyActive: true })],
      [transition(1, null, '1.0.0', 'migration_seed')],
    )
    const model = buildCurriculumReleaseHistoryModel([legacy], activation)
    expect(model).toMatchObject({ activeReleaseVersion: '1.0.0', pointerRevision: 1 })
    expect(model.releases[0]).toMatchObject({
      lifecycle: 'active',
      integrityState: 'verified_evidence_available',
      provenanceKind: 'legacy',
      provenanceCompleteness: 'incomplete',
      provenanceEvidenceAvailable: true,
      baseReleaseVersion: null,
      rollbackEligibility: { state: 'ineligible', blockingReason: 'current_release' },
    })
  })

  it('preserves prerelease staged-publish identity without inventing legacy source evidence', () => {
    const legacy = release('1.0.0', 9)
    const staged = stagedRelease('2.0.0-rc.1', 10)
    const activation = status(
      [legacy, staged],
      [
        candidate(legacy, { previouslyActive: true }),
        candidate(staged, { active: true, previouslyActive: true }),
      ],
      [
        transition(2, '1.0.0', '2.0.0-rc.1', 'activation'),
        transition(1, null, '1.0.0', 'migration_seed'),
      ],
    )
    const model = buildCurriculumReleaseHistoryModel([legacy, staged], activation)
    expect(model).toMatchObject({ activeReleaseVersion: '2.0.0-rc.1', pointerRevision: 2 })
    expect(model.releases.find((item) => item.version === staged.version)).toMatchObject({
      lifecycle: 'active',
      integrityState: 'verified_evidence_available',
      provenanceKind: 'staged_publish',
      provenanceCompleteness: 'complete',
      provenanceEvidenceAvailable: true,
      sourceCommit: null,
      sourceRoot: null,
      stagingId: staged.stagingId,
      baseReleaseVersion: null,
      rollbackEligibility: { state: 'ineligible', blockingReason: 'current_release' },
    })
  })

  it('uses pointer identities for activation and rollback history and evaluates every published release', () => {
    const releases = [
      release('1.0.0', 9), release('2.0.0', 10), release('3.0.0', 11),
      release('4.0.0', 12), release('5.0.0', 13),
    ]
    const history = [
      transition(4, '3.0.0', '2.0.0', 'rollback'),
      transition(3, '2.0.0', '3.0.0', 'activation'),
      transition(2, '1.0.0', '2.0.0', 'activation'),
      transition(1, null, '1.0.0', 'migration_seed'),
    ]
    const activation = status(releases, [
      candidate(releases[0], { previouslyActive: true }),
      candidate(releases[1], { active: true, previouslyActive: true }),
      candidate(releases[2], {
        previouslyActive: true, eligible: false, artifactState: 'unavailable',
      }),
      candidate(releases[3]),
      // 5.0.0 deliberately has no pointer candidate: it must remain unverified.
    ], history)
    const model = buildCurriculumReleaseHistoryModel(releases, activation)
    expect(model.transitions.map((entry) => [
      entry.pointerRevision, entry.transitionKind, entry.previousReleaseVersion,
      entry.newReleaseVersion, entry.reasonCode,
    ])).toEqual([
      [4, 'rollback', '3.0.0', '2.0.0', 'release.rolled_back'],
      [3, 'activation', '2.0.0', '3.0.0', 'release.activated'],
      [2, 'activation', '1.0.0', '2.0.0', 'release.activated'],
      [1, 'migration_seed', null, '1.0.0', null],
    ])
    const byVersion = Object.fromEntries(model.releases.map((entry) => [entry.version, entry]))
    expect(byVersion['1.0.0'].rollbackEligibility).toMatchObject({ state: 'eligible', blockingReason: null })
    expect(byVersion['2.0.0']).toMatchObject({ lifecycle: 'active', pointerRevisions: [4, 2] })
    expect(byVersion['3.0.0'].rollbackEligibility).toMatchObject({
      state: 'ineligible', blockingReason: 'integrity_evidence_unavailable',
    })
    expect(byVersion['4.0.0'].rollbackEligibility).toMatchObject({
      state: 'ineligible', blockingReason: 'not_previously_active',
    })
    expect(byVersion['5.0.0']).toMatchObject({
      integrityState: 'unverified',
      rollbackEligibility: { state: 'unverified', blockingReason: 'pointer_evidence_unavailable' },
    })
  })

  it('rejects malformed identity chains instead of inferring transitions from timestamps', () => {
    const one = release('1.0.0', 9)
    const two = release('2.0.0', 10)
    const malformed = status(
      [one, two],
      [
        candidate(one, { previouslyActive: true }),
        candidate(two, { active: true, previouslyActive: true }),
      ],
      [
        transition(2, '2.0.0', '2.0.0', 'activation'),
        transition(1, null, '1.0.0', 'migration_seed'),
      ],
    )
    expect(() => buildCurriculumReleaseHistoryModel([one, two], malformed))
      .toThrow('curriculum_release_history_inconsistent')
  })
})
