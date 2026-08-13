import { describe, expect, it } from 'vitest'
import { HostedStudyE2EHarness } from './harness'
import { assertHostedDocumentInvariants, clone } from './model'
import {
  E2E_HOUSEHOLD,
  E2E_LESSONS,
  E2E_SOURCE,
  E2E_STUDENT_A,
  E2E_STUDENT_B,
  createReferenceHostedHarness,
} from './referenceAdapters'
import {
  HOSTED_SYNC_ACCEPTANCE_SCENARIOS,
  assertFreshDeviceIsIndependent,
  createParentDevicePair,
} from './scenarioLibrary'

describe('hosted Study cross-device acceptance harness', () => {
  it('catalogs every required acceptance scenario', () => {
    expect(HOSTED_SYNC_ACCEPTANCE_SCENARIOS).toHaveLength(28)
  })

  it('1. fresh Device A signs in and hydrates household', async () => {
    const injection = createReferenceHostedHarness()
    const harness = new HostedStudyE2EHarness(injection)
    const deviceA = harness.createDevice('device-a')
    assertFreshDeviceIsIndependent(deviceA)
    await deviceA.signIn('parent-alpha')
    expect(await deviceA.hydrate()).toEqual({ status: 'hydrated' })
    expect(deviceA.state.household?.householdRef).toBe(E2E_HOUSEHOLD)
    expect(deviceA.state.household?.students.map((student) => student.studentRef)).toEqual([E2E_STUDENT_A, E2E_STUDENT_B])
  })

  it('2. Device A starts a real-shaped Study state and syncs', async () => {
    const injection = createReferenceHostedHarness()
    const { deviceA } = await createParentDevicePair(injection)
    const document = deviceA.documentFor(E2E_STUDENT_A, E2E_LESSONS.math)
    expect(deviceA.mutate(document.documentRef, { type: 'start' }).status).toBe('queued')
    expect(await deviceA.sync()).toMatchObject({ status: 'synced' })
    expect(deviceA.document(document.documentRef).assignment).toMatchObject({
      studentRef: E2E_STUDENT_A,
      lessonRef: E2E_LESSONS.math,
      state: 'active',
      rawAnswerIncluded: false,
      transcriptIncluded: false,
    })
  })

  it('3. fresh Device B signs into the same household with an independent session and store', async () => {
    const injection = createReferenceHostedHarness()
    const harness = new HostedStudyE2EHarness(injection)
    const a = harness.createDevice('device-a')
    await a.signIn('parent-alpha')
    await a.hydrate()
    const b = harness.createDevice('device-b')
    assertFreshDeviceIsIndependent(b)
    await b.signIn('parent-alpha')
    expect(injection.identityProvider.signIns.map((item) => item.deviceRef)).toEqual(['device-a', 'device-b'])
  })

  it('4. Device B hydrates exact student, assignment, lesson, and progress', async () => {
    const injection = createReferenceHostedHarness()
    const { deviceA: a, deviceB: b } = await createParentDevicePair(injection)
    const doc = a.documentFor(E2E_STUDENT_A, E2E_LESSONS.math)
    a.mutate(doc.documentRef, { type: 'start' })
    a.mutate(doc.documentRef, { type: 'advance', segmentRef: doc.assignment.segmentRefs[0] as string })
    await a.sync()
    await b.hydrate()
    expect(b.document(doc.documentRef)).toEqual(injection.hostedRepository.snapshot().documents.find((item) => item.documentRef === doc.documentRef))
  })

  it('5. Device B resumes exactly where Device A stopped', async () => {
    const injection = createReferenceHostedHarness()
    const { deviceA: a, deviceB: b } = await createParentDevicePair(injection)
    const doc = a.documentFor(E2E_STUDENT_A, E2E_LESSONS.math)
    const first = doc.assignment.segmentRefs[0] as string
    a.mutate(doc.documentRef, { type: 'advance', segmentRef: first })
    await a.sync()
    await b.hydrate()
    expect(b.document(doc.documentRef).assignment.currentSegmentRef).toBe(doc.assignment.segmentRefs[1])
    expect(b.document(doc.documentRef).assignment.completedSegmentRefs).toEqual([first])
  })

  it('6. Device A goes offline and advances without losing its local checkpoint', async () => {
    const injection = createReferenceHostedHarness()
    const { deviceA: a } = await createParentDevicePair(injection)
    const doc = a.documentFor(E2E_STUDENT_A, E2E_LESSONS.math)
    injection.network.setOnline(false)
    a.mutate(doc.documentRef, { type: 'advance', segmentRef: doc.assignment.segmentRefs[0] as string })
    expect(await a.sync()).toEqual({ status: 'queued', reasonCode: 'offline' })
    expect(a.state.pending).toHaveLength(1)
    expect(a.document(doc.documentRef).assignment.completedSegmentRefs).toHaveLength(1)
  })

  it('7. Device A reconnects and uploads', async () => {
    const injection = createReferenceHostedHarness()
    const { deviceA: a } = await createParentDevicePair(injection)
    const doc = a.documentFor(E2E_STUDENT_A, E2E_LESSONS.math)
    injection.network.setOnline(false)
    a.mutate(doc.documentRef, { type: 'advance', segmentRef: doc.assignment.segmentRefs[0] as string })
    await a.sync()
    injection.network.setOnline(true)
    expect(await a.sync()).toMatchObject({ status: 'synced' })
    expect(injection.hostedRepository.snapshot().documents.find((item) => item.documentRef === doc.documentRef)?.assignment.completedSegmentRefs).toHaveLength(1)
  })

  it('8. Device B refreshes and receives Device A update', async () => {
    const injection = createReferenceHostedHarness()
    const { deviceA: a, deviceB: b } = await createParentDevicePair(injection)
    const doc = a.documentFor(E2E_STUDENT_A, E2E_LESSONS.math)
    a.mutate(doc.documentRef, { type: 'advance', segmentRef: doc.assignment.segmentRefs[0] as string })
    await a.sync()
    await b.hydrate()
    expect(b.document(doc.documentRef).serverRevision).toBe(1)
  })

  it('9. both devices can modify the same Study document from the same base', async () => {
    const injection = createReferenceHostedHarness()
    const { deviceA: a, deviceB: b } = await createParentDevicePair(injection)
    const doc = a.documentFor(E2E_STUDENT_A, E2E_LESSONS.math)
    a.mutate(doc.documentRef, { type: 'advance', segmentRef: doc.assignment.segmentRefs[0] as string })
    b.mutate(doc.documentRef, { type: 'advance', segmentRef: doc.assignment.segmentRefs[1] as string })
    expect(a.state.pending[0]?.request.baseRevision).toBe(0)
    expect(b.state.pending[0]?.request.baseRevision).toBe(0)
  })

  it('10. stale write is rejected and reconciled by revision without last-write-wins', async () => {
    const injection = createReferenceHostedHarness()
    const { harness, deviceA: a, deviceB: b } = await createParentDevicePair(injection)
    const doc = a.documentFor(E2E_STUDENT_A, E2E_LESSONS.math)
    a.mutate(doc.documentRef, { type: 'advance', segmentRef: doc.assignment.segmentRefs[0] as string })
    b.mutate(doc.documentRef, { type: 'advance', segmentRef: doc.assignment.segmentRefs[1] as string })
    await a.sync()
    await b.sync()
    const remote = injection.hostedRepository.snapshot().documents.find((item) => item.documentRef === doc.documentRef)
    expect(remote?.assignment.completedSegmentRefs).toEqual([doc.assignment.segmentRefs[0], doc.assignment.segmentRefs[1]])
    expect(harness.trace.some((entry) => (entry.response as { status?: string }).status === 'stale')).toBe(true)
  })

  it('11. normal completion propagates', async () => {
    const injection = createReferenceHostedHarness()
    const { deviceA: a, deviceB: b } = await createParentDevicePair(injection)
    const doc = a.documentFor(E2E_STUDENT_A, E2E_LESSONS.math)
    a.mutate(doc.documentRef, { type: 'finish' })
    await a.sync()
    await b.hydrate()
    expect(b.document(doc.documentRef).completion.status).toBe('certified')
  })

  it('12. completed lesson never regresses when a stale device uploads', async () => {
    const injection = createReferenceHostedHarness()
    const { deviceA: a, deviceB: b } = await createParentDevicePair(injection)
    const doc = a.documentFor(E2E_STUDENT_A, E2E_LESSONS.math)
    a.mutate(doc.documentRef, { type: 'finish' })
    b.mutate(doc.documentRef, { type: 'advance', segmentRef: doc.assignment.segmentRefs[0] as string })
    await a.sync()
    await b.sync()
    const after = injection.hostedRepository.snapshot().documents.find((item) => item.documentRef === doc.documentRef) as typeof doc
    expect(after.completion.status).toBe('certified')
    expect(() => assertHostedDocumentInvariants(a.document(doc.documentRef), after)).not.toThrow()
  })

  it('13. Ready-for-Life learner finish remains pending guardian attestation', async () => {
    const injection = createReferenceHostedHarness()
    const { deviceA: a } = await createParentDevicePair(injection)
    const doc = a.documentFor(E2E_STUDENT_A, E2E_LESSONS.rfl)
    a.mutate(doc.documentRef, { type: 'finish' })
    await a.sync()
    expect(a.document(doc.documentRef).assignment.state).toBe('pending-attestation')
    expect(a.document(doc.documentRef).assignment.completedAt).toBeNull()
  })

  it('14. parent attestation propagates across devices', async () => {
    const injection = createReferenceHostedHarness()
    const { deviceA: a, deviceB: b } = await createParentDevicePair(injection)
    const doc = a.documentFor(E2E_STUDENT_A, E2E_LESSONS.rfl)
    a.mutate(doc.documentRef, { type: 'finish' })
    await a.sync()
    a.mutate(doc.documentRef, { type: 'attest', evidenceMode: 'adult-observed' })
    await a.sync()
    await b.hydrate()
    expect(b.document(doc.documentRef).completion).toMatchObject({ status: 'certified', attestedByRef: 'synthetic:parent:alpha' })
  })

  it('15. student device cannot self-attest', async () => {
    const injection = createReferenceHostedHarness()
    const harness = new HostedStudyE2EHarness(injection)
    const parent = harness.createDevice('parent')
    await parent.signIn('parent-alpha')
    await parent.hydrate()
    const doc = parent.documentFor(E2E_STUDENT_A, E2E_LESSONS.rfl)
    parent.mutate(doc.documentRef, { type: 'finish' })
    await parent.sync()
    const student = harness.createDevice('student')
    await student.signIn('student-a', '2468')
    await student.hydrate()
    expect(student.mutate(doc.documentRef, { type: 'attest', evidenceMode: 'adult-observed' })).toEqual({ status: 'forbidden', reasonCode: 'parent-role-required' })
    expect(await student.probeServerAuthorization(doc.documentRef, { type: 'attest', evidenceMode: 'adult-observed' })).toEqual({ status: 'forbidden', reasonCode: 'parent-role-required' })
    expect(student.state.pending).toHaveLength(0)
  })

  it('16. social dynamic-source attachment propagates', async () => {
    const injection = createReferenceHostedHarness()
    const { deviceA: a, deviceB: b } = await createParentDevicePair(injection)
    const doc = a.documentFor(E2E_STUDENT_A, E2E_LESSONS.social)
    a.mutate(doc.documentRef, { type: 'attach-source', source: E2E_SOURCE })
    await a.sync()
    await b.hydrate()
    expect(b.document(doc.documentRef).sourceAttachment).toMatchObject({ sourceRef: E2E_SOURCE.sourceRef, status: 'ATTACHED_SATISFIED' })
  })

  it('17. pending-source device cannot start early', async () => {
    const injection = createReferenceHostedHarness()
    const { deviceA: a } = await createParentDevicePair(injection)
    const doc = a.documentFor(E2E_STUDENT_A, E2E_LESSONS.social)
    expect(a.mutate(doc.documentRef, { type: 'start' })).toEqual({ status: 'forbidden', reasonCode: 'qualifying-source-required' })
    expect(a.state.pending).toHaveLength(0)
  })

  it('18. safety hold is created and received across devices', async () => {
    const injection = createReferenceHostedHarness()
    const { deviceA: a, deviceB: b } = await createParentDevicePair(injection)
    const doc = a.documentFor(E2E_STUDENT_A, E2E_LESSONS.safety)
    a.mutate(doc.documentRef, { type: 'place-safety-hold', holdRef: 'synthetic:hold:1', reasonCode: 'learner-requested-help' })
    await a.sync()
    await b.hydrate()
    expect(b.document(doc.documentRef).safetyHolds).toMatchObject([{ holdRef: 'synthetic:hold:1', status: 'open' }])
  })

  it('19. offline stale device cannot bypass a hold after reconnect', async () => {
    const injection = createReferenceHostedHarness()
    const harness = new HostedStudyE2EHarness(injection)
    const stale = harness.createDevice('stale-student')
    const current = harness.createDevice('current-parent')
    await stale.signIn('student-a', '2468'); await current.signIn('parent-alpha')
    await stale.hydrate(); await current.hydrate()
    const doc = stale.documentFor(E2E_STUDENT_A, E2E_LESSONS.safety)
    injection.network.setOnline(false)
    stale.mutate(doc.documentRef, { type: 'advance', segmentRef: doc.assignment.segmentRefs[0] as string })
    await stale.sync()
    injection.network.setOnline(true)
    current.mutate(doc.documentRef, { type: 'place-safety-hold', holdRef: 'synthetic:hold:stale', reasonCode: 'adult-stop' })
    await current.sync()
    expect(await stale.sync()).toMatchObject({ status: 'synced' })
    expect(stale.document(doc.documentRef).safetyHolds[0]?.status).toBe('open')
    expect(stale.document(doc.documentRef).assignment.completedSegmentRefs).toEqual([])
    expect(stale.mutate(doc.documentRef, { type: 'start' }).status).toBe('safety-blocked')
    expect(stale.mutate(doc.documentRef, { type: 'clear-safety-hold', holdRef: 'synthetic:hold:stale' }).status).toBe('forbidden')
    expect(await stale.probeServerAuthorization(doc.documentRef, { type: 'clear-safety-hold', holdRef: 'synthetic:hold:stale' })).toEqual({ status: 'forbidden', reasonCode: 'parent-role-required' })
  })

  it('20. parent safety clear propagates', async () => {
    const injection = createReferenceHostedHarness()
    const { deviceA: a, deviceB: b } = await createParentDevicePair(injection)
    const doc = a.documentFor(E2E_STUDENT_A, E2E_LESSONS.safety)
    a.mutate(doc.documentRef, { type: 'place-safety-hold', holdRef: 'synthetic:hold:clear', reasonCode: 'adult-stop' })
    await a.sync()
    a.mutate(doc.documentRef, { type: 'clear-safety-hold', holdRef: 'synthetic:hold:clear' })
    await a.sync()
    await b.hydrate()
    expect(b.document(doc.documentRef).safetyHolds[0]?.status).toBe('cleared')
  })

  it('21. two siblings remain isolated', async () => {
    const injection = createReferenceHostedHarness()
    const harness = new HostedStudyE2EHarness(injection)
    const a = harness.createDevice('student-a')
    await a.signIn('student-a', '2468')
    await a.hydrate()
    expect(a.state.household?.students.map((student) => student.studentRef)).toEqual([E2E_STUDENT_A])
    expect(await a.readStudent(E2E_STUDENT_B)).toEqual({ status: 'forbidden', reasonCode: 'student-scope-forbidden' })
  })

  it('22. wrong household is forbidden', async () => {
    const injection = createReferenceHostedHarness()
    const harness = new HostedStudyE2EHarness(injection)
    const other = harness.createDevice('other')
    await other.signIn('parent-other')
    expect(await other.readStudent(E2E_STUDENT_A, E2E_HOUSEHOLD)).toEqual({ status: 'forbidden', reasonCode: 'wrong-household' })
  })

  it('23. auth expiration is handled as auth and not as safety', async () => {
    const injection = createReferenceHostedHarness()
    const { deviceA: a } = await createParentDevicePair(injection)
    const doc = a.documentFor(E2E_STUDENT_A, E2E_LESSONS.math)
    a.mutate(doc.documentRef, { type: 'advance', segmentRef: doc.assignment.segmentRefs[0] as string })
    injection.network.injectNext('401')
    expect(await a.sync()).toEqual({ status: 'auth-required', reasonCode: 'session-expired' })
    expect(a.authorized).toBe(false)
    expect(a.document(doc.documentRef).safetyHolds).toEqual([])
  })

  it('24. duplicate network retry is idempotent', async () => {
    const injection = createReferenceHostedHarness()
    const { deviceA: a } = await createParentDevicePair(injection)
    const doc = a.documentFor(E2E_STUDENT_A, E2E_LESSONS.math)
    a.mutate(doc.documentRef, { type: 'advance', segmentRef: doc.assignment.segmentRefs[0] as string })
    injection.network.injectNext('lost-ack')
    expect((await a.sync()).status).toBe('queued')
    expect((await a.sync()).status).toBe('synced')
    const server = injection.hostedRepository.snapshot().documents.find((item) => item.documentRef === doc.documentRef)
    expect(server?.serverRevision).toBe(1)
    expect(server?.assignment.completedSegmentRefs).toHaveLength(1)
  })

  it('25. temporary server outage preserves local progress', async () => {
    const injection = createReferenceHostedHarness()
    const { deviceA: a } = await createParentDevicePair(injection)
    const doc = a.documentFor(E2E_STUDENT_A, E2E_LESSONS.math)
    a.mutate(doc.documentRef, { type: 'advance', segmentRef: doc.assignment.segmentRefs[0] as string })
    injection.network.injectNext('503')
    expect(await a.sync()).toEqual({ status: 'queued', reasonCode: 'server-error' })
    expect(a.state.pending).toHaveLength(1)
    expect(a.document(doc.documentRef).assignment.completedSegmentRefs).toHaveLength(1)
  })

  it('26. device clock skew does not decide truth', async () => {
    const injection = createReferenceHostedHarness()
    const harness = new HostedStudyE2EHarness(injection)
    const future = harness.createDevice('future', { clockOffsetMilliseconds: 365 * 24 * 60 * 60 * 1_000 })
    const past = harness.createDevice('past', { clockOffsetMilliseconds: -365 * 24 * 60 * 60 * 1_000 })
    await future.signIn('parent-alpha'); await past.signIn('parent-alpha')
    await future.hydrate(); await past.hydrate()
    const doc = future.documentFor(E2E_STUDENT_A, E2E_LESSONS.math)
    future.mutate(doc.documentRef, { type: 'advance', segmentRef: doc.assignment.segmentRefs[0] as string })
    past.mutate(doc.documentRef, { type: 'advance', segmentRef: doc.assignment.segmentRefs[1] as string })
    await future.sync(); await past.sync()
    const server = injection.hostedRepository.snapshot().documents.find((item) => item.documentRef === doc.documentRef)
    expect(server?.assignment.completedSegmentRefs).toEqual([doc.assignment.segmentRefs[0], doc.assignment.segmentRefs[1]])
    expect(server?.serverAcceptedAt).toBe(injection.clock.now())
  })

  it('27. logout clears ephemeral authorization while retaining safe study state', async () => {
    const injection = createReferenceHostedHarness()
    const { deviceA: a } = await createParentDevicePair(injection)
    const before = clone(a.state.household)
    expect(await a.logout()).toEqual({ status: 'logged-out' })
    expect(a.authorized).toBe(false)
    expect(a.state.household).toEqual(before)
    await expect(a.hydrate()).rejects.toThrow('device-auth-required')
  })

  it('28. no raw Tutor or private-answer content reaches transport or server fixtures', async () => {
    const injection = createReferenceHostedHarness()
    const { harness, deviceA: a } = await createParentDevicePair(injection)
    const doc = a.documentFor(E2E_STUDENT_A, E2E_LESSONS.math)
    a.mutate(doc.documentRef, { type: 'advance', segmentRef: doc.assignment.segmentRefs[0] as string })
    await a.sync()
    expect(() => harness.assertSecurityCanaries()).not.toThrow()
    expect(JSON.stringify(injection.transport.sent.map((item) => item.request))).not.toMatch(/2468|e2e-bearer/i)
  })
})
