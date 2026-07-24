import { describe, expect, it } from 'vitest'
import type { Profile } from '../types'
import { emptyProfile } from '../migration'
import type { RemoteProfileRow, SyncMeta } from './types'
import { emptyMeta } from './types'
import {
  changedProfiles,
  clearDirty,
  dirtyIds,
  fieldGroupMerge,
  flushPending,
  markDirty,
  pendingRows,
  reconcile,
} from './engine'

const T1 = Date.parse('2026-07-24T10:00:00Z')
const T2 = Date.parse('2026-07-24T11:00:00Z') // later than T1

// a profile with some field-groups set
const withGroups = (over: Partial<Profile>): Profile => ({ ...emptyProfile('p1', 'Ada', '3'), ...over })
const metaFor = (id: string, updatedAt: number, dirty = false): SyncMeta => ({
  profiles: { [id]: { updatedAt, dirty } },
})
const row = (data: Profile, updatedAtMs: number): RemoteProfileRow => ({
  profile_id: data.id,
  data,
  updated_at: new Date(updatedAtMs).toISOString(),
})

// ---------------------------------------------------------------------------
// Conflict resolution: last-write-wins per field-group by updated_at.
// ---------------------------------------------------------------------------
describe('M6 conflict resolution (LWW per field-group)', () => {
  it('local newer → local field-group wins', () => {
    const loc = withGroups({ totals: { questionsAnswered: 9, correct: 9, bestStreak: 3, sessions: 2 } })
    const rem = withGroups({ totals: { questionsAnswered: 1, correct: 1, bestStreak: 1, sessions: 1 } })
    const out = reconcile({ p1: loc }, metaFor('p1', T2), [row(rem, T1)], T2)
    expect(out.profiles.p1.totals.questionsAnswered).toBe(9) // local (newer) won
  })

  it('remote newer → remote field-group wins', () => {
    const loc = withGroups({ totals: { questionsAnswered: 9, correct: 9, bestStreak: 3, sessions: 2 } })
    const rem = withGroups({ totals: { questionsAnswered: 50, correct: 40, bestStreak: 7, sessions: 5 } })
    const out = reconcile({ p1: loc }, metaFor('p1', T1), [row(rem, T2)], T2)
    expect(out.profiles.p1.totals.questionsAnswered).toBe(50) // remote (newer) won
  })

  it('equal timestamps → local wins (deterministic tiebreak)', () => {
    const loc = withGroups({ coolStars: true })
    const rem = withGroups({ coolStars: false })
    const out = reconcile({ p1: loc }, metaFor('p1', T1), [row(rem, T1)], T2)
    expect(out.profiles.p1.coolStars).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Merge never drops a field-group the other side has and this side lacks.
// ---------------------------------------------------------------------------
describe('M6 merge never drops field-groups', () => {
  it('keeps a remote-only group when LOCAL is newer', () => {
    // local newer (distinct totals) but has no typing; remote (older) has typing.
    const typing = { unlockedIndex: 3, lessons: {}, drillsCompleted: 4 }
    const loc = withGroups({ totals: { questionsAnswered: 99, correct: 99, bestStreak: 9, sessions: 9 } })
    const rem = withGroups({ typing })
    const out = reconcile({ p1: loc }, metaFor('p1', T2), [row(rem, T1)], T2)
    expect(out.profiles.p1.typing).toEqual(typing) // remote-only group not dropped
    expect(out.profiles.p1.totals.questionsAnswered).toBe(99) // local (newer) value kept
    // merged union (local's newer totals + remote's typing) differs from remote → pushed
    expect(out.toPush.some((r) => r.profile_id === 'p1')).toBe(true)
  })

  it('keeps a local-only group when REMOTE is newer', () => {
    const stars = { balance: 12, lifetimeEarned: 30, ledger: [], pendingRedemptions: [] }
    const loc = withGroups({ stars }) // local-only group
    const rem = withGroups({}) // remote newer, no stars
    const out = reconcile({ p1: loc }, metaFor('p1', T1), [row(rem, T2)], T2)
    expect(out.profiles.p1.stars).toEqual(stars) // not dropped
    expect(out.toPush.some((r) => r.profile_id === 'p1')).toBe(true) // pushed so cloud gets it
  })

  it('fieldGroupMerge is a pure per-group overlay', () => {
    const winner = withGroups({ coolStars: true })
    const loser = withGroups({ typing: { unlockedIndex: 1, lessons: {}, drillsCompleted: 0 } })
    const m = fieldGroupMerge(winner, loser)
    expect(m.coolStars).toBe(true) // winner's group
    expect(m.typing).toBeDefined() // loser-only group kept
  })
})

// ---------------------------------------------------------------------------
// reconcile set operations: local-only pushes, remote-only adopts.
// ---------------------------------------------------------------------------
describe('M6 reconcile set operations', () => {
  it('local-only profile is kept and queued to push', () => {
    const loc = emptyProfile('p2', 'Mia', '4')
    const out = reconcile({ p2: loc }, metaFor('p2', T1), [], T2)
    expect(out.profiles.p2).toBeDefined()
    expect(out.toPush.map((r) => r.profile_id)).toContain('p2')
  })

  it('remote-only profile is adopted with no push', () => {
    const rem = emptyProfile('p3', 'Zoe', '6')
    const out = reconcile({}, emptyMeta(), [row(rem, T1)], T2)
    expect(out.profiles.p3.name).toBe('Zoe')
    expect(out.toPush).toHaveLength(0)
    expect(out.meta.profiles.p3.dirty).toBe(false)
  })

  it('identical both sides → no push', () => {
    const p = emptyProfile('p1', 'Ada', '3')
    const out = reconcile({ p1: p }, metaFor('p1', T1), [row(p, T1)], T2)
    expect(out.toPush).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Offline queue: dirty tracking + flush on reconnect.
// ---------------------------------------------------------------------------
describe('M6 offline write queue', () => {
  it('local changes mark profiles dirty and queue their rows', () => {
    const before = { p1: emptyProfile('p1', 'Ada', '3') }
    const after = { p1: { ...before.p1, coolStars: true } }
    const changed = changedProfiles(before, after)
    expect(changed).toEqual(['p1'])
    let meta = markDirty(emptyMeta(), changed, T1)
    expect(dirtyIds(meta)).toEqual(['p1'])
    expect(pendingRows(after, meta)).toHaveLength(1)
    // simulate reconnect flush succeeding → dirty cleared
    meta = clearDirty(meta, ['p1'])
    expect(dirtyIds(meta)).toEqual([])
  })

  it('flushPending clears on success and keeps queued on failure', async () => {
    const rows = [row(emptyProfile('p1', 'Ada', '3'), T1)]
    expect(await flushPending(rows, async () => true)).toEqual(['p1']) // success → clear
    expect(await flushPending(rows, async () => false)).toEqual([]) // offline → keep
    expect(await flushPending(rows, async () => { throw new Error('net') })).toEqual([]) // never throws
    expect(await flushPending([], async () => true)).toEqual([]) // nothing pending
  })
})
