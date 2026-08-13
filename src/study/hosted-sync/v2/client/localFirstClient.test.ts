import { describe, expect, it } from 'vitest'
import { emptyDurableStudyDocument } from '../../../family-pilot/durable-ports/schema'
import { createHostedSyncLocalFirstClient, type HostedSyncCanonicalLocalPort } from './localFirstClient'
import { emptyHostedSyncQueue, parseHostedSyncQueue, type HostedSyncDurableQueueStore } from './queue'
import { createHostedSyncRpcAdapter } from './rpcAdapter'
import { createFakeHostedSyncRpcProvider } from './testing/fakeRpcProvider'
import type {
  HostedSyncAuthenticatedRpcProvider,
  HostedSyncEphemeralAuthorization,
  HostedSyncIdentity,
  HostedSyncSnapshot,
} from './types'

const START = Date.parse('2026-08-13T18:00:00.000Z')
const IMPORT_ID = '11111111-1111-4111-8111-111111111111'
const WRITE_ID = '22222222-2222-4222-8222-222222222222'
const ACK_ID = '33333333-3333-4333-8333-333333333333'
const IDENTITY: HostedSyncIdentity = {
  householdRef: 'household:one',
  learnerRef: 'learner:ada',
  documentRef: 'durable-study-v1',
}

function snapshot(updatedAt = new Date(START).toISOString()): HostedSyncSnapshot {
  return {
    documentSchemaVersion: 1,
    document: emptyDurableStudyDocument(IDENTITY, updatedAt),
  }
}

function authorization(provider: HostedSyncAuthenticatedRpcProvider): HostedSyncEphemeralAuthorization {
  return {
    acquire: async () => ({
      status: 'AUTHORIZED',
      lease: {
        clientKind: 'AUTHENTICATED_USER',
        expiresAt: '2026-08-13T20:00:00.000Z',
        provider,
      },
    }),
  }
}

function memoryQueue(events: string[] = []): HostedSyncDurableQueueStore & { state: ReturnType<typeof emptyHostedSyncQueue> } {
  let state = emptyHostedSyncQueue()
  return {
    get state() { return state },
    async read() { return state },
    async update(transform) {
      const next = transform(state)
      const parsed = parseHostedSyncQueue(next)
      if (!parsed) throw new Error('fake IndexedDB refused queue state')
      state = parsed
      events.push('queue-durable')
      return state
    },
  }
}

describe('hosted sync R2 local-first client', () => {
  it('cannot contact hosted sync before a confirmed local save and queues while offline', async () => {
    const events: string[] = []
    const provider = createFakeHostedSyncRpcProvider()
    const queue = memoryQueue(events)
    let nowMs = START
    const local: HostedSyncCanonicalLocalPort = {
      async readCanonicalSnapshot() { events.push('local-read'); return snapshot() },
      async applyHydratedSnapshot() { events.push('local-apply'); return { status: 'DURABLE' } },
    }
    const rpc = createHostedSyncRpcAdapter({
      authorization: authorization(provider),
      isOnline: () => false,
      now: () => new Date(nowMs),
    })
    const client = createHostedSyncLocalFirstClient({
      rpc, queue, local, operationId: () => ACK_ID, now: () => new Date(nowMs),
    })

    events.push('local-saved')
    await client.recordWriteAfterLocalSave({
      localSaveConfirmed: true,
      identity: IDENTITY,
      operationId: WRITE_ID,
      baseRevision: 7,
    })
    expect(events.slice(0, 2)).toEqual(['local-saved', 'queue-durable'])
    expect(provider.calls).toHaveLength(0)

    const outcome = await client.flushNext()
    expect(outcome).toMatchObject({ code: 'OFFLINE' })
    expect(provider.calls).toHaveLength(0)
    expect(queue.state.entries[0]).toMatchObject({
      operationId: WRITE_ID,
      baseRevision: 7,
      attempts: 1,
    })
    nowMs += 1_000
    expect(await client.flushNext()).toEqual({ code: 'SUCCESS', value: { status: 'RETRY_WAIT' } })
  })

  it('retries a commit whose response was lost with the identical UUID and receives duplicate success', async () => {
    const provider = createFakeHostedSyncRpcProvider({ now: () => new Date(START) })
    provider.dropNextCommittedResponse('academy_study_sync_first_link_import_v2')
    const queue = memoryQueue()
    let nowMs = START
    const client = createHostedSyncLocalFirstClient({
      rpc: createHostedSyncRpcAdapter({
        authorization: authorization(provider), isOnline: () => true, now: () => new Date(nowMs),
      }),
      queue,
      local: {
        readCanonicalSnapshot: async () => snapshot(),
        applyHydratedSnapshot: async () => ({ status: 'DURABLE' }),
      },
      operationId: () => ACK_ID,
      now: () => new Date(nowMs),
    })
    await client.recordFirstLinkAfterLocalSave({
      localSaveConfirmed: true,
      identity: IDENTITY,
      operationId: IMPORT_ID,
      adultConfirmation: 'EXPLICIT_ADULT_CONFIRMED',
      confirmedAt: new Date(START).toISOString(),
    })
    expect(await client.flushNext()).toMatchObject({ code: 'NETWORK_UNAVAILABLE' })
    expect(queue.state.entries[0]).toMatchObject({ operationId: IMPORT_ID, baseRevision: 0, attempts: 1 })
    nowMs += 3_000
    expect(await client.flushNext()).toEqual({
      code: 'SUCCESS',
      value: { status: 'SYNCED', operationId: IMPORT_ID, serverRevision: 1, duplicate: true },
    })
    expect(queue.state.entries).toHaveLength(0)
    expect(provider.calls.map((call) => call.args.p_operation_id)).toEqual([IMPORT_ID, IMPORT_ID])
    expect(provider.inspect(IDENTITY)?.revision).toBe(1)
  })

  it('durably applies hydrate before it queues and sends an acknowledgement', async () => {
    const events: string[] = []
    const provider = createFakeHostedSyncRpcProvider({ now: () => new Date(START) })
    let nowMs = START
    const rpc = createHostedSyncRpcAdapter({
      authorization: authorization(provider), isOnline: () => true, now: () => new Date(nowMs),
    })
    await rpc.firstLinkImport({
      identity: IDENTITY,
      operationId: IMPORT_ID,
      baseRevision: 0,
      adultConfirmation: 'EXPLICIT_ADULT_CONFIRMED',
      confirmedAt: new Date(START).toISOString(),
      snapshot: snapshot(),
    })
    const queue = memoryQueue(events)
    let hydrated: HostedSyncSnapshot | null = null
    const client = createHostedSyncLocalFirstClient({
      rpc,
      queue,
      local: {
        readCanonicalSnapshot: async () => hydrated ?? snapshot(),
        async applyHydratedSnapshot(input) {
          hydrated = input.snapshot
          events.push('indexeddb-hydrate-durable')
          return { status: 'DURABLE' }
        },
      },
      operationId: () => ACK_ID,
      now: () => new Date(nowMs),
    })

    expect(await client.hydrate(IDENTITY)).toEqual({
      code: 'SUCCESS',
      value: {
        status: 'HYDRATED_AND_ACK_QUEUED',
        serverRevision: 1,
        acknowledgementOperationId: ACK_ID,
      },
    })
    expect(events).toEqual(['indexeddb-hydrate-durable', 'queue-durable'])
    expect(queue.state.entries[0]).toMatchObject({
      kind: 'ACKNOWLEDGEMENT',
      operationId: ACK_ID,
      acknowledgedOperationId: IMPORT_ID,
      serverRevision: 1,
    })
    provider.dropNextCommittedResponse('academy_study_sync_acknowledge_v2')
    expect(await client.flushNext()).toMatchObject({ code: 'NETWORK_UNAVAILABLE' })
    expect(queue.state.entries[0]).toMatchObject({ operationId: ACK_ID, attempts: 1 })
    nowMs += 3_000
    expect(await client.flushNext()).toMatchObject({
      code: 'SUCCESS',
      value: { status: 'SYNCED', operationId: ACK_ID, serverRevision: 1, duplicate: true },
    })
  })
})
