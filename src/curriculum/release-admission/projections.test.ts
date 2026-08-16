import { describe, expect, it } from 'vitest'
import { admitCandidate } from './admission.ts'
import { buildCandidateFixture, buildCanonicalCandidateFixture } from './fixtures.ts'
import {
  buildBrowserCatalogProjection,
  buildReadinessEvidence,
  buildReleaseRegistryEntry,
} from './projections.ts'
import { ADMITTED_RELEASE, type AdmittedRelease, type ReleaseCandidate } from './types.ts'

function admitted(candidate: ReleaseCandidate): AdmittedRelease {
  const decision = admitCandidate(candidate)
  if (decision.status !== 'ADMITTED') {
    throw new Error(`fixture was rejected: ${decision.validation.rejections.map((r) => r.code).join(', ')}`)
  }
  return decision.release
}

describe('buildBrowserCatalogProjection', () => {
  it('emits the stable field set consumed by the lazy catalog runtime', () => {
    const projection = buildBrowserCatalogProjection(admitted(buildCandidateFixture()))
    expect(Object.keys(projection.courses[0]).sort()).toEqual([
      'courseRef', 'days', 'grade', 'lessonCount', 'subject', 'title', 'unitCount',
    ])
    expect(Object.keys(projection.units[0]).sort()).toEqual([
      'assessmentRef', 'courseRef', 'days', 'essentialQuestion', 'grade', 'lessonRefs',
      'subject', 'title', 'unitNumber', 'unitRef',
    ])
    const rows = projection.lessonRowsByCourse['ma-g5-mathematics']
    expect(Object.keys(rows[0]).sort()).toEqual([
      'courseDay', 'dayInUnit', 'estimatedMinutes', 'lessonRef', 'title', 'unitNumber',
    ])
  })

  it('projects complete lazy lesson rows for every requested grade', () => {
    const release = admitted(buildCandidateFixture({ grades: [5, 7, 8], lessonsPerUnit: 3 }))
    const projection = buildBrowserCatalogProjection(release)
    expect(projection.releaseVersion).toBe('2.0.0')
    expect(projection.courses.map((course) => course.grade)).toEqual(['5', '7', '8'])
    expect(projection.courses.map((course) => course.courseRef)).toEqual([
      'ma-g5-mathematics', 'ma-g7-mathematics', 'ma-g8-mathematics',
    ])
    const lessons = projection.lessonRowsByCourse['ma-g5-mathematics']
    expect(lessons.map((lesson) => lesson.courseDay)).toEqual([1, 2, 3])
    expect(lessons[0].unitNumber).toBe(1)
    expect(projection.lessonRowsByCourse['ma-g8-mathematics'][1].lessonRef).toBe(
      'ma-g8-mathematics-u01-l02',
    )
  })

  it('gives every indexed course a lesson payload', () => {
    // The provider rejects an index entry with no payload, so a projection that
    // omitted one would fail loudly at runtime rather than read as empty.
    const projection = buildBrowserCatalogProjection(admitted(buildCanonicalCandidateFixture()))
    for (const course of projection.courses) {
      expect(projection.lessonRowsByCourse[course.courseRef]).toBeDefined()
      expect(projection.lessonRowsByCourse[course.courseRef].length).toBe(course.lessonCount)
    }
  })

  it('projects the canonical grades, grade 6 absent', () => {
    const projection = buildBrowserCatalogProjection(admitted(buildCanonicalCandidateFixture()))
    expect([...new Set(projection.courses.map((course) => course.grade))].sort()).toEqual(
      ['10', '11', '12', '3', '4', '5', '7', '8', '9'],
    )
    expect(projection.courses.some((course) => course.grade === '6')).toBe(false)
  })

  it('formats estimated minutes as the release range string', () => {
    const projection = buildBrowserCatalogProjection(admitted(buildCandidateFixture()))
    expect(projection.lessonRowsByCourse['ma-g5-mathematics'][0].estimatedMinutes).toBe('45–60')
  })

  it('orders courses, units, and lessons deterministically', () => {
    const release = admitted(buildCandidateFixture({ grades: [7, 5], unitsPerCourse: 2, lessonsPerUnit: 2 }))
    const first = buildBrowserCatalogProjection(release)
    const second = buildBrowserCatalogProjection(release)
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    expect(first.courses.map((course) => course.courseRef)).toEqual([
      'ma-g5-mathematics',
      'ma-g7-mathematics',
    ])
    expect(first.units.map((unit) => unit.unitNumber)).toEqual([1, 2, 1, 2])
    expect(first.units[0].lessonRefs).toEqual([
      'ma-g5-mathematics-u01-l01',
      'ma-g5-mathematics-u01-l02',
    ])
    expect(first.lessonRowsByCourse['ma-g5-mathematics'].map((row) => row.courseDay)).toEqual([1, 2, 3, 4])
  })
})

describe('buildBrowserCatalogProjection ordering and gating', () => {
  it('orders two-digit grades by grade, not by course id text', () => {
    // 'ma-g10-...'.localeCompare('ma-g3-...') is negative, and the provider
    // preserves whatever order it is handed, so a text sort would ship the
    // catalog with grade 10 ahead of grade 3.
    const projection = buildBrowserCatalogProjection(admitted(buildCanonicalCandidateFixture()))
    expect(projection.courses.map((course) => course.grade)).toEqual([
      '3', '4', '5', '7', '8', '9', '10', '11', '12',
    ])
    expect(projection.units.map((unit) => unit.grade)).toEqual([
      '3', '4', '5', '7', '8', '9', '10', '11', '12',
    ])
  })

  it('refuses to build from anything admitCandidate did not admit', () => {
    const fabricated = { candidate: buildCandidateFixture(), inspection: null } as unknown as AdmittedRelease
    expect(() => buildBrowserCatalogProjection(fabricated)).toThrow(/did not admit/u)
    expect(() => buildReleaseRegistryEntry(fabricated)).toThrow(/did not admit/u)
    expect(() => buildReadinessEvidence(fabricated, { generatedAt: '2026-08-12T00:00:00.000Z' })).toThrow(
      /did not admit/u,
    )
  })
})

describe('buildReleaseRegistryEntry', () => {
  it('records only grades that carry courses', () => {
    const entry = buildReleaseRegistryEntry(admitted(buildCandidateFixture({ grades: [5, 9] })))
    expect(entry.grades.map((grade) => grade.grade)).toEqual([5, 9])
    expect(entry.admission_status).toBe('ADMITTED')
    expect(entry.schema_set_version).toBe('2.0.0')
  })

  it('never records a grade 6 row', () => {
    const entry = buildReleaseRegistryEntry(admitted(buildCanonicalCandidateFixture()))
    expect(entry.grades.map((grade) => grade.grade)).toEqual([3, 4, 5, 7, 8, 9, 10, 11, 12])
  })

  it('carries custody and the gate as metadata, not content', () => {
    const entry = buildReleaseRegistryEntry(admitted(buildCandidateFixture()))
    expect(entry.standards_custody[0].custodian).toBe('Manuel Academy standards custodian')
    expect(entry.safety_privacy_gate.status).toBe('passed')
    expect(JSON.stringify(entry)).not.toContain('lesson_flow')
  })
})

describe('buildReadinessEvidence', () => {
  it('reports every admission concern as satisfied, with the caller-supplied stamp', () => {
    const evidence = buildReadinessEvidence(admitted(buildCanonicalCandidateFixture()), {
      generatedAt: '2026-08-12T00:00:00.000Z',
    })
    expect(evidence.ready).toBe(true)
    expect(evidence.generated_at).toBe('2026-08-12T00:00:00.000Z')
    expect(evidence.checks.map((check) => check.check)).toEqual([
      'schema_set_version',
      'grade_coverage',
      'schedule_resolution',
      'subject_support',
      'standards_custody',
      'safety_privacy_gate',
      'graduation_claim',
    ])
    expect(evidence.checks.every((check) => check.satisfied)).toBe(true)
  })

  it('reports NOT READY when the census says a concern is unmet', () => {
    // Built through the exported brand rather than admitCandidate: the point is
    // that each check reads the census, so evidence can still come back false
    // if admission and this report ever drift apart.
    const release = admitted(buildCandidateFixture())
    const strained = {
      [ADMITTED_RELEASE]: true,
      candidate: release.candidate,
      inspection: {
        ...release.inspection,
        coverage: release.inspection.coverage.map((entry) => ({ ...entry, scheduled: false })),
        unsupported_subjects: ['astrology'],
      },
    } as unknown as AdmittedRelease
    const evidence = buildReadinessEvidence(strained, { generatedAt: '2026-08-12T00:00:00.000Z' })
    expect(evidence.ready).toBe(false)
    expect(evidence.checks.filter((check) => !check.satisfied).map((check) => check.check)).toEqual([
      'schedule_resolution',
      'subject_support',
    ])
  })

  it('reads no clock, so the same release yields the same evidence', () => {
    const release = admitted(buildCandidateFixture())
    const options = { generatedAt: '2026-08-12T00:00:00.000Z' }
    expect(JSON.stringify(buildReadinessEvidence(release, options))).toBe(
      JSON.stringify(buildReadinessEvidence(release, options)),
    )
  })

  it('distinguishes a graduation claim from its absence', () => {
    const claimed = buildReadinessEvidence(admitted(buildCanonicalCandidateFixture()), {
      generatedAt: '2026-08-12T00:00:00.000Z',
    })
    const unclaimed = buildReadinessEvidence(admitted(buildCandidateFixture()), {
      generatedAt: '2026-08-12T00:00:00.000Z',
    })
    expect(claimed.checks.at(-1)?.detail).toContain('graduation-complete claimed')
    expect(unclaimed.checks.at(-1)?.detail).toContain('no graduation-complete claim')
  })
})
