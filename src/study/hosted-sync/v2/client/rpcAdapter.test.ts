import { describe, expect, it } from 'vitest'
import { emptyDurableStudyDocument } from '../../../family-pilot/durable-ports/schema'
import { createHostedSyncRpcAdapter } from './rpcAdapter'
import { createFakeHostedSyncRpcProvider } from './testing/fakeRpcProvider'
import { HOSTED_SYNC_OUTCOME_CODES } from './types'
import type {
  HostedSyncAuthenticatedRpcProvider,
  HostedSyncEphemeralAuthorization,
  HostedSyncIdentity,
  HostedSyncRpcProviderResult,
  HostedSyncSnapshot,
} from './types'

const NOW = '2026-08-13T18:00:00.000Z'
const EXPIRES = '2026-08-13T19:00:00.000Z'
const IMPORT_ID = '11111111-1111-4111-8111-111111111111'
const WRITE_ID = '22222222-2222-4222-8222-222222222222'
const ACK_ID = '33333333-3333-4333-8333-333333333333'
const ACK_ID_2 = '44444444-4444-4444-8444-444444444444'
const IDENTITY: HostedSyncIdentity = Object.freeze({
  householdRef: 'household:one',
  learnerRef: 'learner:ada',
  documentRef: 'durable-study-v1',
})

function snapshot(updatedAt = NOW): HostedSyncSnapshot {
  return {
    documentSchemaVersion: 1,
    document: {
      ...emptyDurableStudyDocument(IDENTITY, updatedAt),
      preferences: {
        accessibility: {
          largeText: true,
          reducedMotion: false,
          noAudio: true,
          captions: true,
          transientTranscript: true,
          highContrast: false,
          oneTaskAtATime: true,
        },
        timerPreference: { visibility: 'hidden', milestonesOnly: true },
      },
    },
  }
}

function authorization(
  provider: HostedSyncAuthenticatedRpcProvider,
  onRelease: () => void = () => undefined,
): HostedSyncEphemeralAuthorization {
  return {
    async acquire() {
      return {
        status: 'AUTHORIZED' as const,
        lease: {
          clientKind: 'AUTHENTICATED_USER' as const,
          expiresAt: EXPIRES,
          provider,
          release: onRelease,
        },
      }
    },
  }
}

function adapter(provider: HostedSyncAuthenticatedRpcProvider, onRelease?: () => void) {
  return createHostedSyncRpcAdapter({
    authorization: authorization(provider, onRelease),
    now: () => new Date(NOW),
    isOnline: () => true,
  })
}

describe('hosted sync R2 RPC adapter', () => {
  it('exports exactly the closed non-safety outcome taxonomy', () => {
    expect(HOSTED_SYNC_OUTCOME_CODES).toEqual([
      'SUCCESS', 'OFFLINE', 'NETWORK_UNAVAILABLE', 'TIMEOUT', 'AUTH_REQUIRED',
      'SESSION_EXPIRED', 'RATE_LIMITED', 'STALE_REVISION', 'SERVER_UNAVAILABLE',
      'MALFORMED_RESPONSE', 'PERMANENT_REFUSAL', 'ABORTED',
    ])
  })

  it('round-trips one lossless document through first-link, hydrate, revisioned write, and acknowledgement', async () => {
    const provider = createFakeHostedSyncRpcProvider({ now: () => new Date(NOW) })
    let releases = 0
    const client = adapter(provider, () => { releases += 1 })
    const firstSnapshot = snapshot()

    const imported = await client.firstLinkImport({
      identity: IDENTITY,
      operationId: IMPORT_ID,
      baseRevision: 0,
      adultConfirmation: 'EXPLICIT_ADULT_CONFIRMED',
      confirmedAt: NOW,
      snapshot: firstSnapshot,
    })
    expect(imported).toMatchObject({ code: 'SUCCESS', value: { serverRevision: 1, duplicate: false } })

    const hydrated = await client.hydrate({ identity: IDENTITY })
    expect(hydrated.code).toBe('SUCCESS')
    if (hydrated.code !== 'SUCCESS' || hydrated.value.status !== 'READY') throw new Error('hydrate failed')
    expect(hydrated.value.snapshot).toEqual(firstSnapshot)
    expect(hydrated.value.lastOperationId).toBe(IMPORT_ID)

    const nextSnapshot = snapshot('2026-08-13T18:05:00.000Z')
    const written = await client.revisionedWrite({
      identity: IDENTITY,
      operationId: WRITE_ID,
      baseRevision: 1,
      snapshot: nextSnapshot,
    })
    expect(written).toMatchObject({ code: 'SUCCESS', value: { serverRevision: 2, duplicate: false } })
    expect(provider.inspect(IDENTITY)?.snapshot).toEqual(nextSnapshot)

    expect(await client.acknowledge({
      identity: IDENTITY,
      operationId: ACK_ID_2,
      acknowledgedOperationId: IMPORT_ID,
      serverRevision: 2,
    })).toMatchObject({ code: 'PERMANENT_REFUSAL', reasonCode: 'ACKNOWLEDGEMENT_TARGET_MISMATCH' })

    const acknowledged = await client.acknowledge({
      identity: IDENTITY,
      operationId: ACK_ID,
      acknowledgedOperationId: WRITE_ID,
      serverRevision: 2,
    })
    expect(acknowledged).toMatchObject({ code: 'SUCCESS', value: { duplicate: false } })
    const duplicateTarget = await client.acknowledge({
      identity: IDENTITY,
      operationId: ACK_ID_2,
      acknowledgedOperationId: WRITE_ID,
      serverRevision: 2,
    })
    expect(duplicateTarget).toMatchObject({ code: 'SUCCESS', value: { duplicate: true } })
    expect(releases).toBe(6)
  })

  it('makes a response lost after commit safe by retaining the same operation UUID', async () => {
    const provider = createFakeHostedSyncRpcProvider({ now: () => new Date(NOW) })
    const client = adapter(provider)
    provider.dropNextCommittedResponse('academy_study_sync_first_link_import_v2')
    const input = {
      identity: IDENTITY,
      operationId: IMPORT_ID,
      baseRevision: 0 as const,
      adultConfirmation: 'EXPLICIT_ADULT_CONFIRMED' as const,
      confirmedAt: NOW,
      snapshot: snapshot(),
    }
    expect(await client.firstLinkImport(input)).toMatchObject({ code: 'NETWORK_UNAVAILABLE' })
    expect(await client.firstLinkImport(input)).toMatchObject({
      code: 'SUCCESS',
      value: { operationId: IMPORT_ID, serverRevision: 1, duplicate: true },
    })
    expect(provider.inspect(IDENTITY)?.revision).toBe(1)
  })

  it('returns STALE_REVISION with the server revision and never rewrites the CAS base', async () => {
    const provider = createFakeHostedSyncRpcProvider({ now: () => new Date(NOW) })
    const client = adapter(provider)
    await client.firstLinkImport({
      identity: IDENTITY,
      operationId: IMPORT_ID,
      baseRevision: 0,
      adultConfirmation: 'EXPLICIT_ADULT_CONFIRMED',
      confirmedAt: NOW,
      snapshot: snapshot(),
    })
    const stale = await client.revisionedWrite({
      identity: IDENTITY,
      operationId: WRITE_ID,
      baseRevision: 0,
      snapshot: snapshot('2026-08-13T18:05:00.000Z'),
    })
    expect(stale).toEqual({
      code: 'STALE_REVISION',
      httpStatus: null,
      retryAfterMs: null,
      serverRevision: 1,
      reasonCode: 'CAS_BASE_REVISION_STALE',
    })
  })

  it.each([
    'NETWORK_UNAVAILABLE',
    'TIMEOUT',
    'SESSION_EXPIRED',
    'RATE_LIMITED',
    'SERVER_UNAVAILABLE',
    'PERMANENT_REFUSAL',
    'ABORTED',
  ] as const)('preserves provider failure code %s as a closed non-safety outcome', async (code) => {
    const provider = createFakeHostedSyncRpcProvider()
    provider.failNext({ data: null, error: { code } } as Extract<HostedSyncRpcProviderResult, { data: null }>)
    const result = await adapter(provider).hydrate({ identity: IDENTITY })
    expect(result).toMatchObject({ code })
    expect(result).not.toHaveProperty('safetyEvent')
  })

  it('fails closed for offline, missing auth, expired auth, abort, timeout, and malformed response', async () => {
    const provider = createFakeHostedSyncRpcProvider()
    const offline = createHostedSyncRpcAdapter({
      authorization: authorization(provider), isOnline: () => false,
    })
    expect(await offline.hydrate({ identity: IDENTITY })).toMatchObject({ code: 'OFFLINE' })

    const missing = createHostedSyncRpcAdapter({
      authorization: { acquire: async () => ({ status: 'AUTH_REQUIRED' }) }, isOnline: () => true,
    })
    expect(await missing.hydrate({ identity: IDENTITY })).toMatchObject({ code: 'AUTH_REQUIRED' })

    const expired = createHostedSyncRpcAdapter({
      authorization: {
        acquire: async () => ({
          status: 'AUTHORIZED',
          lease: { clientKind: 'AUTHENTICATED_USER', expiresAt: NOW, provider },
        }),
      },
      now: () => new Date(NOW),
      isOnline: () => true,
    })
    expect(await expired.hydrate({ identity: IDENTITY })).toMatchObject({ code: 'SESSION_EXPIRED' })

    const controller = new AbortController()
    controller.abort()
    expect(await adapter(provider).hydrate({ identity: IDENTITY }, controller.signal)).toMatchObject({ code: 'ABORTED' })

    const never: HostedSyncAuthenticatedRpcProvider = { rpc: async () => new Promise(() => undefined) }
    const midflightAbort = new AbortController()
    const aborting = createHostedSyncRpcAdapter({
      authorization: authorization(never), isOnline: () => true, timeoutMs: 1_000, now: () => new Date(NOW),
    }).hydrate({ identity: IDENTITY }, midflightAbort.signal)
    midflightAbort.abort()
    expect(await aborting).toMatchObject({ code: 'ABORTED' })

    const timed = createHostedSyncRpcAdapter({
      authorization: authorization(never), isOnline: () => true, timeoutMs: 5, now: () => new Date(NOW),
    })
    expect(await timed.hydrate({ identity: IDENTITY })).toMatchObject({ code: 'TIMEOUT' })

    const malformed: HostedSyncAuthenticatedRpcProvider = {
      rpc: async () => ({ data: { schema_version: 2, status: 'ready', extra: true }, error: null }),
    }
    expect(await adapter(malformed).hydrate({ identity: IDENTITY })).toMatchObject({ code: 'MALFORMED_RESPONSE' })
  })

  it('refuses a service-role-shaped lease before the provider can be called', async () => {
    let calls = 0
    const provider: HostedSyncAuthenticatedRpcProvider = {
      rpc: async () => { calls += 1; return { data: null, error: { code: 'PERMANENT_REFUSAL' } } },
    }
    const client = createHostedSyncRpcAdapter({
      authorization: {
        acquire: async () => ({
          status: 'AUTHORIZED',
          lease: {
            clientKind: 'SERVICE_ROLE',
            expiresAt: EXPIRES,
            provider,
          },
        } as unknown as Awaited<ReturnType<HostedSyncEphemeralAuthorization['acquire']>>),
      },
      isOnline: () => true,
      now: () => new Date(NOW),
    })
    expect(await client.hydrate({ identity: IDENTITY })).toMatchObject({
      code: 'AUTH_REQUIRED', reasonCode: 'AUTHENTICATED_USER_CLIENT_REQUIRED',
    })
    expect(calls).toBe(0)
  })
})
