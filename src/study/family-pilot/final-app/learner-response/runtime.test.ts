import { describe, expect, it, vi } from 'vitest'
import { G3_MATH_RESPONSE_FIXTURE } from './fixtures'
import { LearnerResponseRuntime } from './runtime'
import { BrowserLearnerResponseStore, FAMILY_PILOT_LEARNER_RESPONSES_KEY, MemoryLearnerResponseStore } from './store'
import type { LearnerResponseAssessor, LearnerResponseAttemptContext, LearnerResponseStore } from './types'

const context: LearnerResponseAttemptContext = Object.freeze({
  lessonRef: 'ma-g3-mathematics-u01-l01', studentRef: 'student:g3', assignmentRef: 'assignment:g3', attemptRef: 'session:g3',
})

function runtime(store: LearnerResponseStore = new MemoryLearnerResponseStore(), assessor?: LearnerResponseAssessor) {
  return new LearnerResponseRuntime(G3_MATH_RESPONSE_FIXTURE, context, store, assessor, () => new Date('2026-08-13T15:00:00.000Z'))
}

describe('LearnerResponseRuntime', () => {
  it('stores all identity refs and stays pending when no assessor is injected', async () => {
    const store = new MemoryLearnerResponseStore()
    const held = runtime(store)
    const view = held.open(2, 'ma-g3-mathematics-u01-l01:segment:practice')
    const item = view.item!
    const saved = await held.submit({ lessonRef: context.lessonRef, sectionRef: item.sectionRef, itemRef: item.itemRef, segmentRef: view.segmentRef, value: item.choices[0]!.choiceRef })
    expect(saved.status).toBe('saved')
    if (saved.status !== 'saved') return
    expect(saved.assessmentStatus).toBe('PENDING_ASSESSMENT')
    expect(saved.record).toMatchObject({
      lessonRef: context.lessonRef, sectionRef: 'ip', itemRef: 'ma-g3-mathematics-u01-l01#ip-01',
      studentRef: 'student:g3', assignmentRef: 'assignment:g3', attemptRef: 'session:g3',
      segmentRef: 'ma-g3-mathematics-u01-l01:segment:practice', status: 'PENDING_ASSESSMENT', assessment: null,
    })
    expect(saved.record.response).toEqual({ kind: 'CHOICE', choiceRef: item.choices[0]!.choiceRef })
  })

  it('does not advance on a no-op submission and rejects lost/wrong identity', async () => {
    const held = runtime()
    const view = held.open(2, 'segment:practice')
    const item = view.item!
    expect(await held.submit({ lessonRef: context.lessonRef, sectionRef: item.sectionRef, itemRef: item.itemRef, segmentRef: view.segmentRef, value: ' ' })).toMatchObject({ status: 'rejected', reason: 'empty-response' })
    expect(await held.submit({ lessonRef: context.lessonRef, sectionRef: item.sectionRef, itemRef: '', segmentRef: view.segmentRef, value: 'x' })).toMatchObject({ status: 'rejected', reason: 'lost-item-ref' })
    expect(await held.submit({ lessonRef: 'wrong:lesson', sectionRef: item.sectionRef, itemRef: item.itemRef, segmentRef: view.segmentRef, value: 'x' })).toMatchObject({ status: 'rejected', reason: 'wrong-lesson' })
    expect(held.open(2, view.segmentRef).answeredItemRefs).toEqual([])
    expect(held.open(2, view.segmentRef).canCompleteSegment).toBe(false)
  })

  it('rejects a flattened choice label or foreign choice ref instead of accepting ambiguous text', async () => {
    const held = runtime()
    const view = held.open(2, 'segment:practice')
    const item = view.item!
    expect(await held.submit({ lessonRef: context.lessonRef, sectionRef: item.sectionRef, itemRef: item.itemRef, segmentRef: view.segmentRef, value: item.choices[0]!.label })).toMatchObject({ status: 'rejected', reason: 'invalid-choice' })
  })

  it('requires every response in the Study segment before completion', async () => {
    const held = runtime()
    let view = held.open(2, 'segment:practice')
    await held.submit({ lessonRef: context.lessonRef, sectionRef: view.item!.sectionRef, itemRef: view.item!.itemRef, segmentRef: view.segmentRef, value: view.item!.choices[0]!.choiceRef })
    view = held.open(2, 'segment:practice')
    expect(view.item?.responseType).toBe('NUMERIC')
    expect(view.canCompleteSegment).toBe(false)
    await held.submit({ lessonRef: context.lessonRef, sectionRef: view.item!.sectionRef, itemRef: view.item!.itemRef, segmentRef: view.segmentRef, value: '34' })
    view = held.open(2, 'segment:practice')
    expect(view.item).toBeNull()
    expect(view.canCompleteSegment).toBe(true)
  })

  it('keeps the local response pending when the injected assessor is offline', async () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
    }
    const assessor: LearnerResponseAssessor = { assessorRef: 'trusted:future', assess: vi.fn().mockRejectedValue(new Error('offline')) }
    const held = runtime(new BrowserLearnerResponseStore(storage), assessor)
    const view = held.open(2, 'segment:practice')
    const saved = await held.submit({ lessonRef: context.lessonRef, sectionRef: view.item!.sectionRef, itemRef: view.item!.itemRef, segmentRef: view.segmentRef, value: view.item!.choices[0]!.choiceRef })
    expect(saved).toMatchObject({ status: 'saved', assessmentStatus: 'PENDING_ASSESSMENT', record: { status: 'PENDING_ASSESSMENT', assessment: null } })
    expect(values.get(FAMILY_PILOT_LEARNER_RESPONSES_KEY)).not.toMatch(/CORRECT|INCORRECT/)
    const reopened = runtime(new BrowserLearnerResponseStore(storage))
    expect(reopened.open(2, 'segment:practice').answeredItemRefs).toContain('ma-g3-mathematics-u01-l01#ip-01')
  })

  it('accepts assessed state only from the injected assessor identity', async () => {
    const assessor: LearnerResponseAssessor = {
      assessorRef: 'trusted:session-1',
      assess: async () => ({ assessmentRef: 'assessment:1', assessorRef: 'trusted:session-1', assessedAt: '2026-08-13T15:01:00.000Z', decision: 'CORRECT' }),
    }
    const held = runtime(new MemoryLearnerResponseStore(), assessor)
    const view = held.open(2, 'segment:practice')
    expect(await held.submit({ lessonRef: context.lessonRef, sectionRef: view.item!.sectionRef, itemRef: view.item!.itemRef, segmentRef: view.segmentRef, value: view.item!.choices[0]!.choiceRef })).toMatchObject({ status: 'saved', assessmentStatus: 'ASSESSED', record: { assessment: { assessorRef: 'trusted:session-1' } } })
  })

  it('never overwrites unreadable local progress and never advances when storage fails', async () => {
    const values = new Map<string, string>([[FAMILY_PILOT_LEARNER_RESPONSES_KEY, '{not-json']])
    const held = runtime(new BrowserLearnerResponseStore({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value) },
    }))
    const view = held.open(2, 'segment:practice')
    const result = await held.submit({ lessonRef: context.lessonRef, sectionRef: view.item!.sectionRef, itemRef: view.item!.itemRef, segmentRef: view.segmentRef, value: view.item!.choices[0]!.choiceRef })
    expect(result).toMatchObject({ status: 'rejected', reason: 'storage-unavailable' })
    expect(values.get(FAMILY_PILOT_LEARNER_RESPONSES_KEY)).toBe('{not-json')
  })
})
