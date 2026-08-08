import { describe, expect, it, vi } from 'vitest'
import { PRODUCTION_DEPENDENCY_SPECIFICATIONS } from '../../../../src/study/contracts/production/readiness'
import {
  VERIFIED_ACADEMIC_RUNTIME_OPERATIONS,
  createVerifiedAcademicRuntimeGateway,
} from '../study-runtime/verified-academic-runtime.js'
import {
  ACADEMIC_METHOD_RUNTIME_OPERATIONS,
  ACADEMIC_SESSION_13_DEPENDENCIES,
  ACADEMIC_SESSION_13_REQUIRED_METHODS,
  createAcademicRuntimeReadinessProbe,
} from './academic-readiness.js'

const CONFIGURED_ENV = Object.freeze({
  SUPABASE_URL: 'https://study.example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'x'.repeat(48),
})

/** The two dependencies whose every required method has a server operation. */
const SERVER_PROVABLE = Object.freeze(['study-session-adapter', 'checkpoint-adapter'])

function forbiddenFetch() {
  return vi.fn(async () => { throw new Error('readiness probe must not contact hosted systems') })
}

describe('Session 13 academic dependency inventory', () => {
  it('mirrors the production readiness specification exactly', () => {
    // Forcing check: the server mirror cannot drift from src/study/contracts.
    for (const dependency of ACADEMIC_SESSION_13_DEPENDENCIES) {
      expect(ACADEMIC_SESSION_13_REQUIRED_METHODS[dependency]).toEqual(
        PRODUCTION_DEPENDENCY_SPECIFICATIONS[dependency].requiredMethods,
      )
    }
    expect(ACADEMIC_SESSION_13_DEPENDENCIES).toEqual([
      'study-session-adapter',
      'checkpoint-adapter',
      'review-queue',
      'calendar-adapter',
      'parent-settings-adapter',
      'adult-private-adapter',
      'event-ledger',
    ])
  })

  it('resolves every required method to a real server operation or to none', () => {
    const methods = ACADEMIC_SESSION_13_DEPENDENCIES.flatMap(
      (dependency) => ACADEMIC_SESSION_13_REQUIRED_METHODS[dependency],
    )
    expect(Object.keys(ACADEMIC_METHOD_RUNTIME_OPERATIONS).sort()).toEqual([...methods].sort())
    for (const method of methods) {
      const operation = ACADEMIC_METHOD_RUNTIME_OPERATIONS[method]
      if (operation === null) continue
      // A claimed operation must exist in the real composed runtime surface.
      expect(Object.hasOwn(VERIFIED_ACADEMIC_RUNTIME_OPERATIONS, operation)).toBe(true)
    }
    // Four adapters plus the calendar write contract have no server operation:
    // they are reached only by the authenticated browser client.
    expect(Object.entries(ACADEMIC_METHOD_RUNTIME_OPERATIONS)
      .filter(([, operation]) => operation === null)
      .map(([method]) => method)).toEqual([
      'upsertReview', 'upsertCalendarBlock', 'upsertParentSettings', 'effectiveSettings',
      'storeProtectedWork', 'readProtectedWork', 'appendAdultNote',
      'listAdultNoteMetadata', 'readAdultNote', 'appendAcceptedEvent',
    ])
  })
})

describe('academic runtime readiness probe', () => {
  it('reports only what the composed server runtime can prove, without any call', async () => {
    const fetchImpl = forbiddenFetch()
    const probe = createAcademicRuntimeReadinessProbe({ env: CONFIGURED_ENV, fetchImpl })
    const states = await probe()

    expect(states).toEqual({
      'study-session-adapter': 'ready',
      'checkpoint-adapter': 'ready',
      'review-queue': 'not-ready',
      'calendar-adapter': 'not-ready',
      'parent-settings-adapter': 'not-ready',
      'adult-private-adapter': 'not-ready',
      'event-ledger': 'not-ready',
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('uses the real gateway composition, so a withdrawn operation withdraws readiness', async () => {
    const real = createVerifiedAcademicRuntimeGateway({ rpc: { isConfigured: () => true } })
    expect(real.operations).toContain('session:transition')

    const withdrawn = await createAcademicRuntimeReadinessProbe({
      gateway: {
        isReady: () => true,
        operations: real.operations.filter((operation) => operation !== 'session:transition'),
      },
    })()
    expect(withdrawn['study-session-adapter']).toBe('not-ready')
    expect(withdrawn['checkpoint-adapter']).toBe('ready')
  })

  it('fails closed on an unconfigured, malformed, or throwing runtime', async () => {
    const allNotReady = Object.fromEntries(
      ACADEMIC_SESSION_13_DEPENDENCIES.map((dependency) => [dependency, 'not-ready']),
    )

    // No Supabase service configuration at all.
    await expect(createAcademicRuntimeReadinessProbe({
      env: {}, fetchImpl: forbiddenFetch(),
    })()).resolves.toEqual(allNotReady)

    // Configured transport but the composition reports itself not ready.
    await expect(createAcademicRuntimeReadinessProbe({
      gateway: { isReady: () => false, operations: Object.keys(VERIFIED_ACADEMIC_RUNTIME_OPERATIONS) },
    })()).resolves.toEqual(allNotReady)

    for (const operations of [undefined, null, 'session:begin', { 'session:begin': true }]) {
      await expect(createAcademicRuntimeReadinessProbe({
        gateway: { isReady: () => true, operations },
      })()).resolves.toEqual(allNotReady)
    }

    // Non-string members can never satisfy a required method.
    await expect(createAcademicRuntimeReadinessProbe({
      gateway: { isReady: () => true, operations: [null, 1, {}] },
    })()).resolves.toEqual(allNotReady)

    // A hostile accessor must not leak readiness through.
    await expect(createAcademicRuntimeReadinessProbe({
      gateway: {
        isReady: () => { throw new Error('probe hostile') },
        get operations() { throw new Error('probe hostile') },
      },
    })()).resolves.toEqual(allNotReady)

    await expect(createAcademicRuntimeReadinessProbe({ gateway: {} })())
      .resolves.toEqual(allNotReady)
  })

  it('never reports ready for a dependency with no server operation', async () => {
    const states = await createAcademicRuntimeReadinessProbe({
      // Every operation the server could ever expose is supported.
      gateway: {
        isReady: () => true,
        operations: Object.keys(VERIFIED_ACADEMIC_RUNTIME_OPERATIONS),
      },
    })()
    for (const dependency of ACADEMIC_SESSION_13_DEPENDENCIES) {
      expect(states[dependency]).toBe(SERVER_PROVABLE.includes(dependency) ? 'ready' : 'not-ready')
    }
  })

  it('exposes only dependency keys and closed-vocabulary states', async () => {
    const states = await createAcademicRuntimeReadinessProbe({
      env: CONFIGURED_ENV, fetchImpl: forbiddenFetch(),
    })()
    expect(Object.keys(states)).toEqual([...ACADEMIC_SESSION_13_DEPENDENCIES])
    for (const value of Object.values(states)) {
      expect(['ready', 'not-ready', 'degraded']).toContain(value)
    }
    expect(JSON.stringify(states)).not.toMatch(
      /student|learner|household|grant|credential|service|secret|token/i,
    )
  })
})
