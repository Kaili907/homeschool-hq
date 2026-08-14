import { describe, expect, it, vi } from 'vitest'
import {
  createProductionItemAssessmentHandler,
  familyPilotTrustedScorerEnabled,
} from './production-item-assessment.js'
import {
  createFilesystemProductionItemResolver,
  createProductionItemAuthority,
  createProductionItemAssessmentService,
  scoreResolvedProductionItem,
} from './production-item-resolver.js'

const TOKEN = `aca_stu_v1_${'A'.repeat(43)}`
const RELEASE = 'family-pilot-r1'
const MATH_LESSON = 'ma-g5-mathematics-u01-l01'
const MATH_ITEM = `${MATH_LESSON}#ip-01`

function event(operation, request, overrides = {}) {
  return {
    path: '/api/study/production-item-assessment',
    httpMethod: 'POST',
    headers: {
      authorization: `Bearer ${TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ schemaVersion: 1, operation, request: { schemaVersion: 1, ...request } }),
    ...overrides,
  }
}

function body(response) {
  return JSON.parse(response.body)
}

function harness() {
  const resolver = createFilesystemProductionItemResolver({ workspaceRoot: process.cwd() })
  const evidence = []
  const reviews = []
  const authority = {
    isReady: () => true,
    authorize: vi.fn(async () => ({
      status: 'authorized',
      studentRef: '8c452df8-a0d7-4f64-a4e0-a2c87625a210',
    })),
  }
  const service = createProductionItemAssessmentService({
    resolver,
    authority,
    evidencePort: {
      appendProductionItemEvidence: vi.fn(async (record) => {
        evidence.push(record)
        return { status: 'accepted' }
      }),
    },
    adultReviewPort: {
      submitProtectedResponse: vi.fn(async (record) => {
        reviews.push(record)
        return { status: 'accepted' }
      }),
    },
  })
  const handler = createProductionItemAssessmentHandler({
    env: {
      ACADEMY_STUDY_ENABLED: 'true',
      ACADEMY_FAMILY_PILOT_TRUSTED_SCORER_ENABLED: 'true',
      ACADEMY_DEPLOYMENT_ENV: 'test',
    },
    service,
  })
  return { resolver, authority, service, handler, evidence, reviews }
}

const mathIdentity = {
  releaseId: RELEASE,
  assignmentRef: 'study-session-1',
  lessonRef: MATH_LESSON,
  sectionRef: 'ip',
  itemRef: MATH_ITEM,
}

describe('production item trusted resolver and gateway', () => {
  it('requires an explicit non-production pilot flag', () => {
    expect(familyPilotTrustedScorerEnabled({})).toBe(false)
    expect(familyPilotTrustedScorerEnabled({
      ACADEMY_FAMILY_PILOT_TRUSTED_SCORER_ENABLED: 'true',
      ACADEMY_DEPLOYMENT_ENV: 'production',
    })).toBe(false)
    expect(familyPilotTrustedScorerEnabled({
      ACADEMY_FAMILY_PILOT_TRUSTED_SCORER_ENABLED: 'true',
      ACADEMY_DEPLOYMENT_ENV: 'staging',
    })).toBe(true)
  })

  it('keeps the real handler disabled when the scorer pilot lock is absent or production-scoped', async () => {
    const service = { isReady: () => true }
    const absent = createProductionItemAssessmentHandler({
      env: { ACADEMY_STUDY_ENABLED: 'true' }, service,
    })
    const production = createProductionItemAssessmentHandler({
      env: {
        ACADEMY_STUDY_ENABLED: 'true',
        ACADEMY_FAMILY_PILOT_TRUSTED_SCORER_ENABLED: 'true',
        ACADEMY_DEPLOYMENT_ENV: 'production',
      },
      service,
    })
    await expect(absent(event('project', mathIdentity))).resolves.toMatchObject({
      statusCode: 503, body: JSON.stringify({ error: { code: 'gateway_disabled' } }),
    })
    await expect(production(event('project', mathIdentity))).resolves.toMatchObject({
      statusCode: 503, body: JSON.stringify({ error: { code: 'gateway_disabled' } }),
    })
  })

  it('projects G5 Math U1 L1 without answer authority leakage', async () => {
    const { handler } = harness()
    const response = await handler(event('project', mathIdentity))
    expect(response.statusCode).toBe(200)
    const projected = body(response)
    expect(projected).toMatchObject({
      lessonRef: MATH_LESSON,
      itemRef: MATH_ITEM,
      responseKind: 'choice',
      disposition: 'trusted-auto-score',
    })
    expect(projected.choices).toHaveLength(4)
    const serialized = response.body.toLowerCase()
    for (const leak of ['answerindex', 'answerkey', 'expectedanswer', 'correctanswer',
      'answer-keys/', '.key.json', 'productionpackageref', 'scoringauthorityref']) {
      expect(serialized).not.toContain(leak)
    }
  })

  it('auto-scores G5 Math from trusted answer text, not answerIndex', async () => {
    const { handler, evidence } = harness()
    const response = await handler(event('assess', {
      ...mathIdentity,
      attemptRef: 'attempt-1',
      response: { kind: 'choice', choiceRef: `${MATH_ITEM}:choice-3` },
    }))
    expect(response.statusCode).toBe(200)
    expect(body(response)).toMatchObject({
      resultKind: 'correct',
      evidenceKind: 'auto-score',
      rawResponseIncluded: false,
    })
    expect(response.body).not.toContain('(13 + 8)')
    expect(response.body).not.toContain('studentRef')
    expect(evidence[0]).toMatchObject({
      studentRef: '8c452df8-a0d7-4f64-a4e0-a2c87625a210',
      assignmentRef: 'study-session-1',
      lessonRef: MATH_LESSON,
      sectionRef: 'ip',
      itemRef: MATH_ITEM,
      attemptRef: 'attempt-1',
      resultKind: 'correct',
      evidenceKind: 'auto-score',
      rawResponseIncluded: false,
    })
    expect(scoreResolvedProductionItem({
      itemRef: 'item-1', scoringMode: 'fixed-multiple-choice',
      choices: ['wrong', 'right'], expected: 'right', answerIndex: 0,
    }, { kind: 'choice', choiceRef: 'item-1:choice-2' })).toBe('correct')
  })

  it('supports the complete closed scoring taxonomy without inventing scores', () => {
    expect(scoreResolvedProductionItem({
      scoringMode: 'fixed-short-response', expected: 'Blue whale', itemRef: 'short-1',
    }, { kind: 'text', text: '  blue  whale ' })).toBe('correct')
    expect(scoreResolvedProductionItem({
      scoringMode: 'deterministic-computational', expected: '$135.00', itemRef: 'numeric-1',
    }, { kind: 'text', text: '135' })).toBe('correct')
    expect(scoreResolvedProductionItem({
      scoringMode: 'constructed-rubric-review', itemRef: 'rubric-1',
    }, { kind: 'text', text: 'Learner-authored work' })).toBe('review-required')
    expect(scoreResolvedProductionItem({
      scoringMode: 'guardian-attestation', itemRef: 'guardian-1',
    }, { kind: 'completion', completed: true })).toBe('guardian-attestation-required')
    expect(scoreResolvedProductionItem({
      scoringMode: 'completion-only', itemRef: 'completion-1',
    }, { kind: 'completion', completed: true })).toBe('completion-recorded')
    expect(scoreResolvedProductionItem({
      scoringMode: 'unsupported', itemRef: 'unsupported-1',
    }, { kind: 'completion', completed: true })).toBe('unsupported')
  })

  it('derives student and exact assignment/lesson/release binding from trusted Study authority', async () => {
    const env = {
      ACADEMY_PRODUCTION_ITEM_ADMITTED_RELEASE_ID: RELEASE,
      ACADEMY_PRODUCTION_ITEM_RELEASE_VERSION: '2.0.0',
      ACADEMY_PRODUCTION_ITEM_BOUND_RELEASE_ID: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ACADEMY_PRODUCTION_ITEM_BOUND_MANIFEST_SHA256: 'b'.repeat(64),
    }
    const verifier = {
      isReady: () => true,
      verify: vi.fn(async () => ({
        status: 'verified', studentId: '8c452df8-a0d7-4f64-a4e0-a2c87625a210',
      })),
    }
    const boundContentAuthority = {
      isReady: () => true,
      read: vi.fn(async () => ({
        status: 'ready',
        session: { sessionRef: 'study-session-1', lessonRef: MATH_LESSON },
        curriculumBinding: {
          releaseId: env.ACADEMY_PRODUCTION_ITEM_BOUND_RELEASE_ID,
          releaseVersion: env.ACADEMY_PRODUCTION_ITEM_RELEASE_VERSION,
          curriculumManifestSha256: env.ACADEMY_PRODUCTION_ITEM_BOUND_MANIFEST_SHA256,
        },
      })),
    }
    const authority = createProductionItemAuthority({ env, verifier, boundContentAuthority })
    expect(authority.isReady()).toBe(true)
    await expect(authority.authorize({
      sessionReference: TOKEN,
      assignmentRef: 'study-session-1',
      releaseId: RELEASE,
      lessonRef: MATH_LESSON,
    })).resolves.toEqual({
      status: 'authorized', studentRef: '8c452df8-a0d7-4f64-a4e0-a2c87625a210',
    })
    await expect(authority.authorize({
      sessionReference: TOKEN,
      assignmentRef: 'study-session-tampered',
      releaseId: RELEASE,
      lessonRef: MATH_LESSON,
    })).resolves.toEqual({ status: 'denied' })
    await expect(authority.authorize({
      sessionReference: TOKEN,
      assignmentRef: 'study-session-1',
      releaseId: 'different-release',
      lessonRef: MATH_LESSON,
    })).resolves.toEqual({ status: 'denied' })
    await expect(authority.authorize({
      sessionReference: TOKEN,
      assignmentRef: 'study-session-1',
      releaseId: RELEASE,
      lessonRef: 'ma-g5-mathematics-u01-l02',
    })).resolves.toEqual({ status: 'denied' })
  })

  it.each([
    ['wrong lesson', { ...mathIdentity, lessonRef: 'ma-g5-mathematics-u01-l02' }],
    ['wrong item binding', { ...mathIdentity, itemRef: 'ma-g3-mathematics-u01-l01#ip-01' }],
    ['wrong section', { ...mathIdentity, sectionRef: 'mc' }],
  ])('fails closed for %s', async (_name, identity) => {
    const { handler } = harness()
    const response = await handler(event('project', identity))
    expect(response.statusCode).toBe(404)
  })

  it.each([
    ['answerIndex', 2],
    ['expectedAnswer', '(13 + 8) × 7'],
    ['answerKeyPath', '/answer-keys/key.json'],
  ])('rejects caller %s authority', async (key, value) => {
    const { handler } = harness()
    const response = await handler(event('assess', {
      ...mathIdentity,
      attemptRef: 'attempt-tamper',
      response: { kind: 'choice', choiceRef: `${MATH_ITEM}:choice-3` },
      [key]: value,
    }))
    expect(response.statusCode).toBe(400)
  })

  it('routes rubric prose to protected adult review and never accepts a fabricated score', async () => {
    const { handler, reviews, evidence } = harness()
    const lessonRef = 'ma-g5-english-language-arts-u01-l01'
    const identity = {
      releaseId: RELEASE,
      assignmentRef: 'study-session-ela',
      lessonRef,
      sectionRef: 'production-evidence',
      itemRef: `${lessonRef}#production-evidence`,
      attemptRef: 'attempt-ela-1',
    }
    const tampered = await handler(event('assess', {
      ...identity,
      response: { kind: 'text', text: 'My independent explanation.', score: 4 },
    }))
    expect(tampered.statusCode).toBe(400)

    const response = await handler(event('assess', {
      ...identity,
      response: { kind: 'text', text: 'My independent explanation.' },
    }))
    expect(response.statusCode).toBe(200)
    expect(body(response)).toMatchObject({
      status: 'pending-review',
      resultKind: 'review-required',
      evidenceKind: 'adult-review-request',
      rawResponseIncluded: false,
    })
    expect(body(response)).not.toHaveProperty('score')
    expect(response.body).not.toContain('My independent explanation.')
    expect(reviews[0].response).toBe('My independent explanation.')
    expect(evidence[0]).not.toHaveProperty('response')
  })

  it('records learner completion as pending guardian attestation, never certification', async () => {
    const { handler } = harness()
    const lessonRef = 'ma-g3-ready-for-life-u01-l04'
    const response = await handler(event('assess', {
      releaseId: RELEASE,
      assignmentRef: 'study-session-rfl',
      lessonRef,
      sectionRef: 't2',
      itemRef: 't2-p1',
      attemptRef: 'attempt-rfl-1',
      response: { kind: 'completion', completed: true },
    }))
    expect(response.statusCode).toBe(200)
    expect(body(response)).toMatchObject({
      status: 'pending-guardian-attestation',
      resultKind: 'guardian-attestation-required',
    })
    expect(response.body).not.toContain('certified')
  })

  it('proves admitted representative compatibility across every requested subject', () => {
    const { resolver } = harness()
    const byLesson = new Map(resolver.compatibility().map((row) => [row.lessonRef, row.scoringMode]))
    expect(byLesson.get('ma-g5-mathematics-u01-l01')).toBe('fixed-short-response')
    expect(byLesson.get('ma-g5-english-language-arts-u01-l01')).toBe('constructed-rubric-review')
    expect(byLesson.get('ma-g5-science-u01-l01')).toBe('constructed-rubric-review')
    expect(byLesson.get('ma-g5-social-studies-u01-l01')).toBe('constructed-rubric-review')
    expect(byLesson.get('ma-g5-health-u01-l01')).toBe('constructed-rubric-review')
    expect(byLesson.get('ma-g5-physical-education-u01-l01')).toBe('constructed-rubric-review')
    expect(byLesson.get('ma-g5-ready-for-life-u01-l01')).toBe('constructed-rubric-review')
    expect(byLesson.get('ma-g5-financial-literacy-u01-l01')).toBe('deterministic-computational')
    expect(byLesson.get('ma-g5-technology-u01-l01')).toBe('constructed-rubric-review')
    expect(byLesson.get('ma-g5-arts-and-music-u01-l01')).toBe('constructed-rubric-review')

    const representatives = [
      [MATH_LESSON, 'ip', MATH_ITEM, 'fixed-multiple-choice'],
      ['ma-g5-english-language-arts-u01-l01', 'production-evidence',
        'ma-g5-english-language-arts-u01-l01#production-evidence', 'constructed-rubric-review'],
      ['ma-g5-science-u01-l01', 'production-evidence',
        'ma-g5-science-u01-l01#production-evidence', 'constructed-rubric-review'],
      ['ma-g5-social-studies-u01-l01', 'production-evidence',
        'ma-g5-social-studies-u01-l01#production-evidence', 'constructed-rubric-review'],
      ['ma-g5-health-u01-l01', 'production-evidence',
        'ma-g5-health-u01-l01#production-evidence', 'constructed-rubric-review'],
      ['ma-g5-physical-education-u01-l01', 'production-evidence',
        'ma-g5-physical-education-u01-l01#production-evidence', 'constructed-rubric-review'],
      ['ma-g5-ready-for-life-u01-l01', 't1', 't1-p1', 'constructed-rubric-review'],
      ['ma-g5-financial-literacy-u01-l01', 't1', 't1-p1', 'deterministic-computational'],
      ['ma-g5-technology-u01-l01', 'production-evidence',
        'ma-g5-technology-u01-l01#production-evidence', 'constructed-rubric-review'],
      ['ma-g5-arts-and-music-u01-l01', 'production-evidence',
        'ma-g5-arts-and-music-u01-l01#production-evidence', 'constructed-rubric-review'],
    ]
    for (const [lessonRef, sectionRef, itemRef, scoringMode] of representatives) {
      const resolved = resolver.resolve({ releaseId: RELEASE, lessonRef, sectionRef, itemRef })
      expect(resolved?.scoringMode, lessonRef).toBe(scoringMode)
      expect(resolved?.learnerItem.disposition, lessonRef).not.toBe('unsupported')
    }
    const finLit = resolver.resolve({
      releaseId: RELEASE,
      lessonRef: 'ma-g5-financial-literacy-u01-l01',
      sectionRef: 't1',
      itemRef: 't1-p1',
    })
    expect(scoreResolvedProductionItem(finLit, { kind: 'text', text: '$135.00' })).toBe('correct')
  })

  it('keeps G3 U1 L1 as a current-contract fixture without altering content', () => {
    const { resolver } = harness()
    const lessonRef = 'ma-g3-mathematics-u01-l01'
    const resolved = resolver.resolve({
      releaseId: RELEASE,
      lessonRef,
      sectionRef: 'ip',
      itemRef: `${lessonRef}#ip-01`,
    })
    expect(resolved?.learnerItem).toMatchObject({ lessonRef, responseKind: 'choice' })
  })
})
