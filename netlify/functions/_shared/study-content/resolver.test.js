import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { createStudyBoundContentHandler } from '../../study-bound-content.js'
import {
  createStudyBoundContentAuthority,
  StudyBoundContentAuthorityDeniedError,
} from './authority.js'
import { createFilesystemBoundCurriculumPackageSource } from './filesystem-source.js'
import { createStudyBoundContentResolver } from './resolver.js'

const reference = `aca_stu_v1_${'A'.repeat(43)}`
const manifestSha = '54c622ac0f745f88ef4eecb359e5f4f411cf1d8c7f48899fd5fcabb32b019c7b'
const binding = Object.freeze({
  schemaVersion: 1,
  status: 'bound',
  releaseId: '16000000-0000-4000-8000-000000000001',
  packageId: 'manuel-academy-grades-5-7-8-curriculum-v1',
  releaseVersion: '1.0.0',
  curriculumManifestSha256: manifestSha,
  sourceRoot: 'curriculum-content/manuel-academy/1.0.0',
})
const lessonRef = 'grade-5:academy-week-1-day-1'
const mathSkill = 'ma-g5-mathematics-u01-l01'
const scienceSkill = 'ma-g5-science-u01-l01'
const elsewhereSkill = 'ma-g5-mathematics-u01-l02'

function authority(overrides = {}) {
  return {
    isReady: () => true,
    read: vi.fn(async () => ({
      schemaVersion: 1,
      status: 'ready',
      session: {
        sessionRef: 'session-bound-a', lessonRef,
        subjectRef: 'math', intendedLocalDate: '2026-08-10',
      },
      learnerScope: { eligibleCourseRefs: ['ma-g5-mathematics', 'ma-g5-science'] },
      curriculumBinding: binding,
      ...overrides,
    })),
  }
}

function curriculumPackage() {
  const summaries = new Map([
    [mathSkill, { lessonId: mathSkill, courseId: 'ma-g5-mathematics', grade: 5 }],
    [scienceSkill, { lessonId: scienceSkill, courseId: 'ma-g5-science', grade: 5 }],
    [elsewhereSkill, { lessonId: elsewhereSkill, courseId: 'ma-g5-mathematics', grade: 5 }],
  ])
  return {
    schemaVersion: 1,
    status: 'ready',
    lessonSummary: (ref) => summaries.get(ref) ?? null,
    scheduleDay: vi.fn(async (grade, week, day) => grade === 5 && week === 1 && day === 1
      ? { lessonRef, skillRefs: [mathSkill, scienceSkill] }
      : null),
    learnerLesson: vi.fn(async (ref) => ({
      lessonId: ref,
      title: ref === mathSkill ? 'Bound math content' : 'Bound science content',
      formativeCheck: 'Bound formative content',
    })),
  }
}

function request(overrides = {}) {
  return {
    sessionReference: reference,
    sessionId: 'session-bound-a',
    lessonRef,
    skillRefs: [mathSkill],
    ...overrides,
  }
}

describe('trusted bound curriculum content resolver', () => {
  it('loads a valid bound lesson context and only eligible scheduled skills', async () => {
    const content = curriculumPackage()
    const source = { isReady: () => true, open: vi.fn(async () => content) }
    const resolver = createStudyBoundContentResolver({ authority: authority(), packageSource: source })
    const result = await resolver.resolve(request({ skillRefs: [mathSkill, scienceSkill] }))

    expect(result).toMatchObject({
      schemaVersion: 1,
      status: 'ready',
      reasonCode: 'content-ready',
      sessionRef: 'session-bound-a',
      lessonRef,
      skillRefs: [mathSkill, scienceSkill],
      curriculumBinding: {
        releaseId: binding.releaseId,
        packageId: binding.packageId,
        releaseVersion: '1.0.0',
        curriculumManifestSha256: manifestSha,
      },
    })
    expect(result.lessons.map((lesson) => lesson.lessonId)).toEqual([mathSkill, scienceSkill])
    expect(source.open).toHaveBeenCalledWith(binding)
  })

  it.each([10, 11, 12])('parses Grade %s lesson context as the full two-digit grade', async (grade) => {
    const twoDigitLessonRef = `grade-${grade}:academy-week-1-day-1`
    const skillRef = `ma-g${grade}-mathematics-u01-l01`
    const content = {
      schemaVersion: 1,
      status: 'ready',
      lessonSummary: () => ({ lessonId: skillRef, courseId: `ma-g${grade}-mathematics`, grade }),
      scheduleDay: vi.fn(async (actualGrade, week, day) =>
        actualGrade === grade && week === 1 && day === 1
          ? { lessonRef: twoDigitLessonRef, skillRefs: [skillRef] }
          : null),
      learnerLesson: vi.fn(async () => ({ lessonId: skillRef })),
    }
    const source = { isReady: () => true, open: vi.fn(async () => content) }
    const resolver = createStudyBoundContentResolver({
      authority: authority({
        session: {
          sessionRef: 'session-bound-a', lessonRef: twoDigitLessonRef,
          subjectRef: 'math', intendedLocalDate: '2026-08-10',
        },
        learnerScope: { eligibleCourseRefs: [`ma-g${grade}-mathematics`] },
      }),
      packageSource: source,
    })

    await expect(resolver.resolve(request({
      lessonRef: twoDigitLessonRef,
      skillRefs: [skillRef],
    }))).resolves.toMatchObject({ status: 'ready', lessonRef: twoDigitLessonRef })
    expect(content.scheduleDay).toHaveBeenCalledWith(grade, 1, 1)
    expect(content.scheduleDay).not.toHaveBeenCalledWith(1, 1, 1)
  })

  it('rejects unsupported Grade 6 context before opening content', async () => {
    const gradeSixRef = 'grade-6:academy-week-1-day-1'
    const source = { isReady: () => true, open: vi.fn() }
    const resolver = createStudyBoundContentResolver({
      authority: authority({
        session: {
          sessionRef: 'session-bound-a', lessonRef: gradeSixRef,
          subjectRef: 'math', intendedLocalDate: '2026-08-10',
        },
      }),
      packageSource: source,
    })
    await expect(resolver.resolve(request({ lessonRef: gradeSixRef }))).resolves.toMatchObject({
      status: 'unsupported', reasonCode: 'lesson-context-unsupported',
    })
    expect(source.open).not.toHaveBeenCalled()
  })

  it('distinguishes a missing lesson context, a missing skill, and a skill from elsewhere', async () => {
    const content = curriculumPackage()
    const source = { isReady: () => true, open: vi.fn(async () => content) }
    const missingLessonAuthority = authority({
      session: {
        sessionRef: 'session-bound-a', lessonRef: 'grade-5:academy-week-36-day-5',
        subjectRef: 'math', intendedLocalDate: '2026-08-10',
      },
    })
    await expect(createStudyBoundContentResolver({
      authority: missingLessonAuthority, packageSource: source,
    }).resolve(request({ lessonRef: 'grade-5:academy-week-36-day-5' }))).resolves.toMatchObject({
      status: 'not_found', reasonCode: 'lesson-context-not-found',
    })
    await expect(createStudyBoundContentResolver({
      authority: authority(), packageSource: source,
    }).resolve(request({ skillRefs: ['ma-g5-mathematics-u99-l99'] }))).resolves.toMatchObject({
      status: 'not_found', reasonCode: 'skill-ref-not-found',
      rejectedSkillRef: 'ma-g5-mathematics-u99-l99',
    })
    await expect(createStudyBoundContentResolver({
      authority: authority(), packageSource: source,
    }).resolve(request({ skillRefs: [elsewhereSkill] }))).resolves.toMatchObject({
      status: 'membership_mismatch', reasonCode: 'skill-not-eligible-for-lesson',
      rejectedSkillRef: elsewhereSkill,
    })
  })

  it('rejects advisory lesson drift and learner-course scope mismatches', async () => {
    const content = curriculumPackage()
    const source = { isReady: () => true, open: vi.fn(async () => content) }
    await expect(createStudyBoundContentResolver({
      authority: authority(), packageSource: source,
    }).resolve(request({ lessonRef: 'grade-5:academy-week-1-day-2' }))).resolves.toMatchObject({
      status: 'membership_mismatch', reasonCode: 'advisory-lesson-mismatch',
    })
    await expect(createStudyBoundContentResolver({
      authority: authority({ learnerScope: { eligibleCourseRefs: ['ma-g5-science'] } }),
      packageSource: source,
    }).resolve(request())).resolves.toMatchObject({
      status: 'membership_mismatch', reasonCode: 'skill-not-eligible-for-learner',
    })
  })

  it.each([
    ['wrong release', 'release_unavailable', 'bound-release-identity-mismatch'],
    ['manifest drift', 'manifest_mismatch', 'curriculum-manifest-mismatch'],
  ])('fails closed for %s', async (_label, status, reasonCode) => {
    const source = {
      isReady: () => true,
      open: vi.fn(async () => ({ schemaVersion: 1, status, reasonCode })),
    }
    await expect(createStudyBoundContentResolver({
      authority: authority(), packageSource: source,
    }).resolve(request())).resolves.toMatchObject({ status, reasonCode })
  })

  it('uses the old bound release after the active pointer changes', async () => {
    const activePointer = { releaseVersion: '2.0.0' }
    const source = {
      isReady: () => true,
      open: vi.fn(async (requestedBinding) => {
        expect(activePointer.releaseVersion).toBe('2.0.0')
        expect(requestedBinding.releaseVersion).toBe('1.0.0')
        return curriculumPackage()
      }),
    }
    await expect(createStudyBoundContentResolver({
      authority: authority(), packageSource: source,
    }).resolve(request())).resolves.toMatchObject({
      status: 'ready', curriculumBinding: { releaseVersion: '1.0.0' },
    })
  })

  it('never falls back when the exact package is unavailable', async () => {
    const open = vi.fn(async () => ({
      schemaVersion: 1, status: 'release_unavailable', reasonCode: 'bound-release-unavailable',
    }))
    await expect(createStudyBoundContentResolver({
      authority: authority(), packageSource: { isReady: () => true, open },
    }).resolve(request())).resolves.toMatchObject({
      status: 'release_unavailable', reasonCode: 'bound-release-unavailable',
    })
    expect(open).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledWith(binding)
    expect(JSON.stringify(open.mock.calls)).not.toMatch(/demo|preview|latest|active/i)
  })

  it('keeps legacy unbound sessions unavailable and emits only privacy-safe decisions', async () => {
    const onDecision = vi.fn()
    const source = { isReady: () => true, open: vi.fn() }
    const legacy = authority({
      schemaVersion: 1,
      status: 'manual-review',
      reasonCode: 'legacy-curriculum-binding-ambiguous',
      session: undefined,
      learnerScope: undefined,
      curriculumBinding: undefined,
    })
    await expect(createStudyBoundContentResolver({
      authority: legacy, packageSource: source, onDecision,
    }).resolve(request())).resolves.toEqual({
      schemaVersion: 1,
      status: 'unavailable',
      reasonCode: 'legacy-curriculum-binding-ambiguous',
    })
    expect(source.open).not.toHaveBeenCalled()
    expect(onDecision).toHaveBeenCalledWith({
      schemaVersion: 1,
      status: 'unavailable',
      reasonCode: 'legacy-curriculum-binding-ambiguous',
      sessionRef: 'session-bound-a',
      lessonRef,
      skillRefs: [mathSkill],
    })
    expect(JSON.stringify(onDecision.mock.calls)).not.toMatch(/Bound formative content|answer|question|resource/i)
  })
})

describe('immutable filesystem package source', () => {
  it('verifies the bound manifest and reuses the existing canonical curriculum read model', async () => {
    const source = createFilesystemBoundCurriculumPackageSource()
    const opened = await source.open(binding)
    expect(opened.status).toBe('ready')
    if (opened.status !== 'ready') return
    await expect(opened.scheduleDay(5, 1, 1)).resolves.toMatchObject({
      lessonRef,
      skillRefs: expect.arrayContaining([mathSkill]),
    })
    const lesson = await opened.learnerLesson(mathSkill)
    expect(lesson).toMatchObject({ lessonId: mathSkill, title: expect.any(String) })
    expect(lesson).not.toHaveProperty('scoringGuidance')
    expect(lesson).not.toHaveProperty('masteryRule')
    expect(lesson).not.toHaveProperty('adaptiveTutorRoutes')
    expect(lesson).not.toHaveProperty('safetyAndPrivacy')
    expect(lesson).not.toHaveProperty('parentVisibility')
    expect(lesson).not.toHaveProperty('assessment')
    expect(lesson).not.toHaveProperty('source')
  })

  it('returns bounded mismatch and exact-release-unavailable outcomes without substitution', async () => {
    const source = createFilesystemBoundCurriculumPackageSource()
    await expect(source.open({
      ...binding, curriculumManifestSha256: 'f'.repeat(64),
    })).resolves.toEqual({
      schemaVersion: 1, status: 'manifest_mismatch', reasonCode: 'curriculum-manifest-mismatch',
    })
    await expect(source.open({
      ...binding,
      releaseId: '26000000-0000-4000-8000-000000000002',
      packageId: 'manuel-academy-grades-5-7-8-curriculum-v2',
      releaseVersion: '2.0.0',
      sourceRoot: 'curriculum-content/manuel-academy/2.0.0',
      curriculumManifestSha256: 'b'.repeat(64),
    })).resolves.toEqual({
      schemaVersion: 1, status: 'release_unavailable', reasonCode: 'bound-release-unavailable',
    })
  })
})

describe('bound content server authority and HTTP seam', () => {
  it('reads authority by opaque token digest and validates the minimized contract', async () => {
    const call = vi.fn(async () => ({
      schemaVersion: 1,
      status: 'ready',
      session: {
        sessionRef: 'session-bound-a', lessonRef,
        subjectRef: 'math', intendedLocalDate: '2026-08-10',
      },
      learnerScope: { eligibleCourseRefs: ['ma-g5-mathematics'] },
      curriculumBinding: binding,
    }))
    const contentAuthority = createStudyBoundContentAuthority({
      rpc: { isConfigured: () => true, call },
    })
    await expect(contentAuthority.read({
      sessionReference: reference, sessionId: 'session-bound-a',
    })).resolves.toMatchObject({ status: 'ready', curriculumBinding: binding })
    expect(call).toHaveBeenCalledWith('academy_study_read_bound_content_authority_v1', {
      p_token_digest: createHash('sha256').update(reference, 'ascii').digest('hex'),
      p_session_id: 'session-bound-a',
    })
  })

  it('exposes a bearer-only minimized endpoint without browser release authority', async () => {
    const resolve = vi.fn(async () => ({
      schemaVersion: 1, status: 'ready', reasonCode: 'content-ready', lessons: [],
    }))
    const handler = createStudyBoundContentHandler({
      env: { ACADEMY_STUDY_ENABLED: 'true' },
      resolver: { isReady: () => true, resolve },
    })
    const response = await handler({
      path: '/api/study/bound-content',
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${reference}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 1, sessionId: 'session-bound-a', lessonRef, skillRefs: [mathSkill],
      }),
    })
    expect(response.statusCode).toBe(200)
    expect(resolve).toHaveBeenCalledWith({
      sessionReference: reference, sessionId: 'session-bound-a', lessonRef, skillRefs: [mathSkill],
    })
    expect(JSON.stringify(resolve.mock.calls[0][0])).not.toMatch(/releaseId|packageId|manifest|studentId|learner/i)
    expect((await handler({
      path: '/api/study/bound-content', httpMethod: 'POST', headers: {},
    })).statusCode).toBe(401)
  })

  it('maps denied authority to the same bounded learner-session error', async () => {
    const handler = createStudyBoundContentHandler({
      env: { ACADEMY_STUDY_ENABLED: 'true' },
      resolver: {
        isReady: () => true,
        resolve: vi.fn(async () => { throw new StudyBoundContentAuthorityDeniedError('private') }),
      },
    })
    const response = await handler({
      path: '/api/study/bound-content',
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${reference}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 1, sessionId: 'session-bound-a', lessonRef, skillRefs: [mathSkill],
      }),
    })
    expect(response.statusCode).toBe(401)
    expect(response.body).toBe('{"error":{"code":"student_session_invalid"}}')
  })
})
