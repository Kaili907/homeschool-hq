import { describe, expect, it, vi } from 'vitest'
import { createStudyIdentityClient } from '../client/studyIdentityClient'
import { StudyLifecycleAbortError, StudyLifecycleBoundary } from '../lifecycle'
import { createVerifiedStudyRuntimeAdapter } from './verifiedRuntimeAdapter'

const NOW = Date.parse('2026-08-01T16:00:00.000Z')
const STUDENT_A = '12222222-2222-4222-8222-222222222222'
const STUDENT_B = '23333333-3333-4333-8333-333333333333'
const REFERENCE_A = `aca_stu_v1_${'A'.repeat(43)}`
const REFERENCE_B = `aca_stu_v1_${'B'.repeat(43)}`
const READINESS = Object.freeze({
  schemaVersion: 1 as const,
  status: 'ready' as const,
  expiresAt: '2099-08-01T16:00:30.000Z',
})

function issued(sessionReference = REFERENCE_A) {
  return {
    schemaVersion: 1,
    status: 'issued',
    sessionReference,
    expiresAt: '2099-08-01T16:15:00.000Z',
  }
}

function verified() {
  return {
    schemaVersion: 1,
    status: 'verified',
    expiresAt: '2099-08-01T16:15:00.000Z',
  }
}

function launchInput(studentId = STUDENT_A, overrides = {}) {
  return {
    featureEnabled: true,
    authenticatedHostSession: true,
    hostSessionKey: 'browser-host-session-key',
    accessToken: 'guardian.access.token',
    selectedStudentRef: { kind: 'academy-student-id' as const, value: studentId },
    readiness: READINESS,
    ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

describe('opaque verified production runtime adapter', () => {
  it('issues and verifies one selected learner without putting authority IDs in lifecycle state', async () => {
    const fetchImpl = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.endsWith('/issue')) return new Response(JSON.stringify(issued()), { status: 201 })
      if (url.endsWith('/verify')) return new Response(JSON.stringify(verified()), { status: 200 })
      throw new Error('unexpected request')
    })
    const lifecycle = new StudyLifecycleBoundary()
    const adapter = createVerifiedStudyRuntimeAdapter({
      identityClient: createStudyIdentityClient(fetchImpl as typeof fetch),
      lifecycle,
      now: () => NOW,
      createLifecycleRef: () => 'host-lifecycle:local-epoch-one',
    })

    await expect(adapter.launch(launchInput())).resolves.toEqual({
      status: 'ready',
      expiresAt: READINESS.expiresAt,
    })
    expect(lifecycle.binding).toEqual({
      authenticatedSessionRef: 'host-lifecycle:local-epoch-one',
      householdRef: 'server-bound-authority',
      learnerRef: 'selected-learner-epoch:1',
      launchGrantRef: 'opaque-grant-epoch:1',
      featureEnabled: true,
      authorizationRevision: 1,
      expiresAt: READINESS.expiresAt,
      identityEpochs: undefined,
    })
    expect(JSON.stringify(lifecycle.binding)).not.toContain(STUDENT_A)
    expect(JSON.stringify(lifecycle.binding)).not.toContain(REFERENCE_A)
    expect(JSON.stringify(adapter.snapshot())).not.toMatch(/student|household|grant|sessionReference/i)
  })

  it('reverifies capability before every academic gateway operation', async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/issue')) return new Response(JSON.stringify(issued()), { status: 201 })
      if (url.endsWith('/verify')) return new Response(JSON.stringify(verified()), { status: 200 })
      if (url.endsWith('/academic-runtime')) {
        return new Response(JSON.stringify({
          schemaVersion: 1,
          status: 'ok',
          operation: 'calendar:read',
          body: { blocks: [] },
        }), { status: 200 })
      }
      if (init?.method === 'DELETE') return new Response('{}', { status: 200 })
      throw new Error('unexpected request')
    })
    const adapter = createVerifiedStudyRuntimeAdapter({
      identityClient: createStudyIdentityClient(fetchImpl as typeof fetch),
      lifecycle: new StudyLifecycleBoundary(),
      now: () => NOW,
      createLifecycleRef: () => 'host-lifecycle:local-epoch-one',
    })
    await adapter.launch(launchInput())
    await expect(adapter.execute({
      operation: 'calendar:read',
      request: { cursor: null },
      operationRef: 'calendar:read:one',
    })).resolves.toEqual({ blocks: [] })

    const verifyCalls = fetchImpl.mock.calls.filter(([url]) => String(url).endsWith('/verify'))
    expect(verifyCalls).toHaveLength(2)
    expect(JSON.parse(String(verifyCalls[1]![1]?.body))).toEqual({
      schemaVersion: 1,
      requiredCapability: 'student:assignments:read',
    })
    const academic = fetchImpl.mock.calls.find(([url]) => String(url).endsWith('/academic-runtime'))!
    expect(academic[1]?.headers).toMatchObject({ Authorization: `Bearer ${REFERENCE_A}` })
    expect(String(academic[1]?.body)).not.toMatch(/studentId|householdId|grantId/)
  })

  it('reads bound content through the same lifecycle and opaque learner bearer', async () => {
    const fetchImpl = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.endsWith('/issue')) return new Response(JSON.stringify(issued()), { status: 201 })
      if (url.endsWith('/verify')) return new Response(JSON.stringify(verified()), { status: 200 })
      if (url.endsWith('/bound-content')) {
        return new Response(JSON.stringify({
          schemaVersion: 1,
          status: 'unavailable',
          reasonCode: 'curriculum-release-unavailable',
        }), { status: 200 })
      }
      throw new Error('unexpected request')
    })
    const adapter = createVerifiedStudyRuntimeAdapter({
      identityClient: createStudyIdentityClient(fetchImpl as typeof fetch),
      lifecycle: new StudyLifecycleBoundary(),
      now: () => NOW,
    })
    await adapter.launch(launchInput())
    await expect(adapter.readBoundContent({
      request: {
        sessionId: 'session-a',
        lessonRef: 'grade-5:academy-week-1-day-1',
        skillRefs: ['ma-g5-mathematics-u01-l01'],
      },
      operationRef: 'bound-content:one',
    })).resolves.toMatchObject({ status: 'unavailable' })

    const verifyCalls = fetchImpl.mock.calls.filter(([url]) => String(url).endsWith('/verify'))
    expect(verifyCalls).toHaveLength(2)
    expect(JSON.parse(String(verifyCalls[1]![1]?.body))).toEqual({
      schemaVersion: 1,
      requiredCapability: 'student:progress:read',
    })
    const content = fetchImpl.mock.calls.find(([url]) => String(url).endsWith('/bound-content'))!
    expect(content[1]?.headers).toMatchObject({ Authorization: `Bearer ${REFERENCE_A}` })
    expect(String(content[1]?.body)).not.toMatch(/releaseId|packageId|manifest|studentId|householdId/i)
  })

  it.each([
    ['feature-disabled', launchInput(STUDENT_A, { featureEnabled: false })],
    ['authorization-loss', launchInput(STUDENT_A, { authenticatedHostSession: false })],
    ['authorization-loss', launchInput(STUDENT_A, {
      readiness: { ...READINESS, status: 'not-ready' as const },
    })],
  ] as const)('does not issue when the host gate fails: %s', async (reason, input) => {
    const fetchImpl = vi.fn()
    const lifecycle = new StudyLifecycleBoundary()
    const adapter = createVerifiedStudyRuntimeAdapter({
      identityClient: createStudyIdentityClient(fetchImpl),
      lifecycle,
      now: () => NOW,
    })
    await expect(adapter.launch(input)).rejects.toMatchObject({ reason })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(adapter.isReady()).toBe(false)
  })

  it('revokes and cancels the shared epoch on readiness loss', async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/issue')) return new Response(JSON.stringify(issued()), { status: 201 })
      if (url.endsWith('/verify')) return new Response(JSON.stringify(verified()), { status: 200 })
      if (init?.method === 'DELETE') return new Response('{}', { status: 200 })
      throw new Error('unexpected request')
    })
    const lifecycle = new StudyLifecycleBoundary()
    const adapter = createVerifiedStudyRuntimeAdapter({
      identityClient: createStudyIdentityClient(fetchImpl as typeof fetch),
      lifecycle,
      now: () => NOW,
    })
    await adapter.launch(launchInput())
    const stale = lifecycle.token()
    await adapter.applyReadiness({ ...READINESS, status: 'degraded' })
    expect(stale.isCurrent()).toBe(false)
    expect(stale.signal.reason).toBe('authorization-loss')
    expect(adapter.isReady()).toBe(false)
    expect(fetchImpl.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true)
  })

  it('quarantines learner A issuance when learner B is selected before A resolves', async () => {
    const pendingA = deferred<Response>()
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/issue')) {
        const value = JSON.parse(String(init?.body)).selectedStudentRef.value
        if (value === STUDENT_A) return pendingA.promise
        return new Response(JSON.stringify(issued(REFERENCE_B)), { status: 201 })
      }
      if (url.endsWith('/verify')) return new Response(JSON.stringify(verified()), { status: 200 })
      if (init?.method === 'DELETE') return new Response('{}', { status: 200 })
      throw new Error('unexpected request')
    })
    const lifecycle = new StudyLifecycleBoundary()
    const adapter = createVerifiedStudyRuntimeAdapter({
      identityClient: createStudyIdentityClient(fetchImpl as typeof fetch),
      lifecycle,
      now: () => NOW,
      createLifecycleRef: () => 'host-lifecycle:selection-race',
    })

    const launchA = adapter.launch(launchInput(STUDENT_A))
    const launchB = adapter.launch(launchInput(STUDENT_B))
    await expect(launchB).resolves.toMatchObject({ status: 'ready' })
    pendingA.resolve(new Response(JSON.stringify(issued(REFERENCE_A)), { status: 201 }))
    await expect(launchA).rejects.toBeInstanceOf(Error)
    expect(adapter.isReady()).toBe(true)
    expect(JSON.stringify(lifecycle.binding)).not.toContain(STUDENT_A)
  })

  it.each(['logout', 'learner-switch', 'feature-disabled', 'authorization-loss'] as const)(
    'quarantines a late gateway result after %s',
    async (reason) => {
      const academic = deferred<Response>()
      const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/issue')) return new Response(JSON.stringify(issued()), { status: 201 })
        if (url.endsWith('/verify')) return new Response(JSON.stringify(verified()), { status: 200 })
        if (url.endsWith('/academic-runtime')) return academic.promise
        if (init?.method === 'DELETE') return new Response('{}', { status: 200 })
        throw new Error('unexpected request')
      })
      const adapter = createVerifiedStudyRuntimeAdapter({
        identityClient: createStudyIdentityClient(fetchImpl as typeof fetch),
        lifecycle: new StudyLifecycleBoundary(),
        now: () => NOW,
      })
      await adapter.launch(launchInput())
      const applied: unknown[] = []
      const executing = adapter.execute({
        operation: 'dashboard:read',
        request: {},
        operationRef: `dashboard:${reason}`,
      }).then((value) => applied.push(value))
      await vi.waitFor(() => {
        expect(fetchImpl.mock.calls.some(([url]) => String(url).endsWith('/academic-runtime'))).toBe(true)
      })
      await adapter.cancel(reason)
      academic.resolve(new Response(JSON.stringify({
        schemaVersion: 1,
        status: 'ok',
        operation: 'dashboard:read',
        body: { assignments: [] },
      }), { status: 200 }))
      await expect(executing).rejects.toBeInstanceOf(StudyLifecycleAbortError)
      expect(applied).toEqual([])
    },
  )
})
