import { describe, expect, it, vi } from 'vitest'
import {
  createStudyBoundContentClient,
  StudyBoundContentContractError,
} from './studyBoundContentClient'

const request = Object.freeze({
  sessionId: 'session:server-generated-a',
  lessonRef: 'grade-5:academy-week-1-day-1',
  skillRefs: Object.freeze(['ma-g5-mathematics-u01-l01']),
})

function lesson() {
  return {
    lessonId: request.skillRefs[0],
    courseId: 'ma-g5-mathematics',
    grade: 5,
    subject: 'mathematics',
    courseDay: 1,
    unitNumber: 1,
    unitTitle: 'Whole-number reasoning',
    dayInUnit: 1,
    title: 'Learner-safe lesson',
    standards: ['5.OA.1'],
    schemaVersion: '1.0',
    learningObjectives: ['Represent the idea.'],
    successCriteria: ['Explain the reasoning.'],
    materials: ['notebook'],
    lessonFlow: [{
      segment: 'Guided practice',
      minutes: '10',
      teacherOrTutorAction: 'Present the learner-safe prompt.',
    }],
    formativeCheck: 'Show the reasoning.',
    accommodations: ['Offer an accessible response mode.'],
    media: { required: false, fallback: 'Use readable text.' },
    homeConnection: 'Notice an optional daily-life example.',
  }
}

function response() {
  return {
    schemaVersion: 1,
    status: 'ready',
    reasonCode: 'content-ready',
    sessionRef: request.sessionId,
    lessonRef: request.lessonRef,
    skillRefs: [...request.skillRefs],
    curriculumBinding: {
      schemaVersion: 1,
      releaseId: '16000000-0000-4000-8000-000000000001',
      packageId: 'manuel-academy-grades-5-7-8-curriculum-v1',
      releaseVersion: '1.0.0',
      curriculumManifestSha256: 'a'.repeat(64),
    },
    lessons: [lesson()],
  }
}

describe('Study bound-content browser DTO boundary', () => {
  it('rebuilds exact learner-safe content and sends only advisory membership refs', async () => {
    const readBoundContent = vi.fn(async () => response())
    const client = createStudyBoundContentClient({
      runtime: { readBoundContent },
      createAttemptRef: () => 'content-attempt:one',
    })
    const result = await client.load(request)

    expect(readBoundContent).toHaveBeenCalledWith({
      request,
      operationRef: 'content-attempt:one',
      signal: undefined,
    })
    expect(result).toMatchObject({
      status: 'ready',
      sessionRef: request.sessionId,
      lessonRef: request.lessonRef,
      skillRefs: request.skillRefs,
      curriculumBinding: { releaseVersion: '1.0.0' },
    })
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.status === 'ready' ? result.lessons[0] : null)).toBe(true)
  })

  it.each([
    ['server authority', { serverAuthority: { sourceRoot: 'private' } }],
    ['scoring guidance', { lessons: [{ ...lesson(), scoringGuidance: 'private answer' }] }],
    ['mastery rule', { lessons: [{ ...lesson(), masteryRule: 'private threshold' }] }],
    ['adaptive route', { lessons: [{ ...lesson(), adaptiveTutorRoutes: [] }] }],
    ['safety text', { lessons: [{ ...lesson(), safetyAndPrivacy: ['private policy'] }] }],
    ['guardian note', { lessons: [{ ...lesson(), parentVisibility: 'guardian only' }] }],
    ['source custody', { lessons: [{ ...lesson(), source: { sourceRoot: 'private' } }] }],
  ])('rejects a response containing %s', async (_label, extra) => {
    const client = createStudyBoundContentClient({
      runtime: { readBoundContent: vi.fn(async () => ({ ...response(), ...extra })) },
    })
    await expect(client.load(request)).rejects.toBeInstanceOf(StudyBoundContentContractError)
  })

  it('rejects malformed lesson order and unknown failure reasons', async () => {
    const wrongLesson = createStudyBoundContentClient({
      runtime: { readBoundContent: vi.fn(async () => ({
        ...response(), lessons: [{ ...lesson(), lessonId: 'ma-g5-mathematics-u01-l02' }],
      })) },
    })
    await expect(wrongLesson.load(request)).rejects.toBeInstanceOf(StudyBoundContentContractError)

    const unknownFailure = createStudyBoundContentClient({
      runtime: { readBoundContent: vi.fn(async () => ({
        schemaVersion: 1, status: 'unavailable', reasonCode: 'raw-database-error',
      })) },
    })
    await expect(unknownFailure.load(request)).rejects.toBeInstanceOf(StudyBoundContentContractError)
  })
})
