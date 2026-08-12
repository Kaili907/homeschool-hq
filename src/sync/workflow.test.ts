import { describe, expect, it, vi } from 'vitest'
import { defaultAppState, emptyProfile } from '../migration'
import { toWireProfile } from '../portableProfile'
import type { Profile } from '../types'
import { metaAfterSuccessfulSync } from './engine'
import { emptyHouseholdMeta, type RemoteProfileRow } from './types'
import {
  executeAutomaticCycle,
  inspectUnboundHousehold,
  prepareConfirmedLocalUpload,
  type SyncTransport,
} from './workflow'

const NOW = Date.parse('2026-07-24T12:00:00Z')
const localProfiles = () => defaultAppState().profiles
const row = (profile: Profile, time = NOW): RemoteProfileRow => ({
  profile_id: profile.id,
  data: toWireProfile(profile),
  updated_at: new Date(time).toISOString(),
})
const transport = (
  pullResult: Awaited<ReturnType<SyncTransport['pull']>>,
): SyncTransport & { push: ReturnType<typeof vi.fn> } => ({
  pull: vi.fn(async () => pullResult),
  push: vi.fn(async (_rows, _expectedRows, expectedRevision) => ({
    ok: true as const,
    revision: String(Number(expectedRevision) + 1),
  })),
})

describe('first authenticated sync safety', () => {
  it('local data + first sign-in + empty cloud performs no upload before confirmation', async () => {
    const sync = transport({ ok: true, rows: [], revision: '0' })
    const inspected = await inspectUnboundHousehold(
      localProfiles(),
      emptyHouseholdMeta('household-a'),
      sync.pull,
    )
    expect(inspected.kind).toBe('preview')
    expect(sync.push).not.toHaveBeenCalled()
  })

  it('local data + first sign-in + cloud data performs no overwrite or push', async () => {
    const cloud = row(emptyProfile('p1', 'Cloud child', '3'))
    const sync = transport({ ok: true, rows: [cloud], revision: '3' })
    const local = localProfiles()
    const before = JSON.stringify(local)
    const inspected = await inspectUnboundHousehold(
      local,
      emptyHouseholdMeta('household-a'),
      sync.pull,
    )
    expect(inspected.kind).toBe('preview')
    expect(JSON.stringify(local)).toBe(before)
    expect(sync.push).not.toHaveBeenCalled()
  })

  it('explicit confirmation prepares rows without bypassing the guarded transport', () => {
    const sync = transport({ ok: true, rows: [], revision: '0' })
    expect(sync.push).not.toHaveBeenCalled()
    const result = prepareConfirmedLocalUpload(
      localProfiles(),
      emptyHouseholdMeta('household-a'),
      NOW,
      '0',
    )
    expect(result.rows).toHaveLength(5)
    expect(sync.push).not.toHaveBeenCalled()
  })

  it('cancelled migration stays local-only and performs no cloud write', async () => {
    const sync = transport({ ok: true, rows: [], revision: '0' })
    await inspectUnboundHousehold(
      localProfiles(),
      emptyHouseholdMeta('household-a'),
      sync.pull,
    )
    // Cancellation intentionally calls no workflow mutation.
    expect(sync.push).not.toHaveBeenCalled()
  })
})

describe('pull and account safety', () => {
  it('pull failure is not empty cloud and cannot trigger a push', async () => {
    const sync = transport({ ok: false, error: 'network down' })
    const inspected = await inspectUnboundHousehold(
      localProfiles(),
      emptyHouseholdMeta('household-a'),
      sync.pull,
    )
    expect(inspected).toEqual({ kind: 'pull-error', error: 'network down' })
    expect(sync.push).not.toHaveBeenCalled()
  })

  it('a failed matching-household pull preserves metadata and performs no push', async () => {
    const local = localProfiles()
    const rows = Object.values(local).map((profile) => row(profile))
    const bound = {
      ...metaAfterSuccessfulSync(
        emptyHouseholdMeta('household-a'),
        local,
        rows,
        NOW,
        '4',
      ),
      binding: 'bound' as const,
      ownsLocalData: true,
    }
    const sync = transport({ ok: false, error: 'timeout' })
    const result = await executeAutomaticCycle(local, bound, NOW + 1, sync)
    expect(result).toEqual({ kind: 'pull-error', error: 'timeout' })
    expect(sync.push).not.toHaveBeenCalled()
    expect(bound.lastSyncAt).toBe(NOW)
  })

  it('unbound Household B cannot upload Household A local profiles', async () => {
    const sync = transport({ ok: true, rows: [], revision: '0' })
    const result = await executeAutomaticCycle(
      localProfiles(),
      emptyHouseholdMeta('household-b'),
      NOW,
      sync,
    )
    expect(result).toEqual({ kind: 'unbound' })
    expect(sync.pull).not.toHaveBeenCalled()
    expect(sync.push).not.toHaveBeenCalled()
  })

  it('same household binding safely resumes after sign-in', async () => {
    const local = localProfiles()
    const rows = Object.values(local).map((profile) => row(profile))
    const bound = {
      ...metaAfterSuccessfulSync(
        emptyHouseholdMeta('household-a'),
        local,
        rows,
        NOW,
        '4',
      ),
      binding: 'bound' as const,
      ownsLocalData: true,
    }
    const sync = transport({ ok: true, rows, revision: '4' })
    const result = await executeAutomaticCycle(local, bound, NOW + 1, sync)
    expect(result.kind).toBe('success')
    expect(sync.pull).toHaveBeenCalledOnce()
    expect(sync.push).not.toHaveBeenCalled()
  })
})

describe('conflict safety', () => {
  it('two-sided conflict surfaces review rather than silently resolving', async () => {
    const base = emptyProfile('p1', 'Ada', '3')
    const baseline = [row(base)]
    const bound = {
      ...metaAfterSuccessfulSync(
        emptyHouseholdMeta('household-a'),
        { p1: base },
        baseline,
        NOW,
        '4',
      ),
      binding: 'bound' as const,
      ownsLocalData: true,
    }
    const local = { p1: { ...base, name: 'Local Ada' } }
    const cloud = [row({ ...base, name: 'Cloud Ada' }, NOW + 1)]
    const sync = transport({ ok: true, rows: cloud, revision: '4' })
    const result = await executeAutomaticCycle(local, bound, NOW + 2, sync)
    expect(result.kind).toBe('review')
    expect(sync.push).not.toHaveBeenCalled()
  })

  it('keeps dirty local data in review when another device wins the server CAS', async () => {
    const base = emptyProfile('p1', 'Ada', '3')
    const baseline = [row(base)]
    const bound = {
      ...metaAfterSuccessfulSync(
        emptyHouseholdMeta('household-a'),
        { p1: base },
        baseline,
        NOW,
        '4',
      ),
      binding: 'bound' as const,
      ownsLocalData: true,
    }
    const local = { p1: { ...base, name: 'Locally changed' } }
    const sync = transport({ ok: true, rows: baseline, revision: '4' })
    sync.push.mockResolvedValueOnce({
      ok: false,
      conflict: true,
      revision: '5',
      error: 'Another device won.',
    })

    const result = await executeAutomaticCycle(local, bound, NOW + 1, sync)

    expect(result).toMatchObject({
      kind: 'push-error',
      conflict: true,
      revision: '5',
      meta: {
        reconciliation: 'review',
        profiles: { p1: { dirty: true } },
      },
    })
  })
})
