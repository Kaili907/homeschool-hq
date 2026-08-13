import { describe, expect, it } from 'vitest'
import {
  ASSESSMENT_ASSIGNMENT,
  ASSIGNMENT_MATH,
  ASSIGNMENT_RFL,
  ASSIGNMENT_SAFETY,
  ASSIGNMENT_SOCIAL,
  FIXED_NOW,
  HOUSEHOLD_ALPHA,
  LESSON_MATH,
  LESSON_RFL,
  LESSON_SAFETY,
  LESSON_SOCIAL,
  SEGMENTS_MATH,
  SESSION_MATH,
  STUDENT_ADA,
  STUDENT_GRACE,
  assignmentFixture,
  validateLearnerDocument,
} from './model'
import {
  HostedSyncHarnessR2,
  IndependentDeviceStore,
  assessmentAssignment,
  assessmentAttempt,
  mathResponse,
} from './harness'
import { HOSTED_SYNC_R2_SCENARIOS } from './scenarioLibrary'

async function linkedPair() {
  const harness = new HostedSyncHarnessR2()
  const a = harness.createDevice('device-a')
  a.setupLocalHousehold()
  await a.signIn('parent-alpha')
  expect((await a.firstLink()).status).toBe('ok')
  const b = harness.createDevice('device-b')
  await b.signIn('parent-alpha')
  expect(b.state.learners.size).toBe(0)
  expect((await b.firstLink()).status).toBe('ok')
  return { harness, a, b }
}

async function syncOperation(device, studentRef, operation) {
  expect(device.mutate(studentRef, operation).status).toBe('queued')
  const result = await device.sync()
  expect(result.status).toBe('ok')
  return result
}

function assignment(assignmentRef, lessonRef, subject, title) {
  return assignmentFixture({ assignmentRef, lessonRef, subject, title })
}

function openHold(holdRef = 'hold:ada:1') {
  return {
    schemaVersion: 1,
    holdRef,
    studentRef: STUDENT_ADA,
    sessionRef: SESSION_MATH,
    createdAt: FIXED_NOW,
    status: 'open',
    reasonCode: 'study-safety-uncertain',
    source: 'study-safety',
    dedupeKey: `${STUDENT_ADA}|${SESSION_MATH}|study-safety-uncertain`,
  }
}

describe('hosted Family Pilot cross-device sync R2', () => {
  it('catalogs the previous 28 scenarios plus four R2 assessment/first-link scenarios', () => {
    expect(HOSTED_SYNC_R2_SCENARIOS).toHaveLength(32)
    expect(new Set(HOSTED_SYNC_R2_SCENARIOS).size).toBe(32)
  })

  it('1. fresh Device A signs in and hydrates the household through first-link', async () => {
    const harness = new HostedSyncHarnessR2()
    const a = harness.createDevice('device-a')
    a.setupLocalHousehold()
    await a.signIn('parent-alpha')
    const response = await a.firstLink()
    expect(response.status).toBe('ok')
    expect([...a.state.learners.keys()]).toEqual([STUDENT_ADA, STUDENT_GRACE])
  })

  it('2. Device A starts the real core assignment and durable Study session then syncs', async () => {
    const { a } = await linkedPair()
    await syncOperation(a, STUDENT_ADA, { type: 'start', assignmentRef: ASSIGNMENT_MATH, lessonRef: LESSON_MATH, sessionRef: SESSION_MATH })
    const document = a.document()
    expect(document.coreStudent.assignments[0]).toMatchObject({ state: 'active', sessionRef: SESSION_MATH, rawAnswerIncluded: false, transcriptIncluded: false })
    expect(document.durableStudy.sessions[0]).toMatchObject({ lessonRef: LESSON_MATH, status: 'active', rawAnswerIncluded: false, transcriptIncluded: false })
    expect(validateLearnerDocument(document)).toBe(true)
  })

  it('3. fresh Device B has an independent empty store and authorization session', async () => {
    const harness = new HostedSyncHarnessR2()
    const a = harness.createDevice('device-a')
    const b = harness.createDevice('device-b')
    expect(a.store.storageIdentity).not.toBe(b.store.storageIdentity)
    expect(b.state.learners.size).toBe(0)
    await a.signIn('parent-alpha'); await b.signIn('parent-alpha')
    expect(a.authorized).toBe(true); expect(b.authorized).toBe(true)
  })

  it('4. Device B hydrates exact student assignment lesson and progress', async () => {
    const { a, b } = await linkedPair()
    await syncOperation(a, STUDENT_ADA, { type: 'start', assignmentRef: ASSIGNMENT_MATH, lessonRef: LESSON_MATH, sessionRef: SESSION_MATH })
    await syncOperation(a, STUDENT_ADA, { type: 'complete-segment', assignmentRef: ASSIGNMENT_MATH, lessonRef: LESSON_MATH, sessionRef: SESSION_MATH, segmentRef: SEGMENTS_MATH[0], activeSeconds: 91 })
    await b.hydrate()
    expect(b.document()).toEqual(a.document())
  })

  it('5. Device B resumes at the exact durable checkpoint where Device A stopped', async () => {
    const { a, b } = await linkedPair()
    await syncOperation(a, STUDENT_ADA, { type: 'start', assignmentRef: ASSIGNMENT_MATH, lessonRef: LESSON_MATH, sessionRef: SESSION_MATH })
    await syncOperation(a, STUDENT_ADA, { type: 'complete-segment', assignmentRef: ASSIGNMENT_MATH, lessonRef: LESSON_MATH, sessionRef: SESSION_MATH, segmentRef: SEGMENTS_MATH[0], activeSeconds: 91 })
    await b.hydrate()
    expect(b.document().durableStudy.checkpoints[0]).toMatchObject({
      completedSegmentRefs: [SEGMENTS_MATH[0]], segmentRef: SEGMENTS_MATH[1], elapsedActiveSecondsInSegment: 91,
    })
  })

  it('6. Device A goes offline and retains local progress plus its queued mutation', async () => {
    const { a } = await linkedPair()
    await syncOperation(a, STUDENT_ADA, { type: 'start', assignmentRef: ASSIGNMENT_MATH, lessonRef: LESSON_MATH, sessionRef: SESSION_MATH })
    a.setOnline(false)
    a.mutate(STUDENT_ADA, { type: 'complete-segment', assignmentRef: ASSIGNMENT_MATH, lessonRef: LESSON_MATH, sessionRef: SESSION_MATH, segmentRef: SEGMENTS_MATH[0], activeSeconds: 30 })
    expect(await a.sync()).toMatchObject({ status: 'retryable', reasonCode: 'offline' })
    expect(a.document().coreStudent.assignments[0].progress.completedSegmentRefs).toEqual([SEGMENTS_MATH[0]])
    expect(a.state.pending).toHaveLength(1)
  })

  it('7. Device A reconnects and uploads its offline operation', async () => {
    const { harness, a } = await linkedPair()
    a.setOnline(false)
    a.mutate(STUDENT_ADA, { type: 'complete-segment', assignmentRef: ASSIGNMENT_MATH, lessonRef: LESSON_MATH, sessionRef: SESSION_MATH, segmentRef: SEGMENTS_MATH[0], activeSeconds: 30 })
    await a.sync(); a.setOnline(true)
    expect((await a.sync()).status).toBe('ok')
    expect(harness.server.snapshot().learners.find((item) => item.studentRef === STUDENT_ADA).coreStudent.assignments[0].progress.completedSegmentRefs).toEqual([SEGMENTS_MATH[0]])
  })

  it('8. Device B refreshes from A and reverse B to A progress also converges', async () => {
    const { a, b } = await linkedPair()
    await syncOperation(a, STUDENT_ADA, { type: 'complete-segment', assignmentRef: ASSIGNMENT_MATH, lessonRef: LESSON_MATH, sessionRef: SESSION_MATH, segmentRef: SEGMENTS_MATH[0], activeSeconds: 30 })
    await b.hydrate()
    expect(b.document().serverRevision).toBe(a.document().serverRevision)
    await syncOperation(b, STUDENT_ADA, { type: 'complete-segment', assignmentRef: ASSIGNMENT_MATH, lessonRef: LESSON_MATH, sessionRef: SESSION_MATH, segmentRef: SEGMENTS_MATH[1], activeSeconds: 45 })
    await a.hydrate()
    expect(a.document().coreStudent.assignments[0].progress.completedSegmentRefs).toEqual([SEGMENTS_MATH[0], SEGMENTS_MATH[1]])
  })

  it('9. both devices can queue progress from the same server revision', async () => {
    const { a, b } = await linkedPair()
    a.mutate(STUDENT_ADA, { type: 'complete-segment', assignmentRef: ASSIGNMENT_MATH, lessonRef: LESSON_MATH, sessionRef: SESSION_MATH, segmentRef: SEGMENTS_MATH[0], activeSeconds: 20 })
    b.mutate(STUDENT_ADA, { type: 'complete-segment', assignmentRef: ASSIGNMENT_MATH, lessonRef: LESSON_MATH, sessionRef: SESSION_MATH, segmentRef: SEGMENTS_MATH[1], activeSeconds: 35 })
    expect(a.state.pending[0].request.baseRevision).toBe(b.state.pending[0].request.baseRevision)
  })

  it('10. stale concurrent progress is rebased by revision and merged instead of LWW', async () => {
    const { harness, a, b } = await linkedPair()
    a.mutate(STUDENT_ADA, { type: 'complete-segment', assignmentRef: ASSIGNMENT_MATH, lessonRef: LESSON_MATH, sessionRef: SESSION_MATH, segmentRef: SEGMENTS_MATH[0], activeSeconds: 20 })
    b.mutate(STUDENT_ADA, { type: 'complete-segment', assignmentRef: ASSIGNMENT_MATH, lessonRef: LESSON_MATH, sessionRef: SESSION_MATH, segmentRef: SEGMENTS_MATH[1], activeSeconds: 35 })
    await a.sync(); await b.sync()
    const progress = harness.server.snapshot().learners.find((item) => item.studentRef === STUDENT_ADA).coreStudent.assignments[0].progress
    expect(progress.completedSegmentRefs).toEqual([SEGMENTS_MATH[0], SEGMENTS_MATH[1]])
    expect(progress.activeSeconds).toBe(35)
  })

  it('11. normal completion propagates from Device A to Device B', async () => {
    const { a, b } = await linkedPair()
    await syncOperation(a, STUDENT_ADA, { type: 'finish', assignmentRef: ASSIGNMENT_MATH, authority: 'STANDARD' })
    await b.hydrate()
    expect(b.document().coreStudent.assignments[0]).toMatchObject({ state: 'completed', completedAt: expect.any(String) })
  })

  it('12. a stale progress upload never regresses a completed lesson', async () => {
    const { harness, a, b } = await linkedPair()
    b.mutate(STUDENT_ADA, { type: 'complete-segment', assignmentRef: ASSIGNMENT_MATH, lessonRef: LESSON_MATH, sessionRef: SESSION_MATH, segmentRef: SEGMENTS_MATH[0], activeSeconds: 12 })
    await syncOperation(a, STUDENT_ADA, { type: 'finish', assignmentRef: ASSIGNMENT_MATH, authority: 'STANDARD' })
    await b.sync()
    expect(harness.server.snapshot().learners.find((item) => item.studentRef === STUDENT_ADA).coreStudent.assignments[0].state).toBe('completed')
  })

  it('13. Ready-for-Life learner finish remains pending guardian attestation', async () => {
    const { a } = await linkedPair()
    await syncOperation(a, STUDENT_ADA, { type: 'assign', assignment: assignment(ASSIGNMENT_RFL, LESSON_RFL, 'ready-for-life', 'Planning a Household Task') })
    await syncOperation(a, STUDENT_ADA, { type: 'start', assignmentRef: ASSIGNMENT_RFL, lessonRef: LESSON_RFL, sessionRef: 'session:ada:rfl' })
    await syncOperation(a, STUDENT_ADA, { type: 'finish', assignmentRef: ASSIGNMENT_RFL, authority: 'GUARDIAN_ATTESTATION_REQUIRED' })
    expect(a.document().app.attestations[0]).toMatchObject({ status: 'PENDING_GUARDIAN_ATTESTATION', attestedAt: null })
    expect(a.document().coreStudent.assignments.find((item) => item.assignmentRef === ASSIGNMENT_RFL).state).not.toBe('completed')
  })

  it('14. parent RFL certification propagates across devices', async () => {
    const { a, b } = await linkedPair()
    await syncOperation(a, STUDENT_ADA, { type: 'assign', assignment: assignment(ASSIGNMENT_RFL, LESSON_RFL, 'ready-for-life', 'Planning a Household Task') })
    await syncOperation(a, STUDENT_ADA, { type: 'start', assignmentRef: ASSIGNMENT_RFL, lessonRef: LESSON_RFL, sessionRef: 'session:ada:rfl' })
    await syncOperation(a, STUDENT_ADA, { type: 'finish', assignmentRef: ASSIGNMENT_RFL, authority: 'GUARDIAN_ATTESTATION_REQUIRED' })
    const pending = a.document().app.attestations[0]
    await syncOperation(a, STUDENT_ADA, { type: 'attest', attestation: { ...pending, status: 'CERTIFIED', attestedAt: FIXED_NOW, attestedByRef: 'parent:alpha', evidenceMode: 'adult-observed' } })
    await b.hydrate()
    expect(b.document().app.attestations[0]).toMatchObject({ status: 'CERTIFIED', attestedByRef: 'parent:alpha' })
  })

  it('15. a student device cannot self-attest', async () => {
    const { harness } = await linkedPair()
    const student = harness.createDevice('student-device')
    await student.signIn('student-ada'); await student.firstLink()
    expect(student.mutate(STUDENT_ADA, { type: 'attest', attestation: { studentRef: STUDENT_ADA, assignmentRef: ASSIGNMENT_RFL, lessonRef: LESSON_RFL, sessionRef: 'session:ada:rfl', authority: 'GUARDIAN_ATTESTATION_REQUIRED', status: 'CERTIFIED', learnerAssertedAt: FIXED_NOW, attestedAt: FIXED_NOW, attestedByRef: STUDENT_ADA, evidenceMode: 'adult-observed' } })).toMatchObject({ status: 'forbidden', reasonCode: 'parent-role-required' })
  })

  it('16. Social Studies source metadata propagates without source body content', async () => {
    const { a, b } = await linkedPair()
    await syncOperation(a, STUDENT_ADA, { type: 'assign', assignment: assignment(ASSIGNMENT_SOCIAL, LESSON_SOCIAL, 'social-studies', 'Primary Source Inquiry') })
    await syncOperation(a, STUDENT_ADA, { type: 'attach-source', attachment: { studentRef: STUDENT_ADA, assignmentRef: ASSIGNMENT_SOCIAL, lessonRef: LESSON_SOCIAL, sourceRef: 'source:loc:001', title: 'Letter from the Archive', publisher: 'Library of Congress', publishedAt: '1863-01-01T00:00:00.000Z', attachedAt: FIXED_NOW, status: 'ATTACHED_SATISFIED' } })
    await b.hydrate()
    expect(b.document().app.sourceAttachments[0]).toMatchObject({ sourceRef: 'source:loc:001', status: 'ATTACHED_SATISFIED' })
    expect(JSON.stringify(b.document().app.sourceAttachments)).not.toMatch(/sourceBody|fullText|websiteContent/)
  })

  it('17. a Social assignment remains unstartable until qualifying metadata is attached', async () => {
    const { a } = await linkedPair()
    await syncOperation(a, STUDENT_ADA, { type: 'assign', assignment: assignment(ASSIGNMENT_SOCIAL, LESSON_SOCIAL, 'social-studies', 'Primary Source Inquiry') })
    expect(a.mutate(STUDENT_ADA, { type: 'start', assignmentRef: ASSIGNMENT_SOCIAL, lessonRef: LESSON_SOCIAL, sessionRef: 'session:ada:social' })).toMatchObject({ status: 'forbidden', reasonCode: 'qualifying-source-required' })
    expect(a.state.pending).toHaveLength(0)
  })

  it('18. a safety hold propagates to the other device', async () => {
    const { a, b } = await linkedPair()
    await syncOperation(a, STUDENT_ADA, { type: 'place-safety-hold', hold: openHold() })
    await b.hydrate()
    expect(b.document().app.safetyHolds[0]).toMatchObject({ status: 'open', reasonCode: 'study-safety-uncertain' })
  })

  it('19. an offline stale device cannot bypass a newly synchronized safety hold', async () => {
    const { a, b } = await linkedPair()
    b.setOnline(false)
    b.mutate(STUDENT_ADA, { type: 'complete-segment', assignmentRef: ASSIGNMENT_MATH, lessonRef: LESSON_MATH, sessionRef: SESSION_MATH, segmentRef: SEGMENTS_MATH[0], activeSeconds: 15 })
    await b.sync(); b.setOnline(true)
    await syncOperation(a, STUDENT_ADA, { type: 'place-safety-hold', hold: openHold('hold:ada:offline') })
    const response = await b.sync()
    expect(response).toMatchObject({ status: 'safety-blocked', reasonCode: 'safety-hold' })
    await b.hydrate()
    expect(b.mutate(STUDENT_ADA, { type: 'start', assignmentRef: ASSIGNMENT_MATH, lessonRef: LESSON_MATH, sessionRef: SESSION_MATH })).toMatchObject({ status: 'safety-blocked' })
  })

  it('20. parent safety clear propagates and allows work to resume', async () => {
    const { a, b } = await linkedPair()
    await syncOperation(a, STUDENT_ADA, { type: 'place-safety-hold', hold: openHold('hold:ada:clear') })
    await syncOperation(a, STUDENT_ADA, { type: 'clear-safety-hold', holdRef: 'hold:ada:clear', clearedAt: FIXED_NOW, clearedBy: 'parent:alpha' })
    await b.hydrate()
    expect(b.document().app.safetyHolds[0]).toMatchObject({ status: 'cleared', clearedBy: 'parent:alpha' })
  })

  it('21. sibling records remain isolated under student authorization', async () => {
    const { harness } = await linkedPair()
    const student = harness.createDevice('student-ada-device')
    await student.signIn('student-ada'); await student.firstLink()
    expect([...student.state.learners.keys()]).toEqual([STUDENT_ADA])
    expect(student.mutate(STUDENT_GRACE, { type: 'finish', assignmentRef: ASSIGNMENT_MATH, authority: 'STANDARD' })).toMatchObject({ status: 'forbidden', reasonCode: 'student-scope-forbidden' })
  })

  it('22. a wrong-household request is forbidden without revealing household data', async () => {
    const { harness } = await linkedPair()
    const other = harness.createDevice('other-household')
    await other.signIn('parent-beta')
    const response = await other.hydrate(HOUSEHOLD_ALPHA)
    expect(response).toMatchObject({ status: 'forbidden', reasonCode: 'wrong-household' })
    expect(other.state.learners.size).toBe(0)
  })

  it('23. auth expiration clears ephemeral authority and is not converted into a safety hold', async () => {
    const { a } = await linkedPair()
    a.mutate(STUDENT_ADA, { type: 'complete-segment', assignmentRef: ASSIGNMENT_MATH, lessonRef: LESSON_MATH, sessionRef: SESSION_MATH, segmentRef: SEGMENTS_MATH[0], activeSeconds: 10 })
    a.injectNext('401')
    expect(await a.sync()).toMatchObject({ status: 'auth-error', reasonCode: 'session-expired' })
    expect(a.authorized).toBe(false)
    expect(a.document().app.safetyHolds).toEqual([])
  })

  it('24. an explicit duplicate retry is idempotent', async () => {
    const { harness, a } = await linkedPair()
    a.mutate(STUDENT_ADA, { type: 'complete-segment', assignmentRef: ASSIGNMENT_MATH, lessonRef: LESSON_MATH, sessionRef: SESSION_MATH, segmentRef: SEGMENTS_MATH[0], activeSeconds: 10 })
    a.injectNext('lost-ack')
    expect(await a.sync()).toMatchObject({ status: 'retryable', reasonCode: 'lost-ack' })
    expect((await a.sync()).status).toBe('ok')
    const server = harness.server.snapshot().learners.find((item) => item.studentRef === STUDENT_ADA)
    expect(server.coreStudent.assignments[0].progress.completedSegmentRefs).toEqual([SEGMENTS_MATH[0]])
    expect(server.serverRevision).toBe(2)
  })

  it('25. a temporary server outage preserves local progress and the pending operation', async () => {
    const { a } = await linkedPair()
    a.mutate(STUDENT_ADA, { type: 'complete-segment', assignmentRef: ASSIGNMENT_MATH, lessonRef: LESSON_MATH, sessionRef: SESSION_MATH, segmentRef: SEGMENTS_MATH[0], activeSeconds: 10 })
    a.injectNext('500')
    expect(await a.sync()).toMatchObject({ status: 'retryable', reasonCode: 'server-error' })
    expect(a.state.pending).toHaveLength(1)
    expect(a.document().coreStudent.assignments[0].progress.completedSegmentRefs).toEqual([SEGMENTS_MATH[0]])
  })

  it('26. device clock skew cannot choose truth over server revision ordering', async () => {
    const harness = new HostedSyncHarnessR2()
    const future = harness.createDevice('future-device', { clockOffsetMs: 365 * 24 * 60 * 60 * 1000 })
    future.setupLocalHousehold(); await future.signIn('parent-alpha'); await future.firstLink()
    const past = harness.createDevice('past-device', { clockOffsetMs: -365 * 24 * 60 * 60 * 1000 })
    await past.signIn('parent-alpha'); await past.firstLink()
    future.mutate(STUDENT_ADA, { type: 'complete-segment', assignmentRef: ASSIGNMENT_MATH, lessonRef: LESSON_MATH, sessionRef: SESSION_MATH, segmentRef: SEGMENTS_MATH[0], activeSeconds: 10 })
    past.mutate(STUDENT_ADA, { type: 'complete-segment', assignmentRef: ASSIGNMENT_MATH, lessonRef: LESSON_MATH, sessionRef: SESSION_MATH, segmentRef: SEGMENTS_MATH[1], activeSeconds: 11 })
    await future.sync(); await past.sync()
    const server = harness.server.snapshot().learners.find((item) => item.studentRef === STUDENT_ADA)
    expect(server.coreStudent.assignments[0].progress.completedSegmentRefs).toEqual([SEGMENTS_MATH[0], SEGMENTS_MATH[1]])
    expect(server.serverAcceptedAt).toMatch(/^2026-08-13/)
  })

  it('27. logout clears only ephemeral authorization and retains safe local state', async () => {
    const { a } = await linkedPair()
    const before = a.state.persistedCanary()
    await a.logout()
    expect(a.authorized).toBe(false)
    expect(a.state.persistedCanary()).toBe(before)
    await expect(a.hydrate()).rejects.toThrow('device-auth-required')
  })

  it('28. PIN Tutor transcript and restricted answer authority upload are detected while learner responses sync', async () => {
    const { harness, a } = await linkedPair()
    a.addTutorTurn('private Tutor transcript')
    await syncOperation(a, STUDENT_ADA, { type: 'save-response', response: mathResponse() })
    expect(a.state.persistedCanary()).toContain('pinDigests')
    expect(a.tutorTranscript).toEqual(['private Tutor transcript'])
    expect(() => harness.assertUploadCanaries()).not.toThrow()
    const requests = JSON.stringify(harness.server.received.map((entry) => entry.request))
    expect(requests).toContain('420')
    expect(requests).not.toMatch(/2468|pinDigest|private Tutor transcript|adultScoringAuthorityRef|answerKey|correctAnswer|rubric/i)
  })

  it('29. first link uploads the current setup assignment and Study aggregate exactly once', async () => {
    const harness = new HostedSyncHarnessR2()
    const a = harness.createDevice('device-a')
    a.setupLocalHousehold()
    await a.signIn('parent-alpha')
    const linked = await a.firstLink()
    expect(linked).toMatchObject({ status: 'ok', duplicate: false })
    const server = harness.server.snapshot()
    expect(server.learners.find((item) => item.studentRef === STUDENT_ADA).coreStudent.assignments[0]).toMatchObject({ assignmentRef: ASSIGNMENT_MATH, lessonRef: LESSON_MATH })
    expect(server.learners.every(validateLearnerDocument)).toBe(true)
  })

  it('30. repeated first link is idempotent and cannot duplicate learner records', async () => {
    const harness = new HostedSyncHarnessR2()
    const a = harness.createDevice('device-a')
    a.setupLocalHousehold(); await a.signIn('parent-alpha')
    await a.firstLink()
    expect(await a.firstLink()).toMatchObject({ status: 'ok', duplicate: true })
    expect(harness.server.snapshot().learners.map((item) => item.studentRef)).toEqual([STUDENT_ADA, STUDENT_GRACE])
  })

  it('31. pending then trusted-scored learner response records propagate A to B', async () => {
    const { a, b } = await linkedPair()
    await syncOperation(a, STUDENT_ADA, { type: 'save-response', response: mathResponse() })
    await b.hydrate()
    expect(b.document().learnerResponses[0]).toMatchObject({ status: 'PENDING_ASSESSMENT', assessment: null, response: { kind: 'NUMERIC', text: '420' } })
    await syncOperation(a, STUDENT_ADA, { type: 'score-response', itemRef: mathResponse().itemRef, receipt: { assessmentRef: 'assessment-record:lesson:1', assessorRef: 'trusted:production-assessor', assessedAt: FIXED_NOW, decision: 'CORRECT' } })
    await b.hydrate()
    expect(b.document().learnerResponses[0]).toMatchObject({ status: 'ASSESSED', assessment: { assessorRef: 'trusted:production-assessor', decision: 'CORRECT' } })
  })

  it('32. pending then certified assessment attempt records propagate and reverse B to A', async () => {
    const { a, b } = await linkedPair()
    await syncOperation(a, STUDENT_ADA, { type: 'assign-assessment', assignment: assessmentAssignment() })
    await syncOperation(a, STUDENT_ADA, { type: 'set-assessment-attempt', attempt: assessmentAttempt('PENDING_ASSESSMENT') })
    await b.hydrate()
    expect(b.document().assessmentAttempts[0]).toMatchObject({ assignmentRef: ASSESSMENT_ASSIGNMENT, status: 'PENDING_ASSESSMENT', responses: { 'task:1': { value: 42 } } })
    await syncOperation(b, STUDENT_ADA, { type: 'set-assessment-attempt', attempt: assessmentAttempt('CERTIFIED') })
    await a.hydrate()
    expect(a.document().assessmentAttempts[0].status).toBe('CERTIFIED')
    expect(a.document().app.assessmentAssignments[0]).toMatchObject({ status: 'CERTIFIED', completedAt: expect.any(String) })
  })
})

describe('R2 negative controls', () => {
  it('detects device factories that alias storage', () => {
    const harness = new HostedSyncHarnessR2()
    const shared = new IndependentDeviceStore()
    harness.createDevice('a', { store: shared })
    expect(() => harness.createDevice('b', { store: shared })).toThrow('shared-device-storage-detected')
  })

  it('rejects corrupt remote learner documents rather than hydrating an empty replacement', async () => {
    const { a } = await linkedPair()
    a.injectNext('corrupt-remote')
    await expect(a.hydrate()).rejects.toThrow('corrupt-remote-state')
    expect(a.state.learners.size).toBe(2)
  })

  it('rejects restricted answer authority injected into the push contract', async () => {
    const { harness, a } = await linkedPair()
    const response = mathResponse()
    const unsafe = { type: 'save-response', response: { ...response, adultScoringAuthorityRef: 'restricted:key:1' } }
    a.mutate(STUDENT_ADA, unsafe)
    expect(await a.sync()).toMatchObject({ status: 'invalid-response', reasonCode: 'malformed-response' })
  })
})
