import { describe, expect, it, vi } from 'vitest'
import { emptyProfile } from '../migration'
import { ACADEMY_SYNC_PROTOCOL_VERSION } from '../security/contracts'
import type { CredentialFreeEducationalProfile } from '../security/contracts'
import type { Profile } from '../types'
import { serializeCredentialFreeEducationalProfile } from './credentialFreeProfile'
import {
  ACADEMY_APPLY_PROFILE_MUTATION_V2_RPC,
  ACADEMY_SYNC_SNAPSHOT_V2_RPC,
  AcademySyncV2Client,
  preserveUnsyncedEducationalData,
  runWithNetworkRetry,
  type AcademySyncV2RpcClient,
  type AcademySyncV2RpcResponse,
  type ProfileMutationRowInput,
} from './protocolV2'

const protocolAdvertisement = {
  sync_protocol_version: 2,
  minimum_supported_sync_version: 2,
} as const

const snapshotResponse = (
  rows: unknown[] = [],
  revision = '1',
): AcademySyncV2RpcResponse => ({
  data: {
    status: 'ok',
    mode: 'normal',
    ...protocolAdvertisement,
    revision,
    rows,
  },
  error: null,
})

const mutationResponse = (
  status: string = 'applied',
  revision = '2',
): AcademySyncV2RpcResponse => ({
  data: { status, ...protocolAdvertisement, revision },
  error: null,
})

function mockRpcClient() {
  const rpc = vi.fn()
  const client = {
    rpc: rpc as unknown as AcademySyncV2RpcClient['rpc'],
  } satisfies AcademySyncV2RpcClient
  return { client, rpc }
}

const profile = (pin = '1234'): Profile => ({
  ...emptyProfile('p1', 'Ada', '5'),
  pin,
})

const mutationRow = (
  data: Profile | CredentialFreeEducationalProfile = profile(),
): ProfileMutationRowInput => ({
  profile_id: 'p1',
  data,
  updated_at: '2026-08-09T12:00:00.000Z',
})

const mutationRequest = (
  data: Profile | CredentialFreeEducationalProfile = profile(),
) => ({
  expectedRevision: '1',
  mutationId: 'mutation-1',
  profiles: [mutationRow(data)],
})

describe('Sync Protocol v2 RPC declarations', () => {
  it('pins the wire version and snapshot RPC declaration exactly to v2', async () => {
    const { client, rpc } = mockRpcClient()
    rpc.mockResolvedValue(snapshotResponse())
    const sync = new AcademySyncV2Client(client)

    expect(ACADEMY_SYNC_PROTOCOL_VERSION).toBe(2)
    expect(ACADEMY_SYNC_SNAPSHOT_V2_RPC).toBe('academy_sync_snapshot_v2')
    await expect(sync.snapshot()).resolves.toMatchObject({
      ok: true,
      operation: 'snapshot',
      revision: '1',
    })
    expect(rpc).toHaveBeenCalledWith('academy_sync_snapshot_v2', {
      p_sync_protocol_version: 2,
    })
  })

  it('declares the v2 mutation and sends only an explicit credential-free payload', async () => {
    const { client, rpc } = mockRpcClient()
    rpc.mockResolvedValue(mutationResponse())
    const sync = new AcademySyncV2Client(client)

    expect(ACADEMY_APPLY_PROFILE_MUTATION_V2_RPC).toBe(
      'academy_apply_profile_mutation_v2',
    )
    await expect(sync.applyMutation(mutationRequest())).resolves.toMatchObject({
      ok: true,
      operation: 'mutation',
      status: 'applied',
    })
    expect(rpc).toHaveBeenCalledOnce()
    const [rpcName, params] = rpc.mock.calls[0]
    expect(rpcName).toBe('academy_apply_profile_mutation_v2')
    expect(params).toMatchObject({
      p_sync_protocol_version: 2,
      p_expected_revision: '1',
      p_mutation_id: 'mutation-1',
    })
    expect(params.p_profiles[0]).toMatchObject({
      profile_id: 'p1',
      updated_at: '2026-08-09T12:00:00.000Z',
    })
    expect(
      Object.prototype.hasOwnProperty.call(params.p_profiles[0].data, 'pin'),
    ).toBe(false)
    expect(JSON.stringify(params.p_profiles)).not.toContain('1234')
  })

  it('accepts an already credential-free educational profile as mutation input', async () => {
    const credentialFree = serializeCredentialFreeEducationalProfile(profile())
    const { client, rpc } = mockRpcClient()
    rpc.mockResolvedValue(mutationResponse())

    await expect(
      new AcademySyncV2Client(client).applyMutation(
        mutationRequest(credentialFree),
      ),
    ).resolves.toMatchObject({ ok: true, operation: 'mutation' })
    expect(rpc.mock.calls[0][1].p_profiles[0].data).toEqual(credentialFree)
    expect(Object.prototype.hasOwnProperty.call(credentialFree, 'pin')).toBe(
      false,
    )
  })

  it('rejects a nested credential before any mutation RPC or receipt can be created', async () => {
    const { client, rpc } = mockRpcClient()
    const sync = new AcademySyncV2Client(client)
    const credentialBearing = Object.assign(profile(), {
      extension: { learner_pin: '9999' },
    }) as Profile

    await expect(
      sync.applyMutation(mutationRequest(credentialBearing)),
    ).resolves.toMatchObject({
      ok: false,
      classification: 'credential-bearing-payload-rejection',
      retry: 'never',
      preserveLocalEducationalData: true,
    })
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('v2 snapshot compatibility reader', () => {
  it('consumes both legacy and credential-free rows without republishing a legacy PIN', async () => {
    const legacy = profile('2468')
    const v2 = {
      ...serializeCredentialFreeEducationalProfile({
        ...emptyProfile('p2', 'Grace', '7'),
        pin: '',
      }),
    }
    const { client, rpc } = mockRpcClient()
    rpc.mockResolvedValue(
      snapshotResponse([
        {
          profile_id: 'p1',
          data: legacy,
          updated_at: '2026-08-09T12:00:00.000Z',
        },
        {
          profile_id: 'p2',
          data: v2,
          updated_at: '2026-08-09T12:01:00.000Z',
        },
      ]),
    )
    const result = await new AcademySyncV2Client(client).snapshot()

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rows.map((row) => row.profile_id)).toEqual(['p1', 'p2'])
    expect(result.rows.every((row) => !('pin' in row.data))).toBe(true)
    expect(result.legacyCredentialHandoffs).toHaveLength(1)
    expect(JSON.stringify(result)).not.toContain('2468')
  })

  it.each([
    ['parentPin', '9876'],
    ['accessToken', 'session-secret'],
    ['refreshToken', 'session-secret'],
    ['sessionToken', 'session-secret'],
    ['pinHash', 'session-secret'],
    ['recoveryToken', 'session-secret'],
  ])(
    'fails closed on nested incoming %s without diagnostic leakage',
    async (key, secret) => {
      const unsafe = {
        ...serializeCredentialFreeEducationalProfile(profile()),
        missions: {
          '2026-08-09': {
            items: [
              {
                id: 'mission-1',
                label: 'Educational text may say password safely.',
                done: false,
                nested: { [key]: secret },
              },
            ],
          },
        },
      }
      const { client, rpc } = mockRpcClient()
      rpc.mockResolvedValue(
        snapshotResponse([
          {
            profile_id: 'p1',
            data: unsafe,
            updated_at: '2026-08-09T12:00:00.000Z',
          },
        ]),
      )

      const result = await new AcademySyncV2Client(client).snapshot()
      expect(result).toMatchObject({
        ok: false,
        classification: 'credential-bearing-payload-rejection',
      })
      expect(JSON.stringify(result)).not.toContain(secret)
    },
  )
})

describe('strict protocol-v2 response shapes', () => {
  it.each([
    [
      'unknown status in normal mode',
      { status: 'future-success', mode: 'normal' },
    ],
    ['known status in unknown mode', { status: 'ok', mode: 'future-mode' }],
    ['missing status in normal mode', { mode: 'normal' }],
  ])('rejects an %s snapshot response', async (_label, shape) => {
    const { client, rpc } = mockRpcClient()
    rpc.mockResolvedValue({
      data: { ...shape, ...protocolAdvertisement, revision: '1', rows: [] },
      error: null,
    })
    await expect(
      new AcademySyncV2Client(client).snapshot(),
    ).resolves.toMatchObject({
      ok: false,
      classification: 'authentication-provenance-mismatch',
    })
  })

  it('rejects an applied mutation paired with an unknown mode', async () => {
    const { client, rpc } = mockRpcClient()
    rpc.mockResolvedValue({
      data: {
        status: 'applied',
        mode: 'future-mode',
        ...protocolAdvertisement,
        revision: '2',
      },
      error: null,
    })
    await expect(
      new AcademySyncV2Client(client).applyMutation(mutationRequest()),
    ).resolves.toMatchObject({
      ok: false,
      classification: 'authentication-provenance-mismatch',
    })
  })
})

describe('v2 maintenance and update-required controls', () => {
  it('pauses every write trigger in maintenance without scheduling retries', async () => {
    const { client, rpc } = mockRpcClient()
    rpc.mockResolvedValue({
      data: {
        status: 'maintenance',
        mode: 'maintenance',
        ...protocolAdvertisement,
        retry_after: '2026-08-09T12:15:00.000Z',
      },
      error: null,
    })
    const sync = new AcademySyncV2Client(client)
    const maintenance = await sync.snapshot()
    expect(maintenance).toMatchObject({
      ok: false,
      classification: 'maintenance',
      retry: 'never',
      state: {
        status: 'maintenance',
        controls: {
          automaticWrites: 'paused',
          manualWrites: 'paused',
          debouncedWrites: 'paused',
          reconnectWrites: 'paused',
          retryTimers: 'disabled',
        },
      },
    })

    const wait = vi.fn(async () => undefined)
    const blocked = await runWithNetworkRetry(
      () => sync.applyMutation(mutationRequest()),
      { wait, maxAttempts: 5 },
    )
    expect(blocked).toMatchObject({
      ok: false,
      classification: 'maintenance',
    })
    expect(rpc).toHaveBeenCalledOnce()
    expect(wait).not.toHaveBeenCalled()
  })

  it('does not start a retry timer when an explicit maintenance probe loses the network', async () => {
    const { client, rpc } = mockRpcClient()
    rpc
      .mockResolvedValueOnce({
        data: {
          status: 'maintenance',
          mode: 'maintenance',
          ...protocolAdvertisement,
        },
        error: null,
      })
      .mockRejectedValueOnce(new TypeError('offline'))
    const sync = new AcademySyncV2Client(client)
    await sync.snapshot()
    const wait = vi.fn(async () => undefined)
    const result = await runWithNetworkRetry(
      () => sync.snapshot({ intent: 'maintenance-probe' }),
      { wait, maxAttempts: 5 },
    )
    expect(result).toMatchObject({
      ok: false,
      classification: 'network-transient',
      retry: 'never',
      reconciliation: 'paused-preserve-local',
      state: { status: 'maintenance' },
    })
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(wait).not.toHaveBeenCalled()
  })

  it('makes update-required terminal for automatic, reconnect, and manual work in this bundle', async () => {
    const { client, rpc } = mockRpcClient()
    rpc.mockResolvedValue({
      data: {
        status: 'update-required',
        sync_protocol_version: 3,
        minimum_supported_sync_version: 3,
      },
      error: null,
    })
    const sync = new AcademySyncV2Client(client)
    const wait = vi.fn(async () => undefined)
    const update = await runWithNetworkRetry(() => sync.snapshot(), {
      wait,
      maxAttempts: 5,
    })
    expect(update).toMatchObject({
      ok: false,
      classification: 'unsupported-protocol-update-required',
      retry: 'never',
      state: {
        status: 'update-required',
        refreshRequired: true,
        controls: {
          automaticWrites: 'stopped',
          manualWrites: 'stopped',
          debouncedWrites: 'stopped',
          reconnectWrites: 'stopped',
          retryTimers: 'disabled',
        },
      },
    })
    expect(wait).not.toHaveBeenCalled()
    await expect(sync.snapshot({ intent: 'manual' })).resolves.toMatchObject({
      classification: 'unsupported-protocol-update-required',
    })
    await expect(sync.applyMutation(mutationRequest())).resolves.toMatchObject({
      classification: 'unsupported-protocol-update-required',
    })
    expect(rpc).toHaveBeenCalledOnce()
  })
})

describe('v2 outcome and retry classification', () => {
  it('retries only a network/transient failure with bounded exponential backoff', async () => {
    const { client, rpc } = mockRpcClient()
    rpc
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(snapshotResponse([], '7'))
    const wait = vi.fn(async () => undefined)
    const result = await runWithNetworkRetry(
      () => new AcademySyncV2Client(client).snapshot(),
      { wait, maxAttempts: 3, baseDelayMs: 200 },
    )
    expect(result).toMatchObject({ ok: true, revision: '7' })
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(wait).toHaveBeenCalledOnce()
    expect(wait).toHaveBeenCalledWith(200)
  })

  it('returns a CAS conflict for review and never retries it blindly', async () => {
    const { client, rpc } = mockRpcClient()
    rpc.mockResolvedValue(mutationResponse('conflict', '9'))
    const sync = new AcademySyncV2Client(client)
    const wait = vi.fn(async () => undefined)
    const result = await runWithNetworkRetry(
      () => sync.applyMutation(mutationRequest()),
      { wait, maxAttempts: 5 },
    )
    expect(result).toMatchObject({
      ok: false,
      classification: 'cas-conflict',
      retry: 'never',
      revision: '9',
      reconciliation: 'parent-review',
    })
    expect(rpc).toHaveBeenCalledOnce()
    expect(wait).not.toHaveBeenCalled()
  })

  it.each([
    ['credential-rejected', 'credential-bearing-payload-rejection'],
    ['authentication-mismatch', 'authentication-provenance-mismatch'],
    ['provenance-mismatch', 'authentication-provenance-mismatch'],
  ] as const)('treats %s as terminal %s', async (status, classification) => {
    const { client, rpc } = mockRpcClient()
    rpc.mockResolvedValue(mutationResponse(status))
    const wait = vi.fn(async () => undefined)
    const result = await runWithNetworkRetry(
      () => new AcademySyncV2Client(client).applyMutation(mutationRequest()),
      { wait, maxAttempts: 5 },
    )
    expect(result).toMatchObject({
      ok: false,
      classification,
      retry: 'never',
      preserveLocalEducationalData: true,
    })
    expect(rpc).toHaveBeenCalledOnce()
    expect(wait).not.toHaveBeenCalled()
  })
})

describe('unsynced educational data preservation', () => {
  it('retains dirty local educational profiles for reviewed reconciliation', async () => {
    const { client, rpc } = mockRpcClient()
    rpc.mockResolvedValue({
      data: {
        status: 'maintenance',
        mode: 'maintenance',
        ...protocolAdvertisement,
      },
      error: null,
    })
    const outcome = await new AcademySyncV2Client(client).snapshot()
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    const local = {
      p1: serializeCredentialFreeEducationalProfile(profile('8642')),
    }
    const preserved = preserveUnsyncedEducationalData(local, ['p1'], outcome)

    expect(preserved.profiles).toBe(local)
    expect(preserved.dirtyProfileIds).toEqual(['p1'])
    expect(preserved.profiles.p1.name).toBe('Ada')
    expect(preserved.disposition).toBe('maintenance-paused')
    expect(JSON.stringify(preserved)).not.toContain('8642')
    expect(
      Object.prototype.hasOwnProperty.call(preserved.profiles.p1, 'pin'),
    ).toBe(false)
  })
})

describe('legacy endpoint exclusion', () => {
  it('never intentionally calls a legacy mutation or snapshot endpoint', async () => {
    const { client, rpc } = mockRpcClient()
    rpc
      .mockResolvedValueOnce(snapshotResponse())
      .mockResolvedValueOnce(mutationResponse())
    const sync = new AcademySyncV2Client(client)
    await sync.snapshot()
    await sync.applyMutation(mutationRequest())
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'academy_sync_snapshot_v2',
      'academy_apply_profile_mutation_v2',
    ])
  })
})
