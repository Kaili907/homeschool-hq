import { describe, expect, it } from 'vitest'
import { emptyProfile } from '../migration'
import type { Profile } from '../types'
import {
  applyReviewedSelection,
  automaticSyncPlan,
  buildReconciliationPreview,
  clearDirtyAfterPush,
  dirtyIds,
  markDirty,
  metaAfterSuccessfulSync,
  pendingRows,
  profileHash,
} from './engine'
import {
  emptyHouseholdMeta,
  type HouseholdSyncMeta,
  type RemoteProfileRow,
} from './types'

const T1 = Date.parse('2026-07-24T10:00:00Z')
const T2 = Date.parse('2026-07-24T11:00:00Z')
const profile = (id = 'p1', name = 'Ada'): Profile =>
  emptyProfile(id, name, '3')
const row = (data: Profile, time = T1): RemoteProfileRow => ({
  profile_id: data.id,
  data,
  updated_at: new Date(time).toISOString(),
})
const boundMeta = (
  local: Record<string, Profile>,
  remote: RemoteProfileRow[],
): HouseholdSyncMeta => ({
  ...metaAfterSuccessfulSync(
    emptyHouseholdMeta('household-a', 'a@example.com'),
    local,
    remote,
    T1,
    '4',
  ),
  binding: 'bound',
  ownsLocalData: true,
})

describe('reconciliation preview', () => {
  it('hashes equivalent profile objects independently of JSON key order', () => {
    const original = profile()
    const reordered = Object.fromEntries(
      Object.entries(original).reverse(),
    ) as unknown as Profile
    expect(profileHash(reordered)).toBe(profileHash(original))
  })

  it('identifies local-only and cloud-only profiles', () => {
    const local = { p1: profile('p1', 'Local') }
    const cloud = [row(profile('p2', 'Cloud'))]
    const preview = buildReconciliationPreview(
      local,
      cloud,
      emptyHouseholdMeta('household-a'),
    )
    expect(
      preview.profiles.map(({ id, category }) => ({ id, category })),
    ).toEqual([
      { id: 'p1', category: 'local-only' },
      { id: 'p2', category: 'cloud-only' },
    ])
  })

  it('treats unverified two-sided differences as review conflicts', () => {
    const local = profile()
    const cloud = { ...local, name: 'Cloud Ada' }
    const preview = buildReconciliationPreview(
      { p1: local },
      [row(cloud)],
      emptyHouseholdMeta('household-a'),
    )
    expect(preview.hasConflicts).toBe(true)
    expect(preview.profiles[0].category).toBe('both-changed')
  })

  it('identifies local, cloud, and true two-sided changes from verified baselines', () => {
    const base1 = profile('p1', 'One')
    const base2 = profile('p2', 'Two')
    const base3 = profile('p3', 'Three')
    const localBase = { p1: base1, p2: base2, p3: base3 }
    const remoteBase = [row(base1), row(base2), row(base3)]
    const meta = boundMeta(localBase, remoteBase)
    const local = {
      p1: { ...base1, name: 'Local One' },
      p2: base2,
      p3: { ...base3, name: 'Local Three' },
    }
    const remote = [
      row(base1, T2),
      row({ ...base2, name: 'Cloud Two' }, T2),
      row({ ...base3, name: 'Cloud Three' }, T2),
    ]
    const preview = buildReconciliationPreview(local, remote, meta)
    expect(
      Object.fromEntries(
        preview.profiles.map((item) => [item.id, item.category]),
      ),
    ).toEqual({
      p1: 'local-changed',
      p2: 'cloud-changed',
      p3: 'both-changed',
    })
  })
})

describe('safe reconciliation', () => {
  it('never shallow-merges a true conflict and requires a whole-profile choice', () => {
    const base = profile()
    const local = { p1: { ...base, name: 'Local Ada', coolStars: true } }
    const cloudProfile = { ...base, name: 'Cloud Ada' }
    const preview = buildReconciliationPreview(
      local,
      [row(cloudProfile)],
      emptyHouseholdMeta('household-a'),
    )
    expect(() =>
      applyReviewedSelection(local, [row(cloudProfile)], preview, {}, T2),
    ).toThrow(/Choose a copy/)
    const chosen = applyReviewedSelection(
      local,
      [row(cloudProfile)],
      preview,
      { p1: 'cloud' },
      T2,
    )
    expect(chosen.profiles.p1).toEqual(cloudProfile)
    expect(chosen.profiles.p1.coolStars).toBeUndefined()
  })

  it('matching binding automatically applies one-sided changes only', () => {
    const base = profile()
    const meta = boundMeta({ p1: base }, [row(base)])
    const localChanged = { p1: { ...base, name: 'Local Ada' } }
    const plan = automaticSyncPlan(localChanged, [row(base)], meta, T2, '4')
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.toPush).toHaveLength(1)
    expect(plan.profiles.p1.name).toBe('Local Ada')
  })

  it('two-sided changes return review and no automatic push plan', () => {
    const base = profile()
    const meta = boundMeta({ p1: base }, [row(base)])
    const plan = automaticSyncPlan(
      { p1: { ...base, name: 'Local Ada' } },
      [row({ ...base, name: 'Cloud Ada' }, T2)],
      meta,
      T2,
      '4',
    )
    expect(plan.ok).toBe(false)
    if (plan.ok) return
    expect(plan.preview.hasConflicts).toBe(true)
  })
})

describe('household queue metadata', () => {
  it('queues and clears rows without changing another household record', () => {
    const local = { p1: profile() }
    const a = markDirty(emptyHouseholdMeta('household-a'), ['p1'], T1)
    const b = emptyHouseholdMeta('household-b')
    const rows = pendingRows(local, a)
    const cleared = clearDirtyAfterPush(a, rows)
    expect(dirtyIds(a)).toEqual(['p1'])
    expect(dirtyIds(cleared)).toEqual([])
    expect(b.profiles).toEqual({})
    expect(cleared.profiles.p1.lastCloudHash).toBe(profileHash(local.p1))
  })
})
