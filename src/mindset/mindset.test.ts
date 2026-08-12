import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AppState, Profile } from '../types'
import { emptyProfile, defaultAppState, isAppState } from '../migration'
import { serializeAllBackup } from '../appState'
import { toWireProfile } from '../portableProfile'
import {
  applyReviewedSelection,
  buildReconciliationPreview,
  markDirty,
  pendingRows,
} from '../sync/engine'
import { emptyHouseholdMeta } from '../sync/types'
import { MINDSET_TOTAL_WEEKS, MINDSET_WEEKS } from './content'
import {
  bandReadAloud,
  bandUsesJournal,
  currentWeek,
  firstFridayOnOrAfter,
  getUnlockedLesson,
  getWeekState,
  isWeekComplete,
  isWeekUnlocked,
  markReflected,
  markViewed,
  mindsetBand,
  mindsetCompletionSummary,
  mindsetMissionItem,
  openableWeeks,
  unlockedWeekCount,
  weekUnlockDate,
} from './mindset'
import { clearJournal, getJournalText, serializeMyJournal, setJournalText } from './journalStore'

// 2026-07-20 is a Monday; 2026-07-24 is a Friday (see missions.test.ts anchors).
const START_MON = '2026-07-20'
const FRI_W1 = '2026-07-24'

const kid = (grade: Profile['grade'] = '6'): Profile => emptyProfile('p1', 'Test Kid', grade)

// The journal store lives in its own localStorage slot (like the voice key). Node has no
// localStorage, so install the same MemStorage shim the voice/config tests use.
class MemStorage {
  private m = new Map<string, string>()
  get length() { return this.m.size }
  clear() { this.m.clear() }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null }
  key(i: number) { return [...this.m.keys()][i] ?? null }
  removeItem(k: string) { this.m.delete(k) }
  setItem(k: string, v: string) { this.m.set(k, String(v)) }
}
beforeEach(() => {
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = new MemStorage() as unknown as Storage
})
afterEach(() => {
  delete (globalThis as unknown as { localStorage?: Storage }).localStorage
})

// ---------- content bank ----------

describe('MM content bank', () => {
  it('holds exactly 9 weeks (Q1), verified two ways', () => {
    expect(MINDSET_WEEKS).toHaveLength(9)
    expect(MINDSET_TOTAL_WEEKS).toBe(9)
  })

  it('numbers weeks 1..9 with no gaps', () => {
    expect(MINDSET_WEEKS.map((w) => w.week)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('every week carries core, littles, teensExtra, a habit and both reflection bands', () => {
    for (const w of MINDSET_WEEKS) {
      expect(w.core.trim().length).toBeGreaterThan(0)
      expect(w.littles.trim().length).toBeGreaterThan(0)
      expect(w.teensExtra && w.teensExtra.trim().length).toBeGreaterThan(0)
      expect(w.habit.trim().length).toBeGreaterThan(0)
      expect(['emoji', 'oneword']).toContain(w.reflectLittles.kind)
      expect(w.reflectLittles.prompt.trim().length).toBeGreaterThan(0)
      expect(w.reflect.length).toBeGreaterThanOrEqual(1)
      expect(w.reflect[0].trim().length).toBeGreaterThan(0)
    }
  })

  it('matches the source file verbatim on spot-checks', () => {
    expect(MINDSET_WEEKS[0].title).toBe('Your Brain Trains Like a Muscle')
    expect(MINDSET_WEEKS[0].core).toContain('The word *yet* is the most honest word in sports.')
    expect(MINDSET_WEEKS[3].title).toBe('The Two Lists')
    expect(MINDSET_WEEKS[8].title).toBe('Your Process Goals')
    expect(MINDSET_WEEKS[8].reflectLittles.prompt).toBe(`What's your doing-goal for this season?`)
  })
})

// ---------- band ----------

describe('mindset band', () => {
  it('maps grades/themes to the right variant', () => {
    expect(mindsetBand(kid('3'))).toBe('littles')
    expect(mindsetBand(kid('4'))).toBe('littles')
    expect(mindsetBand(kid('6'))).toBe('core')
    expect(mindsetBand(kid('10'))).toBe('teens')
    expect(mindsetBand(kid('12'))).toBe('teens')
  })

  it('littles get read-aloud + emoji/word; others journal', () => {
    expect(bandReadAloud('littles')).toBe(true)
    expect(bandReadAloud('core')).toBe(false)
    expect(bandUsesJournal('littles')).toBe(false)
    expect(bandUsesJournal('core')).toBe(true)
    expect(bandUsesJournal('teens')).toBe(true)
  })
})

// ---------- weekly unlock math ----------

describe('weekly unlock math', () => {
  it('week 1 unlocks on the first Friday on/after the start date', () => {
    expect(firstFridayOnOrAfter(START_MON)).toBe(FRI_W1)
    expect(firstFridayOnOrAfter('2026-07-24')).toBe('2026-07-24')
    expect(firstFridayOnOrAfter('2026-07-25')).toBe('2026-07-31')
  })

  it('week N unlocks on the Nth consecutive Friday', () => {
    expect(weekUnlockDate(START_MON, 1)).toBe('2026-07-24')
    expect(weekUnlockDate(START_MON, 2)).toBe('2026-07-31')
    expect(weekUnlockDate(START_MON, 4)).toBe('2026-08-14')
    expect(weekUnlockDate(START_MON, 9)).toBe('2026-09-18')
  })

  it('counts unlocked weeks against today', () => {
    expect(unlockedWeekCount(START_MON, '2026-07-19')).toBe(0)
    expect(unlockedWeekCount(START_MON, '2026-07-23')).toBe(0)
    expect(unlockedWeekCount(START_MON, '2026-07-24')).toBe(1)
    expect(unlockedWeekCount(START_MON, '2026-07-30')).toBe(1)
    expect(unlockedWeekCount(START_MON, '2026-07-31')).toBe(2)
    expect(unlockedWeekCount(START_MON, '2026-09-18')).toBe(9)
  })

  it('caps at the loaded curriculum — no binging past what exists', () => {
    expect(unlockedWeekCount(START_MON, '2026-10-01')).toBe(9)
    expect(unlockedWeekCount(START_MON, '2027-01-01')).toBe(9)
  })

  it('is fully locked with no start date set', () => {
    expect(unlockedWeekCount(undefined, '2026-09-18')).toBe(0)
    expect(currentWeek(undefined, '2026-09-18')).toBe(0)
    expect(openableWeeks(undefined, '2026-09-18')).toEqual([])
  })
})

// ---------- locked-week inaccessibility ----------

describe('locked weeks are inaccessible', () => {
  it('isWeekUnlocked gates future weeks', () => {
    expect(isWeekUnlocked(START_MON, '2026-07-31', 2)).toBe(true)
    expect(isWeekUnlocked(START_MON, '2026-07-31', 3)).toBe(false)
    expect(isWeekUnlocked(START_MON, '2026-07-31', 9)).toBe(false)
    expect(openableWeeks(START_MON, '2026-07-31')).toEqual([1, 2])
  })

  it('getUnlockedLesson returns undefined for a locked week — even if state was hand-edited', () => {
    const p: Profile = { ...kid(), mindset: { weeks: { 9: { viewed: true, reflected: true, completedAt: '2026-07-31' } } } }
    expect(getUnlockedLesson(START_MON, '2026-07-31', 9)).toBeUndefined()
    expect(isWeekUnlocked(START_MON, '2026-07-31', 9)).toBe(false)
    expect(getUnlockedLesson(START_MON, '2026-07-31', 2)?.week).toBe(2)
    void p
  })
})

// ---------- completion (signal in profile, text in the local store) ----------

describe('completion = viewed + reflection submitted', () => {
  it('needs BOTH a view and a reflection; the TEXT lives in the store, not the profile', () => {
    let p = kid('6')
    p = markViewed(p, 1, FRI_W1)
    expect(isWeekComplete(p, 1)).toBe(false)
    setJournalText(p.id, 1, 'I always rush my grips.') // component writes her words to the store
    p = markReflected(p, 1, FRI_W1) // profile records only the completion signal
    expect(isWeekComplete(p, 1)).toBe(true)
    expect(getWeekState(p, 1).completedAt).toBe(FRI_W1)
    // text is retrievable from the store, and is NOT anywhere in the profile object
    expect(getJournalText(p.id, 1)).toBe('I always rush my grips.')
    expect(JSON.stringify(p)).not.toContain('rush my grips')
  })

  it('littles complete once an emoji/word is stored', () => {
    let p = markViewed(kid('3'), 1, FRI_W1)
    setJournalText(p.id, 1, '🔥')
    p = markReflected(p, 1, FRI_W1)
    expect(isWeekComplete(p, 1)).toBe(true)
    expect(getJournalText(p.id, 1)).toBe('🔥')
  })

  it('journal weeks complete on Done even with empty text — never force disclosure', () => {
    let p = markViewed(kid('12'), 1, FRI_W1)
    p = markReflected(p, 1, FRI_W1) // "just think it — tapping done is enough"
    expect(isWeekComplete(p, 1)).toBe(true)
    expect(getJournalText(p.id, 1)).toBe('')
  })

  it('autosaving a draft persists to the store without completing', () => {
    const p = markViewed(kid('6'), 1, FRI_W1)
    setJournalText(p.id, 1, 'half a thought…')
    expect(getJournalText(p.id, 1)).toBe('half a thought…')
    expect(isWeekComplete(p, 1)).toBe(false)
  })

  it('clearJournal wipes a girl\'s entries (used by Reset progress)', () => {
    setJournalText('p1', 1, 'secret')
    setJournalText('p1', 2, 'more')
    clearJournal('p1')
    expect(getJournalText('p1', 1)).toBe('')
    expect(getJournalText('p1', 2)).toBe('')
  })
})

// ---------- mission item seam ----------

describe('mission item seam (auto-check wiring deferred to Session C)', () => {
  it('is absent until a week unlocks, then mirrors completion', () => {
    const p = kid('6')
    expect(mindsetMissionItem(p, START_MON, '2026-07-19').present).toBe(false)
    const before = mindsetMissionItem(p, START_MON, FRI_W1)
    expect(before.present).toBe(true)
    expect(before.item.id).toBe('mindset-lesson')
    expect(before.item.done).toBe(false)
    const done = markReflected(markViewed(p, 1, FRI_W1), 1, FRI_W1)
    expect(mindsetMissionItem(done, START_MON, FRI_W1).item.done).toBe(true)
  })
})

// ---------- PRIVACY (load-bearing, now STRUCTURAL) ----------

const SECRET = 'MY_TOUGHEST_LOSS_a7f3_dad_must_never_read_this'

/** p3 (6th grader): completion signals in the profile, reflection text in the local store. */
function stateWithJournal(): AppState {
  const base = defaultAppState()
  let p = markViewed(base.profiles.p3, 1, FRI_W1)
  p = markReflected(p, 1, FRI_W1)
  setJournalText('p3', 1, SECRET)
  return { ...base, profiles: { ...base.profiles, p3: p } }
}

describe('PRIVACY — reflection text is never in AppState (panel / export / sync)', () => {
  it('the standard export-all contains zero reflection text but keeps completion', () => {
    const json = serializeAllBackup(stateWithJournal())
    expect(json).not.toContain(SECRET)
    expect(json).toContain('completedAt')
    expect(isAppState(JSON.parse(json))).toBe(true)
  })

  it('the sync push payload contains zero reflection text but keeps completion', () => {
    const state = stateWithJournal()
    // Household-scoped dirty-queue payload.
    const dirtyRows = pendingRows(
      state.profiles,
      markDirty(emptyHouseholdMeta('household-a'), ['p3'], 1000),
    )
    const dirtyJson = JSON.stringify(dirtyRows)
    expect(dirtyRows).toHaveLength(1)
    expect(dirtyJson).not.toContain(SECRET)
    expect(dirtyJson).toContain('completedAt') // completion syncs
  })

  it('an explicitly reviewed cloud choice cannot clobber local journal text', () => {
    const state = stateWithJournal() // local p3: week-1 complete + local text = SECRET
    const localMeta = markDirty(emptyHouseholdMeta('household-a'), ['p3'], 1000)
    // A remote row from another device carries completion only, never any text.
    const remoteProfile: Profile = {
      ...state.profiles.p3,
      mindset: {
        weeks: {
          1: { viewed: true, reflected: true, completedAt: FRI_W1 },
          2: { viewed: true, reflected: true, completedAt: '2026-07-31' },
        },
      },
    }
    const remoteRow = { profile_id: 'p3', data: toWireProfile(remoteProfile), updated_at: new Date(5000).toISOString() }
    const preview = buildReconciliationPreview(state.profiles, [remoteRow], localMeta)
    const res = applyReviewedSelection(
      state.profiles,
      [remoteRow],
      preview,
      { p3: 'cloud' },
      6000,
    )
    // Dad explicitly selected the cloud profile, so its week-2 completion is adopted…
    expect(res.profiles.p3.mindset!.weeks[2].completedAt).toBe('2026-07-31')
    // …yet her local journal text is untouched — reconciliation only touches profiles.
    expect(getJournalText('p3', 1)).toBe(SECRET)
    // and nothing in the merged/pushed profile carries her text.
    expect(JSON.stringify(res.profiles.p3)).not.toContain(SECRET)
    expect(JSON.stringify(res.toPush)).not.toContain(SECRET)
  })

  it('the Grown-Ups completion summary carries only booleans — no text, no counts', () => {
    const state = stateWithJournal()
    const summary = mindsetCompletionSummary(state.profiles.p3)
    expect(JSON.stringify(summary)).not.toContain(SECRET)
    expect(summary).toHaveLength(9)
    expect(summary[0]).toEqual({ week: 1, title: 'Your Brain Trains Like a Muscle', completed: true })
    expect(summary[1].completed).toBe(false)
    for (const row of summary) {
      expect(Object.keys(row).sort()).toEqual(['completed', 'title', 'week'])
    }
  })

  it('positive control: the girl\'s own "export MY journal" reads the store and DOES include her text', () => {
    const state = stateWithJournal()
    const mine = serializeMyJournal(state.profiles.p3)
    expect(mine).toContain(SECRET)
    expect(mine).toContain('mindset-journal')
  })
})
