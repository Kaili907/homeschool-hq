import { describe, expect, it } from 'vitest'
import { createFakeIndexedDb } from '../../durable-indexeddb/testing/fakeIndexedDb'
import { BrowserAssessmentRuntime } from './browserRuntime'

describe('BrowserAssessmentRuntime', () => {
  it('persists and verifies response evidence before assessment status advances', async () => {
    const fake = createFakeIndexedDb()
    let tick = 0
    const runtime = new BrowserAssessmentRuntime({ factory: fake.factory }, () => `2026-08-13T12:00:0${tick++}.000Z`)
    const identity = { studentRef: 'student:one', assignmentRef: 'assessment:a1', assessmentRef: 'ma-g5-math-u01-assessment' }

    const initial = await runtime.load(identity)
    expect(initial.responses).toEqual({})
    const saved = await runtime.saveResponse({ ...identity, taskRef: 'task-1', value: '42' })
    expect(saved.responses['task-1']?.value).toBe('42')
    const submitted = await runtime.setStatus(saved, 'PENDING_ASSESSMENT')
    expect(submitted.status).toBe('PENDING_ASSESSMENT')

    const reopened = await runtime.load(identity)
    expect(reopened.status).toBe('PENDING_ASSESSMENT')
    expect(reopened.responses['task-1']?.value).toBe('42')
  })

  it('isolates attempts by student and assignment', async () => {
    const fake = createFakeIndexedDb()
    const runtime = new BrowserAssessmentRuntime({ factory: fake.factory })
    await runtime.saveResponse({ studentRef: 'student:one', assignmentRef: 'assessment:a1', assessmentRef: 'a1', taskRef: 'task-1', value: 'one' })
    const sibling = await runtime.load({ studentRef: 'student:two', assignmentRef: 'assessment:a1', assessmentRef: 'a1' })
    expect(sibling.responses).toEqual({})
  })
})
