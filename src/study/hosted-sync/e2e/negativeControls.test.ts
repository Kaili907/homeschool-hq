import { describe, expect, it } from 'vitest'
import type { HostedStudyRepository, HostedSyncHarnessInjection } from './contracts'
import { HostedStudyE2EHarness } from './harness'
import { assertHostedDocumentInvariants, clone } from './model'
import {
  DeterministicClock,
  E2E_LESSONS,
  E2E_STUDENT_A,
  E2E_STUDENT_B,
  InMemoryHostedStudyRepository,
  MemoryIdentityProvider,
  MemoryLocalStudyStore,
  ScriptedHostedSyncTransport,
  ScriptedNetworkController,
  createReferenceHostedHarness,
  safeReconciliationPolicy,
} from './referenceAdapters'
import { assertFreshDeviceIsIndependent } from './scenarioLibrary'

describe('negative controls prove the harness catches unsafe convergence adapters', () => {
  it('detects last-write-wins completion regression', async () => {
    const injection = createReferenceHostedHarness()
    const harness = new HostedStudyE2EHarness(injection)
    const device = harness.createDevice('device')
    await device.signIn('parent-alpha'); await device.hydrate()
    const before = device.documentFor(E2E_STUDENT_A, E2E_LESSONS.math)
    device.mutate(before.documentRef, { type: 'finish' }); await device.sync()
    const certified = device.document(before.documentRef)
    const lww = clone({
      ...certified,
      serverRevision: certified.serverRevision + 1,
      assignment: { ...certified.assignment, state: 'active', completedSegmentRefs: [] },
      completion: { ...certified.completion, status: 'in-progress' },
    }) as typeof certified
    expect(() => assertHostedDocumentInvariants(certified, lww)).toThrow('completed-lesson-regressed')
  })

  it('detects timestamp-authority progress loss even when the losing timestamp is newer', async () => {
    const injection = createReferenceHostedHarness()
    const harness = new HostedStudyE2EHarness(injection)
    const device = harness.createDevice('device')
    await device.signIn('parent-alpha'); await device.hydrate()
    const before = device.documentFor(E2E_STUDENT_A, E2E_LESSONS.math)
    const withProgress = clone({ ...before, assignment: { ...before.assignment, completedSegmentRefs: [before.assignment.segmentRefs[0]] } }) as typeof before
    const timestampWinner = clone({ ...withProgress, serverRevision: 1, serverAcceptedAt: '2099-01-01T00:00:00.000Z', assignment: { ...withProgress.assignment, completedSegmentRefs: [] } }) as typeof before
    expect(() => assertHostedDocumentInvariants(withProgress, timestampWinner)).toThrow('completed-progress-regressed')
  })

  it('detects a shared local store between Device A and Device B', async () => {
    const reference = createReferenceHostedHarness()
    const shared = new MemoryLocalStudyStore()
    const bad: HostedSyncHarnessInjection = { ...reference, createLocalStudyStore: () => shared }
    const harness = new HostedStudyE2EHarness(bad)
    const a = harness.createDevice('a')
    await a.signIn('parent-alpha'); await a.hydrate()
    const b = harness.createDevice('b')
    expect(() => assertFreshDeviceIsIndependent(b)).toThrow('fresh-device-shares-local-state')
  })

  it('detects shared sibling state through student-scoped hydration and reads', async () => {
    const injection = createReferenceHostedHarness()
    const harness = new HostedStudyE2EHarness(injection)
    const student = harness.createDevice('student-a')
    await student.signIn('student-a', '2468'); await student.hydrate()
    expect(student.state.household?.documents.some((item) => item.studentRef === E2E_STUDENT_B)).toBe(false)
    expect((await student.readStudent(E2E_STUDENT_B)).status).toBe('forbidden')
  })

  it('detects loss of idempotency after a lost acknowledgement', async () => {
    const clock = new DeterministicClock()
    const network = new ScriptedNetworkController()
    const realRepository = new InMemoryHostedStudyRepository(clock)
    let ordinal = 0
    const badRepository: HostedStudyRepository = {
      hydrateHousehold: realRepository.hydrateHousehold,
      readStudent: realRepository.readStudent,
      applyMutation: (session, request) => {
        const current = realRepository.snapshot().documents.find((item) => item.documentRef === request.documentRef)
        return realRepository.applyMutation(session, {
          ...request,
          // Deliberately broken control: treats every retry as new and bypasses CAS.
          idempotencyKey: `${request.idempotencyKey}:broken:${++ordinal}`,
          baseRevision: current?.serverRevision ?? request.baseRevision,
        })
      },
    }
    const identityProvider = new MemoryIdentityProvider(clock)
    const transport = new ScriptedHostedSyncTransport(badRepository, network)
    const bad: HostedSyncHarnessInjection = {
      clock, network, identityProvider, transport, hostedRepository: badRepository,
      reconciliationPolicy: safeReconciliationPolicy,
      createLocalStudyStore: () => new MemoryLocalStudyStore(),
    }
    const harness = new HostedStudyE2EHarness(bad)
    const device = harness.createDevice('device')
    await device.signIn('parent-alpha'); await device.hydrate()
    const doc = device.documentFor(E2E_STUDENT_A, E2E_LESSONS.math)
    device.mutate(doc.documentRef, { type: 'advance', segmentRef: doc.assignment.segmentRefs[0] as string })
    network.injectNext('lost-ack'); await device.sync(); await device.sync()
    expect(realRepository.snapshot().documents.find((item) => item.documentRef === doc.documentRef)?.serverRevision).toBe(2)
  })

  it('detects student self-attestation and student safety clear attempts', async () => {
    const injection = createReferenceHostedHarness()
    const harness = new HostedStudyE2EHarness(injection)
    const student = harness.createDevice('student')
    await student.signIn('student-a', '2468'); await student.hydrate()
    const rfl = student.documentFor(E2E_STUDENT_A, E2E_LESSONS.rfl)
    const safety = student.documentFor(E2E_STUDENT_A, E2E_LESSONS.safety)
    expect(student.mutate(rfl.documentRef, { type: 'attest', evidenceMode: 'adult-observed' }).status).toBe('forbidden')
    expect(student.mutate(safety.documentRef, { type: 'clear-safety-hold', holdRef: 'synthetic:hold:any' }).status).toBe('forbidden')
    expect((await student.probeServerAuthorization(rfl.documentRef, { type: 'attest', evidenceMode: 'adult-observed' })).status).toBe('forbidden')
    expect((await student.probeServerAuthorization(safety.documentRef, { type: 'clear-safety-hold', holdRef: 'synthetic:hold:any' })).status).toBe('forbidden')
  })

  it('detects an auth failure being converted into a safety event', async () => {
    const injection = createReferenceHostedHarness()
    const harness = new HostedStudyE2EHarness(injection)
    const device = harness.createDevice('device')
    await device.signIn('parent-alpha'); await device.hydrate()
    const doc = device.documentFor(E2E_STUDENT_A, E2E_LESSONS.math)
    device.mutate(doc.documentRef, { type: 'advance', segmentRef: doc.assignment.segmentRefs[0] as string })
    injection.network.injectNext('401')
    expect((await device.sync()).status).toBe('auth-required')
    expect(device.document(doc.documentRef).safetyHolds).toEqual([])
  })
})
