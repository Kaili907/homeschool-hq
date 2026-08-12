import { describe, expect, it } from 'vitest'
import { ACADEMY_SUBJECTS } from '../../types'
import { courseSchema } from '../../curriculum-authoring/v2/contracts.ts'
import { admitCandidate, inspectCandidate, validateCandidate } from './admission.ts'
import { buildCandidateFixture, buildCanonicalCandidateFixture } from './fixtures.ts'
import {
  ADMISSION_REJECTION_CODES,
  CANONICAL_GRADES,
  SUPPORTED_SUBJECTS,
  type AdmissionRejectionCode,
  type ReleaseCandidate,
} from './types.ts'

function codesFor(candidate: ReleaseCandidate): readonly AdmissionRejectionCode[] {
  return [...new Set(validateCandidate(candidate).rejections.map((entry) => entry.code))]
}

/** structuredClone keeps each mutation isolated from the shared fixture. */
function mutable(candidate: ReleaseCandidate): ReleaseCandidate {
  return structuredClone(candidate) as ReleaseCandidate
}

/**
 * An off-enum subject cannot be spelled in TypeScript, but a candidate parsed
 * from JSON can carry one — which is the case admission has to catch.
 */
function withUnsupportedSubject(candidate: ReleaseCandidate): ReleaseCandidate {
  const courses = candidate.authoring_set.courses.map((course) => ({ ...course, subject: 'astrology' }))
  return {
    ...candidate,
    authoring_set: { ...candidate.authoring_set, courses },
  } as unknown as ReleaseCandidate
}

describe('canonical grades', () => {
  it('publishes 3, 4, 5, 7, 8, 9, 10, 11, 12 and no grade 6', () => {
    expect(CANONICAL_GRADES).toEqual([3, 4, 5, 7, 8, 9, 10, 11, 12])
    expect(CANONICAL_GRADES).not.toContain(6)
  })

  it('admits the full canonical sequence', () => {
    const decision = admitCandidate(buildCanonicalCandidateFixture())
    expect(decision.status).toBe('ADMITTED')
    expect(decision.validation.rejections).toEqual([])
  })

  it('reports coverage for every canonical grade and never for grade 6', () => {
    const inspection = inspectCandidate(buildCanonicalCandidateFixture())
    expect(inspection.coverage.map((entry) => entry.grade)).toEqual([...CANONICAL_GRADES])
    expect(inspection.coverage.every((entry) => entry.courses > 0)).toBe(true)
  })

  it('rejects grade 6 content instead of treating it as a coverage hole', () => {
    const codes = codesFor(buildCandidateFixture({ grades: [6] }))
    expect(codes).toContain('RELEASE_GRADE_UNSUPPORTED')
    expect(codes).not.toContain('RELEASE_GRADE_MISSING')
  })

  it('keeps the supported subject list identical to the app-wide and schema lists', () => {
    const schemaSubjects = (
      courseSchema.jsonSchema as { properties: { subject: { enum: readonly string[] } } }
    ).properties.subject.enum
    expect([...SUPPORTED_SUBJECTS]).toEqual([...ACADEMY_SUBJECTS])
    expect([...SUPPORTED_SUBJECTS]).toEqual([...schemaSubjects])
  })
})

describe('admission rejections', () => {
  it('rejects a schema set the build does not speak', () => {
    const candidate = mutable(buildCandidateFixture())
    expect(codesFor({ ...candidate, schema_set_version: '1.0.0' })).toEqual(['RELEASE_SCHEMA_MISMATCH'])
    expect(codesFor({ ...candidate, schema_set_version: 'not-a-version' })).toEqual([
      'RELEASE_SCHEMA_MISMATCH',
    ])
  })

  it('rejects a future schema set without pretending to have validated it', () => {
    const candidate = mutable(buildCandidateFixture())
    for (const version of ['2.0.1', '2.1.0', '3.0.0']) {
      const validation = validateCandidate({ ...candidate, schema_set_version: version })
      expect(validation.rejections.map((entry) => entry.code)).toEqual(['RELEASE_SCHEMA_FUTURE'])
      // Short-circuited: 2.0.0 findings about newer content would be noise.
      expect(validation.authoring_issues).toEqual([])
    }
  })

  it('rejects a declared grade the candidate does not publish', () => {
    const codes = codesFor(buildCandidateFixture({ grades: [5], declaredGrades: [5, 7] }))
    expect(codes).toContain('RELEASE_GRADE_MISSING')
  })

  it('rejects a published grade the candidate never declared', () => {
    const codes = codesFor(buildCandidateFixture({ grades: [5, 7], declaredGrades: [5] }))
    expect(codes).toContain('RELEASE_GRADE_MISSING')
  })

  it('rejects duplicate identifiers', () => {
    const candidate = mutable(buildCandidateFixture())
    const lessons = [...candidate.authoring_set.lessons, candidate.authoring_set.lessons[0]]
    expect(
      codesFor({ ...candidate, authoring_set: { ...candidate.authoring_set, lessons } }),
    ).toContain('RELEASE_DUPLICATE_ID')
  })

  it('rejects a grade whose lessons no schedule places', () => {
    const candidate = mutable(buildCandidateFixture({ grades: [5, 7] }))
    const set = candidate.authoring_set
    const schedules = set.schedules.filter((schedule) => schedule.grade !== 7)
    const authoring_set = {
      ...set,
      schedules,
      manifest: {
        ...set.manifest,
        schedule_refs: schedules.map((schedule) => schedule.schedule_id),
        counts: { ...set.manifest.counts, schedules: schedules.length },
      },
    }
    expect(codesFor({ ...candidate, authoring_set })).toEqual(['RELEASE_SCHEDULE_UNRESOLVED'])
  })

  it('rejects an unsupported subject', () => {
    const codes = codesFor(withUnsupportedSubject(mutable(buildCandidateFixture())))
    expect(codes).toContain('RELEASE_SUBJECT_UNSUPPORTED')
  })

  it('rejects a cited framework with no custody record', () => {
    const candidate = mutable(buildCandidateFixture())
    expect(codesFor({ ...candidate, standards_custody: [] })).toEqual([
      'RELEASE_STANDARDS_CUSTODY_MISSING',
    ])
  })

  it('rejects custody that attests the wrong framework version', () => {
    const candidate = mutable(buildCandidateFixture())
    const standards_custody = candidate.standards_custody.map((record) => ({
      ...record,
      attested_framework_version: '1999.0',
    }))
    expect(codesFor({ ...candidate, standards_custody })).toEqual([
      'RELEASE_STANDARDS_CUSTODY_MISSING',
    ])
  })

  it('rejects standards that are cited but not verified', () => {
    const candidate = mutable(buildCandidateFixture())
    const standard_frameworks = candidate.authoring_set.standard_frameworks.map((framework) => ({
      ...framework,
      authority_status: 'legacy-unverified' as const,
    }))
    expect(
      codesFor({ ...candidate, authoring_set: { ...candidate.authoring_set, standard_frameworks } }),
    ).toContain('RELEASE_STANDARDS_CUSTODY_MISSING')
  })

  it('rejects duplicate custody records instead of checking only the last', () => {
    const candidate = mutable(buildCandidateFixture())
    const [record] = candidate.standards_custody
    // The impostor is FIRST; a last-wins lookup would validate only the real
    // record behind it and admit the release with both on the registry row.
    const standards_custody = [
      { ...record, custodian: 'impostor', attested_framework_version: '1999.0' },
      record,
    ]
    expect(codesFor({ ...candidate, standards_custody })).toEqual([
      'RELEASE_STANDARDS_CUSTODY_MISSING',
    ])
  })

  it('rejects custody for a framework the candidate never cites', () => {
    const candidate = mutable(buildCandidateFixture())
    const standards_custody = [
      ...candidate.standards_custody,
      {
        framework_ref: 'never-cited-framework',
        custodian: 'someone',
        attested_framework_version: '2026.1',
        evidence_locator: 'docs/nowhere.md',
      },
    ]
    expect(codesFor({ ...candidate, standards_custody })).toEqual([
      'RELEASE_STANDARDS_CUSTODY_MISSING',
    ])
  })

  it('rejects a grade 6 schedule riding along on an otherwise valid release', () => {
    // A schedule that places no lessons is pinned to no grade by the authoring
    // validator, so grade 6 would otherwise reach the admitted release.
    const candidate = mutable(buildCandidateFixture())
    const set = candidate.authoring_set
    const schedules = [
      ...set.schedules,
      {
        schema_set_version: '2.0.0' as const,
        schedule_id: 'ma-g6-schedule',
        grade: 6,
        weeks: 1,
        instructional_days: 1,
        entries: [{ week: 1, day: 1, lesson_refs: [] }],
      },
    ]
    const authoring_set = {
      ...set,
      schedules,
      manifest: {
        ...set.manifest,
        schedule_refs: schedules.map((schedule) => schedule.schedule_id),
        counts: { ...set.manifest.counts, schedules: schedules.length },
      },
    }
    expect(codesFor({ ...candidate, authoring_set })).toContain('RELEASE_GRADE_UNSUPPORTED')
  })

  it('rejects an envelope that cannot even name its release', () => {
    const candidate = mutable(buildCandidateFixture())
    // undefined === undefined satisfied the gate-freshness comparison, so a
    // candidate with no version at all used to be admitted as READY.
    const unnamed = {
      ...candidate,
      release_version: undefined,
      safety_privacy_gate: { ...candidate.safety_privacy_gate, reviewed_release_version: undefined },
    } as unknown as ReleaseCandidate
    const validation = validateCandidate(unnamed)
    expect(validation.admissible).toBe(false)
    expect(validation.rejections.map((entry) => entry.path)).toContain('release_version')
    expect(admitCandidate(unnamed).status).toBe('REJECTED')
  })

  it('rejects a structurally empty candidate without throwing', () => {
    const validation = validateCandidate({} as unknown as ReleaseCandidate)
    expect(validation.admissible).toBe(false)
    expect(validation.rejections.length).toBeGreaterThan(0)
  })

  it('rejects a safety and privacy gate that did not pass', () => {
    const candidate = mutable(buildCandidateFixture())
    for (const status of ['failed', 'not-run'] as const) {
      expect(
        codesFor({ ...candidate, safety_privacy_gate: { ...candidate.safety_privacy_gate, status } }),
      ).toEqual(['RELEASE_SAFETY_PRIVACY_GATE_FAILED'])
    }
  })

  it('rejects a safety and privacy gate that reviewed a different cut', () => {
    const candidate = mutable(buildCandidateFixture())
    expect(
      codesFor({
        ...candidate,
        safety_privacy_gate: { ...candidate.safety_privacy_gate, reviewed_release_version: '1.9.0' },
      }),
    ).toEqual(['RELEASE_SAFETY_PRIVACY_GATE_FAILED'])
  })

  it('rejects a graduation-complete claim the coverage does not back', () => {
    const codes = codesFor(buildCandidateFixture({ grades: [5], graduationComplete: true }))
    expect(codes).toEqual(['RELEASE_GRADUATION_CLAIM_FALSE'])
  })

  it('accepts a graduation-complete claim only across the whole canonical sequence', () => {
    const short = buildCandidateFixture({ grades: [9, 10, 11, 12], graduationComplete: true })
    expect(codesFor(short)).toEqual(['RELEASE_GRADUATION_CLAIM_FALSE'])
    expect(admitCandidate(buildCanonicalCandidateFixture()).status).toBe('ADMITTED')
  })

  it('reaches every published rejection code', () => {
    const reached = new Set<AdmissionRejectionCode>()
    const candidate = buildCandidateFixture({ grades: [5, 7] })
    const mutations: ReleaseCandidate[] = [
      { ...mutable(candidate), schema_set_version: '1.0.0' },
      { ...mutable(candidate), schema_set_version: '9.0.0' },
      buildCandidateFixture({ grades: [5], declaredGrades: [5, 7] }),
      buildCandidateFixture({ grades: [6] }),
      buildCandidateFixture({ grades: [5], graduationComplete: true }),
      { ...mutable(candidate), standards_custody: [] },
      {
        ...mutable(candidate),
        safety_privacy_gate: { ...candidate.safety_privacy_gate, status: 'failed' },
      },
    ]
    const duplicated = mutable(candidate)
    mutations.push({
      ...duplicated,
      authoring_set: {
        ...duplicated.authoring_set,
        lessons: [...duplicated.authoring_set.lessons, duplicated.authoring_set.lessons[0]],
      },
    })
    const unscheduled = mutable(candidate)
    const keptSchedules = unscheduled.authoring_set.schedules.filter((schedule) => schedule.grade !== 7)
    mutations.push({
      ...unscheduled,
      authoring_set: {
        ...unscheduled.authoring_set,
        schedules: keptSchedules,
        manifest: {
          ...unscheduled.authoring_set.manifest,
          schedule_refs: keptSchedules.map((schedule) => schedule.schedule_id),
          counts: { ...unscheduled.authoring_set.manifest.counts, schedules: keptSchedules.length },
        },
      },
    })
    mutations.push(withUnsupportedSubject(mutable(candidate)))

    for (const mutation of mutations) for (const code of codesFor(mutation)) reached.add(code)
    expect([...reached].sort()).toEqual([...ADMISSION_REJECTION_CODES].sort())
  })
})

describe('admitCandidate', () => {
  it('fails closed: a rejected candidate yields no release to project', () => {
    const decision = admitCandidate(buildCandidateFixture({ grades: [6] }))
    expect(decision.status).toBe('REJECTED')
    expect(decision).not.toHaveProperty('release')
    if (decision.status === 'REJECTED') {
      expect(decision.rejection_codes).toContain('RELEASE_GRADE_UNSUPPORTED')
    }
  })

  it('carries the inspection census through to the admitted release', () => {
    const decision = admitCandidate(buildCandidateFixture({ grades: [5, 7], lessonsPerUnit: 3 }))
    expect(decision.status).toBe('ADMITTED')
    if (decision.status !== 'ADMITTED') return
    expect(decision.release.inspection.counts.lessons).toBe(6)
    expect(decision.release.inspection.observed_grades).toEqual([5, 7])
  })

  it('is deterministic for the same candidate', () => {
    const candidate = buildCanonicalCandidateFixture()
    expect(JSON.stringify(validateCandidate(candidate))).toBe(
      JSON.stringify(validateCandidate(candidate)),
    )
  })
})
