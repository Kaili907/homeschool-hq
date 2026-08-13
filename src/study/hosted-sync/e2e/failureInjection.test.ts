import { describe, expect, it } from 'vitest'
import { HostedStudyE2EHarness } from './harness'
import type { HostedFailureInjection } from './contracts'
import {
  E2E_LESSONS,
  E2E_STUDENT_A,
  createReferenceHostedHarness,
} from './referenceAdapters'

const retryable: readonly HostedFailureInjection[] = ['offline', 'timeout', '429', '500', '503', 'lost-ack']

describe('deterministic hosted failure injection', () => {
  it.each(retryable)('preserves the pending local write across %s', async (failure) => {
    const injection = createReferenceHostedHarness()
    const harness = new HostedStudyE2EHarness(injection)
    const device = harness.createDevice(`device-${failure}`)
    await device.signIn('parent-alpha')
    await device.hydrate()
    const doc = device.documentFor(E2E_STUDENT_A, E2E_LESSONS.math)
    device.mutate(doc.documentRef, { type: 'advance', segmentRef: doc.assignment.segmentRefs[0] as string })
    injection.network.injectNext(failure)
    expect((await device.sync()).status).toBe('queued')
    expect(device.state.pending).toHaveLength(1)
    expect(device.document(doc.documentRef).assignment.completedSegmentRefs).toHaveLength(1)
  })

  it.each(['401', '403'] as const)('classifies injected %s without inventing a safety hold', async (failure) => {
    const injection = createReferenceHostedHarness()
    const harness = new HostedStudyE2EHarness(injection)
    const device = harness.createDevice(`device-${failure}`)
    await device.signIn('parent-alpha')
    await device.hydrate()
    const doc = device.documentFor(E2E_STUDENT_A, E2E_LESSONS.math)
    device.mutate(doc.documentRef, { type: 'advance', segmentRef: doc.assignment.segmentRefs[0] as string })
    injection.network.injectNext(failure)
    expect((await device.sync()).status).toBe(failure === '401' ? 'auth-required' : 'forbidden')
    expect(device.document(doc.documentRef).safetyHolds).toEqual([])
  })

  it('forces a stale revision and drives the injected reconciliation policy', async () => {
    const injection = createReferenceHostedHarness()
    const harness = new HostedStudyE2EHarness(injection)
    const device = harness.createDevice('device-stale')
    await device.signIn('parent-alpha'); await device.hydrate()
    const doc = device.documentFor(E2E_STUDENT_A, E2E_LESSONS.math)
    device.mutate(doc.documentRef, { type: 'advance', segmentRef: doc.assignment.segmentRefs[0] as string })
    injection.network.injectNext('stale-revision')
    expect((await device.sync()).status).toBe('synced')
    expect(harness.trace.some((entry) => (entry.response as { status?: string }).status === 'stale')).toBe(true)
  })

  it.each(['duplicate-request', 'duplicate-response'] as const)('keeps %s idempotent', async (failure) => {
    const injection = createReferenceHostedHarness()
    const harness = new HostedStudyE2EHarness(injection)
    const device = harness.createDevice(`device-${failure}`)
    await device.signIn('parent-alpha'); await device.hydrate()
    const doc = device.documentFor(E2E_STUDENT_A, E2E_LESSONS.math)
    device.mutate(doc.documentRef, { type: 'advance', segmentRef: doc.assignment.segmentRefs[0] as string })
    injection.network.injectNext(failure)
    expect((await device.sync()).status).toBe('synced')
    expect(injection.hostedRepository.snapshot().documents.find((item) => item.documentRef === doc.documentRef)?.serverRevision).toBe(1)
  })

  it.each(['reordered-response', 'malformed-response', 'corrupt-remote-state'] as const)(
    'rejects %s instead of accepting untrusted state',
    async (failure) => {
      const injection = createReferenceHostedHarness()
      const harness = new HostedStudyE2EHarness(injection)
      const device = harness.createDevice(`device-${failure}`)
      await device.signIn('parent-alpha'); await device.hydrate()
      const doc = device.documentFor(E2E_STUDENT_A, E2E_LESSONS.math)
      device.mutate(doc.documentRef, { type: 'advance', segmentRef: doc.assignment.segmentRefs[0] as string })
      injection.network.injectNext(failure)
      expect((await device.sync()).status).toBe('invalid-response')
      expect(device.state.pending).toHaveLength(1)
    },
  )

  it('restores a physically offline controller deterministically', async () => {
    const injection = createReferenceHostedHarness()
    const harness = new HostedStudyE2EHarness(injection)
    const device = harness.createDevice('device-restored')
    await device.signIn('parent-alpha'); await device.hydrate()
    const doc = device.documentFor(E2E_STUDENT_A, E2E_LESSONS.math)
    device.mutate(doc.documentRef, { type: 'advance', segmentRef: doc.assignment.segmentRefs[0] as string })
    injection.network.setOnline(false)
    expect((await device.sync()).status).toBe('queued')
    injection.network.setOnline(true)
    expect((await device.sync()).status).toBe('synced')
  })
})
