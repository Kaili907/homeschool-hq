import { describe, expect, it } from 'vitest'
import { createFakeIndexedDb } from '../../durable-indexeddb/testing/fakeIndexedDb'
import { assessmentAttemptDocumentKey, BrowserAssessmentRuntime } from './browserRuntime'

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

  it('survives hard runtime reconstruction with no localStorage dependency', async () => {
    const fake = createFakeIndexedDb()
    const identity = { studentRef: 'student:one', assignmentRef: 'assessment:a1', assessmentRef: 'a1' }
    await new BrowserAssessmentRuntime({ factory: fake.factory })
      .saveResponse({ ...identity, taskRef: 'task-1', value: 'durable answer' })

    const reopened = await new BrowserAssessmentRuntime({ factory: fake.factory }).load(identity)
    expect(reopened.responses['task-1']?.value).toBe('durable answer')
    const bytes = JSON.stringify(fake.records().get(assessmentAttemptDocumentKey(identity.studentRef, identity.assignmentRef)))
    expect(bytes).not.toMatch(/pin|bearer|authorization|answerKey|correctAnswer/i)
  })

  it('refuses a failed write and preserves the prior durable checkpoint', async () => {
    const fake = createFakeIndexedDb()
    const runtime = new BrowserAssessmentRuntime({ factory: fake.factory })
    const identity = { studentRef: 'student:one', assignmentRef: 'assessment:a1', assessmentRef: 'a1' }
    await runtime.saveResponse({ ...identity, taskRef: 'task-1', value: 'kept' })
    fake.failNextWritesOf(assessmentAttemptDocumentKey(identity.studentRef, identity.assignmentRef), 1)

    await expect(runtime.saveResponse({ ...identity, taskRef: 'task-2', value: 'refused' })).rejects.toThrow()
    const reopened = await new BrowserAssessmentRuntime({ factory: fake.factory }).load(identity)
    expect(reopened.responses['task-1']?.value).toBe('kept')
    expect(reopened.responses['task-2']).toBeUndefined()
  })

  it('fails closed on corrupt authority and does not overwrite it', async () => {
    const fake = createFakeIndexedDb()
    const identity = { studentRef: 'student:one', assignmentRef: 'assessment:a1', assessmentRef: 'a1' }
    const key = assessmentAttemptDocumentKey(identity.studentRef, identity.assignmentRef)
    const runtime = new BrowserAssessmentRuntime({ factory: fake.factory })
    await runtime.saveResponse({ ...identity, taskRef: 'task-1', value: 'kept' })
    fake.tamper(key, { schemaVersion: 1, studentRef: 'student:two', responses: {} })
    const corrupt = JSON.stringify(fake.records().get(key))

    await expect(runtime.load(identity)).rejects.toThrow('cannot be safely read')
    await expect(runtime.saveResponse({ ...identity, taskRef: 'task-2', value: 'must not replace' })).rejects.toThrow('cannot be safely read')
    expect(JSON.stringify(fake.records().get(key))).toBe(corrupt)
  })
})
