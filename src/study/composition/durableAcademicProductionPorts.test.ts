import { describe, expect, it, vi } from 'vitest'
import { createProductionPortRegistry } from '../contracts/production/ports'
import type { StudyProductionReadinessState } from '../contracts/production/readiness'
import {
  SESSION_13_DURABLE_ACADEMIC_DEPENDENCIES,
  createSession13DurableAcademicProductionPorts,
  type Session13DurableAcademicAdapters,
  type Session13DurableAcademicDependency,
} from './durableAcademicProductionPorts'

function functionPort(methods: readonly string[]): Record<string, (...args: never[]) => Promise<unknown>> {
  return Object.fromEntries(methods.map((method) => [method, vi.fn(async () => undefined)]))
}

function adapters(): Session13DurableAcademicAdapters {
  return {
    studySession: functionPort(['resolveCurriculumBinding', 'createSession', 'transitionSession']),
    checkpoint: functionPort(['readCheckpoint', 'compareAndSwapCheckpoint']),
    reviewQueue: functionPort(['upsertReview']),
    calendar: functionPort(['upsertCalendarBlock']),
    parentSettings: functionPort(['upsertParentSettings', 'effectiveSettings']),
    adultPrivate: functionPort([
      'storeProtectedWork', 'readProtectedWork', 'appendAdultNote',
      'listAdultNoteMetadata', 'readAdultNote',
    ]),
    eventLedger: functionPort(['appendAcceptedEvent']),
    outbox: functionPort(['createAdultReviewProposal', 'enqueue', 'transition', 'status']),
  } as unknown as Session13DurableAcademicAdapters
}

function implementationIds(): Record<Session13DurableAcademicDependency, string> {
  return Object.fromEntries(SESSION_13_DURABLE_ACADEMIC_DEPENDENCIES.map((key) => [
    key, `academy-supabase:${key}:v1`,
  ])) as Record<Session13DurableAcademicDependency, string>
}

function health(
  probe: () => StudyProductionReadinessState = () => 'ready',
): Record<Session13DurableAcademicDependency, () => StudyProductionReadinessState> {
  return Object.fromEntries(SESSION_13_DURABLE_ACADEMIC_DEPENDENCIES.map((key) => [
    key, probe,
  ])) as unknown as Record<Session13DurableAcademicDependency, () => StudyProductionReadinessState>
}

describe('Session 13 durable academic production composition', () => {
  it('wires all eight durable adapters into the nine canonical registry contracts', () => {
    const supplied = adapters()
    const handles = createSession13DurableAcademicProductionPorts({
      adapters: supplied,
      implementationIds: implementationIds(),
      health: health(),
    })

    expect(handles.map(({ key }) => key)).toEqual(SESSION_13_DURABLE_ACADEMIC_DEPENDENCIES)
    expect(handles.every(Object.isFrozen)).toBe(true)
    expect(handles.find(({ key }) => key === 'adult-review-proposal-store')?.port).toBe(supplied.outbox)
    expect(handles.find(({ key }) => key === 'outbox-store')?.port).toBe(supplied.outbox)
    expect(() => createProductionPortRegistry(handles)).toThrow(/missing/i)
  })

  it('uses live health probes and does not manufacture readiness', () => {
    let state: StudyProductionReadinessState = 'ready'
    const probe = vi.fn(() => state)
    const probes = health(probe)
    const handles = createSession13DurableAcademicProductionPorts({
      adapters: adapters(),
      implementationIds: implementationIds(),
      health: probes,
    })
    probe.mockClear()

    expect(handles.map((handle) => handle.internalRegistration().status)).toEqual(
      SESSION_13_DURABLE_ACADEMIC_DEPENDENCIES.map(() => 'ready'),
    )
    state = 'not-ready'
    expect(handles.map((handle) => handle.internalRegistration().status)).toEqual(
      SESSION_13_DURABLE_ACADEMIC_DEPENDENCIES.map(() => 'not-ready'),
    )
  })

  it('rejects an absent durable adapter instead of selecting a fallback', () => {
    const supplied = { ...adapters(), checkpoint: undefined } as unknown as Session13DurableAcademicAdapters
    expect(() => createSession13DurableAcademicProductionPorts({
      adapters: supplied,
      implementationIds: implementationIds(),
      health: health(),
    })).toThrow(/does not satisfy/i)
  })
})
