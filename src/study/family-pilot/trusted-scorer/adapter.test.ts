import { describe, expect, it, vi } from 'vitest'
import {
  ProductionAssessmentServerError,
  ProductionAssessmentTimeoutError,
  type ProductionItemAssessmentTransport,
} from '../../production-assessment'
import {
  G3_MATH_RESPONSE_FIXTURE,
  LearnerResponseRuntime,
  MemoryLearnerResponseStore,
  type LearnerAssessmentReceipt,
  type LearnerResponseAssessor,
  type LearnerResponseAttemptContext,
} from '../final-app/learner-response'
import { createFamilyPilotTrustedScorer } from './adapter'

const context: LearnerResponseAttemptContext = Object.freeze({
  lessonRef: 'ma-g3-mathematics-u01-l01',
  studentRef: 'student:g3',
  assignmentRef: 'assignment:g3',
  attemptRef: 'session:g3',
})

function result(request: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    status: 'assessed',
    receiptRef: `pai:${'a'.repeat(64)}`,
    assignmentRef: request.assignmentRef,
    lessonRef: request.lessonRef,
    sectionRef: request.sectionRef,
    itemRef: request.itemRef,
    attemptRef: request.attemptRef,
    resultKind: 'correct',
    evidenceKind: 'auto-score',
    rawResponseIncluded: false,
    ...overrides,
  }
}

async function firstSubmission(assessor: LearnerResponseAssessor, store = new MemoryLearnerResponseStore()) {
  const runtime = new LearnerResponseRuntime(G3_MATH_RESPONSE_FIXTURE, context, store, assessor,
    () => new Date('2026-08-14T12:00:00.000Z'))
  const view = await runtime.open(2, 'segment:practice')
  const item = view.item!
  return {
    store,
    runtime,
    item,
    submitted: runtime.submit({
      lessonRef: context.lessonRef,
      sectionRef: item.sectionRef,
      itemRef: item.itemRef,
      segmentRef: view.segmentRef,
      value: item.choices[0]!.choiceRef,
    }),
  }
}

describe('current Family Pilot trusted scorer adapter', () => {
  it('sends the allowed contract and accepts only the bound minimized result', async () => {
    let sent: Record<string, unknown> | undefined
    const assessor = createFamilyPilotTrustedScorer({
      transport: { assess: vi.fn(async (request) => {
        sent = request as unknown as Record<string, unknown>
        return result(sent)
      }) },
      now: () => new Date('2026-08-14T12:01:00.000Z'),
    })
    const submitted = await (await firstSubmission(assessor)).submitted
    expect(submitted).toMatchObject({
      status: 'saved', assessmentStatus: 'ASSESSED',
      record: { assessment: { decision: 'CORRECT', assessmentRef: `pai:${'a'.repeat(64)}` } },
    })
    expect(Object.keys(sent ?? {}).sort()).toEqual([
      'assignmentRef', 'attemptRef', 'itemRef', 'lessonRef', 'releaseId',
      'response', 'schemaVersion', 'sectionRef',
    ])
    expect(JSON.stringify(sent)).not.toMatch(/studentRef|answerKey|correctOption|rubric|resolver|serviceRole|secret/i)
  })

  it.each([
    ['503 / disabled', async () => { throw new ProductionAssessmentServerError(503) }],
    ['timeout', async () => { throw new ProductionAssessmentTimeoutError() }],
    ['network interruption', async () => { throw new TypeError('network interrupted') }],
    ['malformed result', async () => ({ status: 'assessed' })],
    ['wrong result identity', async (request: Record<string, unknown>) => result(request, { attemptRef: 'wrong:attempt' })],
  ])('keeps durable PENDING_ASSESSMENT for %s', async (_name, assess) => {
    const assessor = createFamilyPilotTrustedScorer({
      transport: { assess: assess as ProductionItemAssessmentTransport['assess'] },
    })
    const submitted = await (await firstSubmission(assessor)).submitted
    expect(submitted).toMatchObject({
      status: 'saved', assessmentStatus: 'PENDING_ASSESSMENT',
      record: { status: 'PENDING_ASSESSMENT', assessment: null },
    })
  })

  it('deduplicates the same trusted result atomically', async () => {
    let resolve!: (receipt: LearnerAssessmentReceipt) => void
    const trusted = new Promise<LearnerAssessmentReceipt>((done) => { resolve = done })
    const assessor: LearnerResponseAssessor = {
      assessorRef: 'trusted:duplicate',
      assess: vi.fn(async () => trusted),
    }
    const store = new MemoryLearnerResponseStore()
    const runtimeOne = new LearnerResponseRuntime(G3_MATH_RESPONSE_FIXTURE, context, store, assessor,
      () => new Date('2026-08-14T12:00:00.000Z'))
    const runtimeTwo = new LearnerResponseRuntime(G3_MATH_RESPONSE_FIXTURE, context, store, assessor,
      () => new Date('2026-08-14T12:00:00.000Z'))
    const viewOne = await runtimeOne.open(2, 'segment:practice')
    const viewTwo = await runtimeTwo.open(2, 'segment:practice')
    const submission = {
      lessonRef: context.lessonRef,
      sectionRef: viewOne.item!.sectionRef,
      itemRef: viewOne.item!.itemRef,
      segmentRef: viewOne.segmentRef,
      value: viewOne.item!.choices[0]!.choiceRef,
    }
    const first = runtimeOne.submit(submission)
    const second = runtimeTwo.submit({
      ...submission,
      sectionRef: viewTwo.item!.sectionRef,
      itemRef: viewTwo.item!.itemRef,
    })
    resolve({ assessmentRef: 'receipt:1', assessorRef: assessor.assessorRef, assessedAt: '2026-08-14T12:01:00.000Z', decision: 'CORRECT' })
    await expect(Promise.all([first, second])).resolves.toMatchObject([
      { assessmentStatus: 'ASSESSED' }, { assessmentStatus: 'ASSESSED' },
    ])
    expect((await store.list(context))).toHaveLength(1)
  })

  it('rejects a stale trusted result after the learner response changes', async () => {
    let resolveFirst!: (receipt: LearnerAssessmentReceipt) => void
    const firstReceipt = new Promise<LearnerAssessmentReceipt>((done) => { resolveFirst = done })
    const assessor: LearnerResponseAssessor = {
      assessorRef: 'trusted:stale',
      assess: vi.fn()
        .mockImplementationOnce(async () => firstReceipt)
        .mockRejectedValueOnce(new Error('offline')),
    }
    const store = new MemoryLearnerResponseStore()
    const runtime = new LearnerResponseRuntime(G3_MATH_RESPONSE_FIXTURE, context, store, assessor,
      () => new Date('2026-08-14T12:00:00.000Z'))
    const view = await runtime.open(2, 'segment:practice')
    const item = view.item!
    const base = { lessonRef: context.lessonRef, sectionRef: item.sectionRef, itemRef: item.itemRef, segmentRef: view.segmentRef }
    const first = runtime.submit({ ...base, value: item.choices[0]!.choiceRef })
    const newer = await runtime.submit({ ...base, value: item.choices[1]!.choiceRef })
    expect(newer).toMatchObject({ assessmentStatus: 'PENDING_ASSESSMENT' })
    resolveFirst({ assessmentRef: 'receipt:stale', assessorRef: assessor.assessorRef, assessedAt: '2026-08-14T12:01:00.000Z', decision: 'CORRECT' })
    await expect(first).resolves.toMatchObject({ assessmentStatus: 'PENDING_ASSESSMENT' })
    expect((await store.list(context))[0]).toMatchObject({
      status: 'PENDING_ASSESSMENT', response: { choiceRef: item.choices[1]!.choiceRef }, assessment: null,
    })
  })
})
