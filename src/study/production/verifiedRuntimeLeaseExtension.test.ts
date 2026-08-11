import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStudyIdentityClient } from '../client/studyIdentityClient'
import type { StudyProductionReadinessWire } from '../client/studyProductionReadinessClient'
import {
  currentHostStudyLifecycleSeam,
  hostStudyLifecycleBoundary,
} from '../composition/hostStudyLifecycle'
import { StudyLifecycleAbortError } from '../lifecycle'
import { createVerifiedStudyRuntimeAdapter } from './verifiedRuntimeAdapter'

const STUDENT_A = '12222222-2222-4222-8222-222222222222'
const STUDENT_B = '23333333-3333-4333-8333-333333333333'
const GRANT_EXPIRES = '2099-08-01T16:15:00.000Z'

/**
 * Two consecutive readiness leases for ONE production session — what the App's
 * refresh timer produces when nothing about the learner or the host has changed.
 */
const READINESS_ONE = readiness('2099-08-01T16:00:30.000Z')
const READINESS_TWO = readiness('2099-08-01T16:01:00.000Z')

function readiness(expiresAt: string, status: 'ready' | 'degraded' = 'ready'): StudyProductionReadinessWire {
  return Object.freeze({ schemaVersion: 1 as const, status, expiresAt })
}

function reply(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

function createHarness(grantExpiresAt = GRANT_EXPIRES) {
  const owner = {}
  const control = {
    verifyStatus: 200,
    issues: 0,
    academic: deferred<unknown>(),
  }
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    const target = String(url)
    if (target.endsWith('/session/issue')) {
      control.issues += 1
      return reply(201, {
        schemaVersion: 1,
        status: 'issued',
        sessionReference: `aca_stu_v1_${String.fromCharCode(64 + control.issues).repeat(43)}`,
        expiresAt: grantExpiresAt,
      })
    }
    if (target.endsWith('/session/verify')) {
      return control.verifyStatus === 200
        ? reply(200, { schemaVersion: 1, status: 'verified', expiresAt: grantExpiresAt })
        : reply(control.verifyStatus, { status: 'rejected' })
    }
    if (target.endsWith('/academic-runtime')) return control.academic.promise
    if (init?.method === 'DELETE') return reply(200, {})
    throw new Error(`unexpected request: ${target}`)
  })
  // The App's own boundary, reached the way the App reaches it, so the seam the
  // mounted surfaces hold is the seam under test.
  const lifecycle = hostStudyLifecycleBoundary(owner)
  const adapter = createVerifiedStudyRuntimeAdapter({
    identityClient: createStudyIdentityClient(fetchImpl as unknown as typeof fetch),
    lifecycle,
    now: () => Date.now(),
    createLifecycleRef: () => 'host-lifecycle:lease-extension',
  })
  return { owner, control, fetchImpl, lifecycle, adapter }
}

function launchInput(
  wire: StudyProductionReadinessWire,
  studentId: string = STUDENT_A,
  overrides: Record<string, unknown> = {},
) {
  return {
    featureEnabled: true,
    authenticatedHostSession: true,
    hostSessionKey: 'host-user-one',
    accessToken: 'guardian.access.token',
    selectedStudentRef: { kind: 'academy-student-id' as const, value: studentId },
    readiness: wire,
    ...overrides,
  }
}

function issueCount(fetchImpl: { mock: { calls: unknown[][] } }): number {
  return fetchImpl.mock.calls.filter(([url]) => String(url).endsWith('/session/issue')).length
}

afterEach(() => vi.useRealTimers())

describe('verified production runtime lease extension', () => {
  it('renews the host epoch when readiness refreshes for the same session and learner', async () => {
    const { adapter, lifecycle, owner, fetchImpl } = createHarness()
    await adapter.launch(launchInput(READINESS_ONE))
    const token = lifecycle.token()
    const binding = lifecycle.binding
    const seam = currentHostStudyLifecycleSeam(owner)

    const refreshed = await adapter.launch(launchInput(READINESS_TWO))

    expect(lifecycle.token().epoch).toBe(token.epoch)
    expect(lifecycle.binding).toBe(binding)
    expect(token.isCurrent()).toBe(true)
    expect(token.signal.aborted).toBe(false)
    // The prop identity the route and the container hold. A new object here is
    // an unmount, a `navigation-away` cancel and a session prepared from the top.
    expect(currentHostStudyLifecycleSeam(owner)).toBe(seam)
    expect(refreshed).toEqual({ status: 'ready', expiresAt: READINESS_TWO.expiresAt })
    expect(issueCount(fetchImpl)).toBe(1)
  })

  it('does not re-epoch a byte-identical relaunch', async () => {
    const { adapter, lifecycle, owner } = createHarness()
    await adapter.launch(launchInput(READINESS_ONE))
    const token = lifecycle.token()
    const binding = lifecycle.binding
    const seam = currentHostStudyLifecycleSeam(owner)

    await adapter.launch(launchInput(READINESS_ONE))

    expect(lifecycle.token().epoch).toBe(token.epoch)
    expect(lifecycle.binding).toBe(binding)
    expect(token.isCurrent()).toBe(true)
    expect(currentHostStudyLifecycleSeam(owner)).toBe(seam)
  })

  it('reports the renewed lease in the runtime snapshot', async () => {
    const { adapter } = createHarness()
    await adapter.launch(launchInput(READINESS_ONE))
    expect(adapter.snapshot()).toEqual({ status: 'ready', expiresAt: READINESS_ONE.expiresAt })

    await adapter.launch(launchInput(READINESS_TWO))

    expect(adapter.snapshot()).toEqual({ status: 'ready', expiresAt: READINESS_TWO.expiresAt })
  })

  it('keeps an in-flight turn current across a readiness refresh', async () => {
    const { adapter, lifecycle, owner, control, fetchImpl } = createHarness()
    await adapter.launch(launchInput(READINESS_ONE))
    const token = lifecycle.token()
    const seam = currentHostStudyLifecycleSeam(owner)

    const turn = adapter.execute({
      operation: 'session:transition',
      request: { segmentRef: 'segment:one' },
      operationRef: 'turn:in-flight',
    })
    await vi.waitFor(() => {
      expect(fetchImpl.mock.calls.some(([url]) => String(url).endsWith('/academic-runtime'))).toBe(true)
    })

    await adapter.launch(launchInput(READINESS_TWO))

    expect(token.isCurrent()).toBe(true)
    expect(token.signal.aborted).toBe(false)
    expect(currentHostStudyLifecycleSeam(owner)).toBe(seam)
    expect(lifecycle.lastReason).toBeNull()

    control.academic.resolve(reply(200, {
      schemaVersion: 1,
      status: 'ok',
      operation: 'session:transition',
      body: { accepted: true },
    }))
    await expect(turn).resolves.toEqual({ accepted: true })
  })

  it('still quarantines a replayed operation reference after a renewal', async () => {
    const { adapter, control } = createHarness()
    await adapter.launch(launchInput(READINESS_ONE))
    control.academic.resolve(reply(200, {
      schemaVersion: 1,
      status: 'ok',
      operation: 'dashboard:read',
      body: { assignments: [] },
    }))
    await adapter.execute({ operation: 'dashboard:read', request: {}, operationRef: 'turn:one' })

    await adapter.launch(launchInput(READINESS_TWO))

    await expect(adapter.execute({
      operation: 'dashboard:read',
      request: {},
      operationRef: 'turn:one',
    })).rejects.toMatchObject({ name: 'AbortError', reason: 'duplicate-response' })
  })

  it('cancels the renewed epoch at the new deadline and not at the replaced one', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T16:00:00.000Z'))
    const { adapter, lifecycle } = createHarness('2026-08-01T16:15:00.000Z')
    await adapter.launch(launchInput(readiness('2026-08-01T16:00:30.000Z')))
    const token = lifecycle.token()

    vi.setSystemTime(new Date('2026-08-01T16:00:29.500Z'))
    await adapter.launch(launchInput(readiness('2026-08-01T16:01:00.000Z')))

    vi.advanceTimersByTime(1_000)
    expect(token.isCurrent()).toBe(true)
    expect(adapter.isReady()).toBe(true)

    vi.advanceTimersByTime(30_000)
    expect(token.isCurrent()).toBe(false)
    expect(token.signal.reason).toBe('grant-expired')
    expect(adapter.isReady()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not let the runtime read ready while the lifecycle timer holds the old deadline', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T16:00:00.000Z'))
    const { adapter, lifecycle } = createHarness('2026-08-01T16:15:00.000Z')
    await adapter.launch(launchInput(readiness('2026-08-01T16:00:30.000Z')))

    vi.setSystemTime(new Date('2026-08-01T16:00:29.500Z'))
    await adapter.launch(launchInput(readiness('2026-08-01T16:01:00.000Z')))
    vi.advanceTimersByTime(1_000)

    expect(adapter.snapshot()).toEqual({ status: 'ready', expiresAt: '2026-08-01T16:01:00.000Z' })
    expect(lifecycle.token().isCurrent()).toBe(true)
  })

  it.each([
    ['a different learner', () => launchInput(READINESS_TWO, STUDENT_B)],
    ['a different host session', () => launchInput(READINESS_TWO, STUDENT_A, { hostSessionKey: 'host-user-two' })],
  ])('rotates the epoch for %s', async (_label, next) => {
    const { adapter, lifecycle, owner } = createHarness()
    await adapter.launch(launchInput(READINESS_ONE))
    const token = lifecycle.token()
    const binding = lifecycle.binding
    const seam = currentHostStudyLifecycleSeam(owner)

    await adapter.launch(next())

    expect(lifecycle.token().epoch).toBeGreaterThan(token.epoch)
    expect(lifecycle.binding).not.toBe(binding)
    expect(token.isCurrent()).toBe(false)
    expect(currentHostStudyLifecycleSeam(owner)).not.toBe(seam)
  })

  it('rotates the epoch when a new verified session had to be issued', async () => {
    const { adapter, lifecycle, control, fetchImpl } = createHarness()
    await adapter.launch(launchInput(READINESS_ONE))
    const token = lifecycle.token()
    const binding = lifecycle.binding

    // The server rejects the installed reference: the client drops it, so the
    // refresh has to install a NEW verified session.
    control.verifyStatus = 401
    await expect(adapter.execute({
      operation: 'dashboard:read',
      request: {},
      operationRef: 'turn:rejected',
    })).rejects.toBeInstanceOf(Error)
    control.verifyStatus = 200

    await adapter.launch(launchInput(READINESS_TWO))

    expect(issueCount(fetchImpl)).toBe(2)
    expect(lifecycle.token().epoch).toBeGreaterThan(token.epoch)
    expect(lifecycle.binding).not.toBe(binding)
    expect(lifecycle.binding?.launchGrantRef).not.toBe(binding?.launchGrantRef)
  })

  it('does not resurrect an epoch the runtime itself cancelled', async () => {
    const { adapter, lifecycle } = createHarness()
    await adapter.launch(launchInput(READINESS_ONE))
    const token = lifecycle.token()
    await adapter.cancel('navigation-away')
    expect(lifecycle.binding).toBeNull()

    await adapter.launch(launchInput(READINESS_TWO))

    expect(lifecycle.token().epoch).toBeGreaterThan(token.epoch)
    expect(token.isCurrent()).toBe(false)
    expect(token.signal.reason).toBe('navigation-away')
  })

  it.each(['logout', 'learner-switch', 'authorization-loss'] as const)(
    'grants no extension after the host cancelled the epoch with %s',
    async (reason) => {
      const { adapter, lifecycle } = createHarness()
      await adapter.launch(launchInput(READINESS_ONE))
      const token = lifecycle.token()
      // Exactly what App.tsx does on logout, learner switch and auth loss.
      lifecycle.cancel(reason)

      await adapter.launch(launchInput(READINESS_TWO))

      expect(token.isCurrent()).toBe(false)
      expect(token.signal.reason).toBe(reason)
      expect(lifecycle.token().epoch).toBeGreaterThan(token.epoch)
    },
  )

  it('grants no extension once readiness is lost', async () => {
    const { adapter, lifecycle } = createHarness()
    await adapter.launch(launchInput(READINESS_ONE))
    const token = lifecycle.token()

    await adapter.applyReadiness(readiness(READINESS_TWO.expiresAt, 'degraded'))

    expect(token.isCurrent()).toBe(false)
    expect(adapter.isReady()).toBe(false)
    await expect(adapter.launch(launchInput(readiness(READINESS_TWO.expiresAt, 'degraded'))))
      .rejects.toBeInstanceOf(StudyLifecycleAbortError)
    expect(lifecycle.binding).toBeNull()
  })

  it('grants no extension once the feature is switched off', async () => {
    const { adapter, lifecycle } = createHarness()
    await adapter.launch(launchInput(READINESS_ONE))
    const token = lifecycle.token()

    await expect(adapter.launch(launchInput(READINESS_TWO, STUDENT_A, { featureEnabled: false })))
      .rejects.toMatchObject({ reason: 'feature-disabled' })

    expect(token.isCurrent()).toBe(false)
    expect(lifecycle.binding).toBeNull()
    expect(adapter.isReady()).toBe(false)
  })

  it('never renews an epoch this runtime did not begin', async () => {
    const { adapter, lifecycle } = createHarness()
    await adapter.launch(launchInput(READINESS_ONE))
    const foreign = {
      authenticatedSessionRef: 'host-study-epoch:someone-else',
      householdRef: 'household:someone-else',
      learnerRef: 'learner:someone-else',
      launchGrantRef: 'host-study-launch:someone-else',
      featureEnabled: true,
      authorizationRevision: 1,
      expiresAt: READINESS_ONE.expiresAt,
    }
    lifecycle.beginEpoch(foreign)
    const foreignBinding = lifecycle.binding

    await adapter.launch(launchInput(READINESS_TWO))

    expect(lifecycle.binding).not.toBe(foreignBinding)
    expect(lifecycle.binding?.learnerRef).toBe('selected-learner-epoch:1')
    expect(lifecycle.binding?.expiresAt).toBe(READINESS_TWO.expiresAt)
  })
})
