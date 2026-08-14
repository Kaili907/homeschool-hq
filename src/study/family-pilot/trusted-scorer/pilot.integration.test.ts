import { describe, expect, it, vi } from 'vitest'
import { createProductionItemFetchTransport } from '../../production-assessment'
import {
  G3_MATH_RESPONSE_FIXTURE,
  LearnerResponseRuntime,
  MemoryLearnerResponseStore,
} from '../final-app/learner-response'
// @ts-expect-error Netlify functions are runtime JavaScript modules.
import { createProductionItemAssessmentHandler } from '../../../../netlify/functions/production-item-assessment.js'
// @ts-expect-error Netlify functions are runtime JavaScript modules.
import { createProductionItemAssessmentService } from '../../../../netlify/functions/production-item-resolver.js'
import { createFamilyPilotTrustedScorer } from './adapter'

const TOKEN = `aca_stu_v1_${'A'.repeat(43)}`
const STUDENT = '8c452df8-a0d7-4f64-a4e0-a2c87625a210'
const LESSON = 'ma-g3-mathematics-u01-l01'
const ITEM = `${LESSON}#ip-01`

function serverHarness() {
  const studyEvidence: Record<string, unknown>[] = []
  const received: Record<string, unknown>[] = []
  const serverResponses: { readonly statusCode: number; readonly body: string }[] = []
  const authority = {
    isReady: () => true,
    authorize: vi.fn(async ({ sessionReference, assignmentRef, lessonRef }: Record<string, string>) =>
      sessionReference === TOKEN && assignmentRef === 'bound:study-session:g3' && lessonRef === LESSON
        ? { status: 'authorized', studentRef: STUDENT }
        : { status: 'denied' }),
  }
  const resolver = {
    isReady: () => true,
    resolve: (request: Record<string, unknown>) => request.lessonRef === LESSON &&
      request.sectionRef === 'ip' && request.itemRef === ITEM
      ? Object.freeze({
          itemRef: ITEM,
          scoringMode: 'fixed-multiple-choice',
          choices: Object.freeze(['trusted correct authority', 'trusted distractor']),
          expected: 'trusted correct authority',
        })
      : null,
  }
  const service = createProductionItemAssessmentService({
    resolver,
    authority,
    evidencePort: {
      appendProductionItemEvidence: vi.fn(async (evidence: Record<string, unknown>) => {
        studyEvidence.push(evidence)
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
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    received.push(body)
    const response = await handler({
      path: String(input),
      httpMethod: init?.method,
      headers: init?.headers,
      body: JSON.stringify(body),
    })
    serverResponses.push(response)
    return new Response(response.body, {
      status: response.statusCode,
      headers: response.headers,
    })
  })
  return { authority, fetchImpl, received, serverResponses, studyEvidence }
}

async function submit(fetchImpl: typeof fetch, token = TOKEN, assignmentRef = 'bound:study-session:g3') {
  const scorer = createFamilyPilotTrustedScorer({
    transport: createProductionItemFetchTransport(fetchImpl, () => token),
    bindAttempt: () => ({ assignmentRef, attemptRef: 'attempt:g3:item:1' }),
    now: () => new Date('2026-08-14T12:01:00.000Z'),
  })
  const store = new MemoryLearnerResponseStore()
  const runtime = new LearnerResponseRuntime(G3_MATH_RESPONSE_FIXTURE, {
    lessonRef: LESSON,
    studentRef: 'local:student:g3',
    assignmentRef: 'local:assignment:g3',
    attemptRef: 'local:session:g3',
  }, store, scorer, () => new Date('2026-08-14T12:00:00.000Z'))
  const opened = await runtime.open(2, 'segment:practice')
  const item = opened.item!
  const outcome = await runtime.submit({
    lessonRef: LESSON,
    sectionRef: item.sectionRef,
    itemRef: item.itemRef,
    segmentRef: opened.segmentRef,
    value: item.choices[0]!.choiceRef,
  })
  return { outcome, after: await runtime.open(2, opened.segmentRef) }
}

describe('trusted scorer current-pilot local server convergence', () => {
  it('submits only allowed fields, scores under server authority, records Study evidence, and preserves Study progression contracts', async () => {
    const harness = serverHarness()
    const { outcome, after } = await submit(harness.fetchImpl as typeof fetch)

    expect(harness.serverResponses).toMatchObject([{ statusCode: 200 }])
    expect(harness.studyEvidence).toHaveLength(1)
    expect(outcome).toMatchObject({
      assessmentStatus: 'ASSESSED',
      record: { assessment: { decision: 'CORRECT' } },
    })
    expect(harness.received).toHaveLength(1)
    expect(harness.received[0]).toMatchObject({
      schemaVersion: 1,
      operation: 'assess',
      request: {
        releaseId: 'family-pilot-r1',
        assignmentRef: 'bound:study-session:g3',
        lessonRef: LESSON,
        sectionRef: 'ip',
        itemRef: ITEM,
        attemptRef: 'attempt:g3:item:1',
        response: { kind: 'choice', choiceRef: `${ITEM}:choice-1` },
      },
    })
    expect(Object.keys((harness.received[0].request as Record<string, unknown>)).sort()).toEqual([
      'assignmentRef', 'attemptRef', 'itemRef', 'lessonRef', 'releaseId',
      'response', 'schemaVersion', 'sectionRef',
    ])
    expect(JSON.stringify(harness.received)).not.toMatch(/studentRef|answerKey|correctOption|scoringRubric|resolverPayload|serviceRole|secret/i)
    expect(harness.studyEvidence).toMatchObject([{
      studentRef: STUDENT,
      resultKind: 'correct',
      evidenceKind: 'auto-score',
      rawResponseIncluded: false,
    }])
    expect(JSON.stringify(outcome)).not.toContain(STUDENT)
    // A trusted result does not bypass the existing requirement to save the
    // second response in this Study segment.
    expect(after.canCompleteSegment).toBe(false)
  })

  it.each([
    ['wrong learner session', `aca_stu_v1_${'B'.repeat(43)}`, 'bound:study-session:g3'],
    ['wrong bound Study session', TOKEN, 'bound:wrong-session'],
  ])('fails closed for %s', async (_name, token, assignmentRef) => {
    const harness = serverHarness()
    const { outcome } = await submit(harness.fetchImpl as typeof fetch, token, assignmentRef)
    expect(outcome).toMatchObject({
      assessmentStatus: 'PENDING_ASSESSMENT',
      record: { status: 'PENDING_ASSESSMENT', assessment: null },
    })
    expect(harness.studyEvidence).toEqual([])
  })
})
