import { describe, expect, it, vi } from 'vitest'
import type { Profile } from '../../types'
import {
  createLocalSessionId,
  parseProfileId,
  type LearnerSessionRecord,
  type ProfileId,
  type SecurityLifecycleEvent,
} from '../contracts'
import type { FailedAttemptStatus } from '../attempts'
import type { StoredLearnerCredentialRecord } from '../credentials'
import type {
  GlobalRevocationPort,
  LearnerSessionController,
} from '../session'
import {
  LearnerSecurityApplication,
  type LearnerCredentialApplicationPort,
} from './learnerSecurity'

const P1 = parseProfileId('p1')!
const P2 = parseProfileId('p2')!
const NOW = '2026-08-13T12:00:00.000Z'

function profile(profileId: ProfileId): Profile {
  return { id: profileId } as unknown as Profile
}

function credential(
  profileId: ProfileId,
  verifierBase64 = 'verifier-a',
): StoredLearnerCredentialRecord {
  return Object.freeze({
    schemaVersion: 1,
    storage: 'device-local-only',
    profileId,
    credentialKind: 'learner-pin',
    verifierScheme: 'pbkdf2-sha256',
    verifierSchemeVersion: 2,
    costParametersVersion: 1,
    saltBase64: 'salt-a',
    verifierBase64,
    costParameters: { iterations: 210_000, derivedKeyBytes: 32 },
    state: 'enrolled',
    createdAt: NOW,
  }) as StoredLearnerCredentialRecord
}

function session(profileId: ProfileId): LearnerSessionRecord {
  return Object.freeze({
    schemaVersion: 1,
    sessionId: createLocalSessionId(
      () => '00000000-0000-4000-8000-000000000001',
    ),
    profileId,
    authenticatedAt: NOW,
    lastMeaningfulActivityAt: NOW,
    absoluteExpiresAt: '2026-08-13T13:00:00.000Z',
    globalRevocationEpoch: 0,
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function harness(options: {
  readonly records?: Readonly<Record<string, StoredLearnerCredentialRecord>>
  readonly status?: () => FailedAttemptStatus | Promise<FailedAttemptStatus>
  readonly verify?: (profileId: ProfileId, pin: string) => boolean | Promise<boolean>
  readonly restored?: { status: 'active'; session: LearnerSessionRecord } | { status: 'ended'; reason: string }
  readonly create?: (profileId: ProfileId) => Promise<LearnerSessionRecord>
  readonly lifecycleFailure?: boolean
} = {}) {
  const trace: string[] = []
  const records = new Map<string, StoredLearnerCredentialRecord>(
    Object.entries(options.records ?? {}),
  )
  let live: LearnerSessionRecord | null = null

  const credentials: LearnerCredentialApplicationPort = {
    read(profileId) {
      trace.push(`credential:read:${profileId}`)
      return records.get(profileId) ?? null
    },
    async verify(profileId, pin) {
      trace.push(`credential:verify:${profileId}`)
      return (await options.verify?.(profileId, pin)) ?? pin === '1234'
    },
    async enroll(profileId) {
      trace.push(`credential:enroll:${profileId}`)
      const enrolled = credential(profileId)
      records.set(profileId, enrolled)
      return enrolled
    },
    delete(profileId) {
      trace.push(`credential:delete:${profileId}`)
      records.delete(profileId)
    },
  }

  const fakeSession = {
    get session() {
      return live
    },
    async restore() {
      trace.push('session:restore')
      const restored = options.restored ?? { status: 'ended', reason: 'none' }
      live = restored.status === 'active' ? restored.session : null
      return restored
    },
    async create(profileId: ProfileId) {
      trace.push(`session:create:${profileId}`)
      const created = options.create
        ? await options.create(profileId)
        : session(profileId)
      live = created
      return created
    },
    async clearLocal() {
      trace.push('session:clear')
      live = null
    },
    async deliverLifecycle(
      event: SecurityLifecycleEvent,
      beforeDelivery?: () => void | Promise<void>,
    ) {
      trace.push(`lifecycle:begin:${event.type}`)
      await beforeDelivery?.()
      trace.push(`study:${event.type}`)
      if (options.lifecycleFailure) throw new Error('Study cleanup failed')
      trace.push(`lifecycle:end:${event.type}`)
    },
    async close() {
      trace.push('session:close')
      live = null
    },
  } as unknown as LearnerSessionController

  const revocation = {
    currentEpoch: () => 0,
    subscribe: () => () => undefined,
    beginRevoke(cause: string) {
      trace.push(`revocation:${cause}`)
      const notice = Object.freeze({
        schemaVersion: 1 as const,
        epoch: 1,
        cause,
        occurredAt: NOW,
      })
      return { published: Promise.resolve(notice), settled: Promise.resolve(notice) }
    },
    async revoke(cause: string) {
      trace.push(`revocation:${cause}`)
      return Object.freeze({
        schemaVersion: 1 as const,
        epoch: 1,
        cause,
        occurredAt: NOW,
      })
    },
    close() {
      trace.push('revocation:close')
    },
  } as unknown as GlobalRevocationPort

  const app = new LearnerSecurityApplication({
    credentials,
    attempts: {
      async status() {
        trace.push('attempt:status')
        return (await options.status?.()) ?? {
          status: 'ready',
          failedAttempts: 0,
        }
      },
      async recordFailure() {
        trace.push('attempt:failure')
        return { status: 'ready', failedAttempts: 1 }
      },
      async recordSuccess() {
        trace.push('attempt:success')
      },
    },
    session: fakeSession,
    revocation,
  })

  return { app, records, trace }
}

describe('learner security application composition', () => {
  it('treats chooser selection as credential discovery, never authentication', () => {
    const runtime = harness({ records: { p2: credential(P2) } })

    expect(runtime.app.credentialStates({ p1: profile(P1), p2: profile(P2) }))
      .toEqual({ p1: 'unenrolled', p2: 'enrolled' })
    expect(runtime.app.access).toEqual({ status: 'locked', reason: 'initial' })
  })

  it('enrolls on first entry and publishes authority only after Session creation settles', async () => {
    const create = deferred<LearnerSessionRecord>()
    const runtime = harness({ create: () => create.promise })
    let settled = false

    const authentication = runtime.app.authenticate(P1, '1234', 'enroll')
      .finally(() => { settled = true })
    await vi.waitFor(() => expect(runtime.trace).toContain('session:create:p1'))

    expect(settled).toBe(false)
    expect(runtime.app.access).toEqual({ status: 'locked', reason: 'initial' })
    expect(runtime.trace).toEqual([
      'attempt:status',
      'credential:read:p1',
      'credential:enroll:p1',
      'attempt:success',
      'credential:read:p1',
      'session:create:p1',
    ])

    create.resolve(session(P1))
    await expect(authentication).resolves.toMatchObject({ ok: true, profileId: P1 })
    expect(runtime.trace.at(-1)).toBe('credential:read:p1')
    expect(runtime.app.access).toMatchObject({ status: 'active', profileId: P1 })
  })

  it('awaits a wrong-PIN ledger write and permits a later correct PIN', async () => {
    const runtime = harness({ records: { p1: credential(P1) } })

    await expect(runtime.app.authenticate(P1, '0000', 'verify'))
      .resolves.toMatchObject({ ok: false })
    expect(runtime.trace).toContain('attempt:failure')
    expect(runtime.trace).not.toContain('session:create:p1')
    expect(runtime.app.access.status).toBe('locked')

    await expect(runtime.app.authenticate(P1, '1234', 'verify'))
      .resolves.toMatchObject({ ok: true, profileId: P1 })
    expect(runtime.trace).toContain('attempt:success')
    expect(runtime.app.access.status).toBe('active')
  })

  it.each([
    [
      'cooldown',
      { status: 'cooldown', failedAttempts: 3, retryAt: NOW, remainingMs: 5_000 },
      'Please wait 5 seconds',
    ],
    [
      'temporary lockout',
      { status: 'temporarily-locked', failedAttempts: 10, lockedUntil: NOW, remainingMs: 900_000 },
      'Too many tries',
    ],
  ] as const)('blocks verification during %s', async (_label, status, message) => {
    const runtime = harness({
      records: { p1: credential(P1) },
      status: () => status,
    })

    await expect(runtime.app.authenticate(P1, '1234', 'verify'))
      .resolves.toMatchObject({ ok: false, error: expect.stringContaining(message) })
    expect(runtime.trace).toEqual(['attempt:status'])
  })

  it('restores only an owned Session whose profile and credential still exist', async () => {
    const activeSession = session(P1)
    const valid = harness({
      records: { p1: credential(P1) },
      restored: { status: 'active', session: activeSession },
    })
    await expect(valid.app.restore({ p1: profile(P1) })).resolves.toEqual({
      status: 'active',
      profileId: P1,
      session: activeSession,
    })

    const missingCredential = harness({
      restored: { status: 'active', session: activeSession },
    })
    await expect(missingCredential.app.restore({ p1: profile(P1) }))
      .resolves.toEqual({ status: 'locked', reason: 'credential-unavailable' })
    expect(missingCredential.app.access)
      .toEqual({ status: 'locked', reason: 'authorization-loss' })
    expect(missingCredential.trace).toContain('revocation:learner-credential-reset')
  })

  it.each(['logout', 'lock'] as const)('settles %s through the reviewed lifecycle', async (type) => {
    const activeSession = session(P1)
    const runtime = harness({
      records: { p1: credential(P1) },
      restored: { status: 'active', session: activeSession },
    })
    await runtime.app.restore({ p1: profile(P1) })

    await runtime.app.end({ type, occurredAt: NOW })

    expect(runtime.app.access.status).toBe('locked')
    expect(runtime.trace.filter((entry) => entry === `study:learner-${type === 'logout' ? 'sign-out' : 'lock'}`))
      .toHaveLength(1)
  })

  it('fully settles the old learner before requesting the target learner PIN', async () => {
    const runtime = harness({
      records: { p1: credential(P1), p2: credential(P2) },
      restored: { status: 'active', session: session(P1) },
    })
    await runtime.app.restore({ p1: profile(P1), p2: profile(P2) })

    await runtime.app.end(
      { type: 'learner-switch', targetProfileId: P2, occurredAt: NOW },
      (profileId) => { runtime.trace.push(`pin:request:${profileId}`) },
    )

    expect(runtime.trace.indexOf('lifecycle:end:learner-switch-start'))
      .toBeLessThan(runtime.trace.indexOf('pin:request:p2'))
    expect(runtime.trace.filter((entry) => entry === 'study:learner-switch-start'))
      .toHaveLength(1)
  })

  it('fails closed when lifecycle cleanup fails', async () => {
    const runtime = harness({
      records: { p1: credential(P1) },
      restored: { status: 'active', session: session(P1) },
      lifecycleFailure: true,
    })
    await runtime.app.restore({ p1: profile(P1) })

    await expect(runtime.app.end({ type: 'logout', occurredAt: NOW }))
      .rejects.toThrow('Study cleanup failed')
    expect(runtime.app.access).toEqual({ status: 'locked', reason: 'logout' })
  })

  it('revokes an active learner before deleting and verifying credential reset', async () => {
    const runtime = harness({
      records: { p1: credential(P1) },
      restored: { status: 'active', session: session(P1) },
    })
    await runtime.app.restore({ p1: profile(P1) })
    runtime.trace.length = 0

    await runtime.app.resetCredential(P1)

    expect(runtime.records.has(P1)).toBe(false)
    expect(runtime.trace.indexOf('lifecycle:end:learner-credential-reset'))
      .toBeLessThan(runtime.trace.indexOf('credential:delete:p1'))
    expect(runtime.trace.filter((entry) => entry === 'study:learner-credential-reset'))
      .toHaveLength(1)
  })
})
