import { describe, expect, it } from 'vitest'
import type { AppState, Profile } from '../types'
import { emptyProfile, defaultAppState, isAppState } from '../migration'
import { serializeAllBackup } from '../appState'
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
  markViewed,
  mindsetBand,
  mindsetCompletionSummary,
  mindsetMissionItem,
  openableWeeks,
  saveJournalDraft,
  sanitizeStateForExport,
  serializeMyJournal,
  submitReflection,
  unlockedWeekCount,
  weekUnlockDate,
} from './mindset'

// 2026-07-20 is a Monday; 2026-07-24 is a Friday (see missions.test.ts anchors).
const START_MON = '2026-07-20'
const FRI_W1 = '2026-07-24'

const kid = (grade: Profile['grade'] = '6'): Profile => emptyProfile('p1', 'Test Kid', grade)

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
    expect(mindsetBand(kid('3'))).toBe('littles') // playful theme
    expect(mindsetBand(kid('4'))).toBe('littles')
    expect(mindsetBand(kid('6'))).toBe('core') // cool theme
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
    expect(firstFridayOnOrAfter('2026-07-24')).toBe('2026-07-24') // a Friday start unlocks same day
    expect(firstFridayOnOrAfter('2026-07-25')).toBe('2026-07-31') // a Saturday start rolls to next Friday
  })

  it('week N unlocks on the Nth consecutive Friday', () => {
    expect(weekUnlockDate(START_MON, 1)).toBe('2026-07-24')
    expect(weekUnlockDate(START_MON, 2)).toBe('2026-07-31')
    expect(weekUnlockDate(START_MON, 4)).toBe('2026-08-14')
    expect(weekUnlockDate(START_MON, 9)).toBe('2026-09-18')
  })

  it('counts unlocked weeks against today', () => {
    expect(unlockedWeekCount(START_MON, '2026-07-19')).toBe(0) // before start
    expect(unlockedWeekCount(START_MON, '2026-07-23')).toBe(0) // Thu before first Friday
    expect(unlockedWeekCount(START_MON, '2026-07-24')).toBe(1) // first Friday
    expect(unlockedWeekCount(START_MON, '2026-07-30')).toBe(1) // mid-week, still week 1
    expect(unlockedWeekCount(START_MON, '2026-07-31')).toBe(2) // second Friday
    expect(unlockedWeekCount(START_MON, '2026-09-18')).toBe(9) // ninth Friday
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
    // On the second Friday only weeks 1–2 are open.
    expect(isWeekUnlocked(START_MON, '2026-07-31', 2)).toBe(true)
    expect(isWeekUnlocked(START_MON, '2026-07-31', 3)).toBe(false)
    expect(isWeekUnlocked(START_MON, '2026-07-31', 9)).toBe(false)
    expect(openableWeeks(START_MON, '2026-07-31')).toEqual([1, 2])
  })

  it('getUnlockedLesson returns undefined for a locked week — even if state was hand-edited', () => {
    // Simulate a tampered store that pretends week 9 was started.
    const p: Profile = { ...kid(), mindset: { weeks: { 9: { viewed: true, reflected: true, completedAt: '2026-07-31' } } } }
    // Week 9 is NOT unlocked on the second Friday, so its content is not retrievable.
    expect(getUnlockedLesson(START_MON, '2026-07-31', 9)).toBeUndefined()
    // The gate ignores profile state entirely — it is a pure function of dates.
    expect(isWeekUnlocked(START_MON, '2026-07-31', 9)).toBe(false)
    // An unlocked week does resolve to its content.
    expect(getUnlockedLesson(START_MON, '2026-07-31', 2)?.week).toBe(2)
    void p
  })
})

// ---------- completion ----------

describe('completion = viewed + reflection submitted', () => {
  it('needs BOTH a view and a reflection', () => {
    let p = kid('6')
    p = markViewed(p, 1, FRI_W1)
    expect(isWeekComplete(p, 1)).toBe(false) // viewed but no reflection
    p = submitReflection(p, 1, 'core', 'I always rush my grips.', FRI_W1)
    expect(isWeekComplete(p, 1)).toBe(true)
    expect(getWeekState(p, 1).completedAt).toBe(FRI_W1)
  })

  it('littles must tap an emoji / word; an empty value does not count', () => {
    let p = markViewed(kid('3'), 1, FRI_W1)
    p = submitReflection(p, 1, 'littles', '   ', FRI_W1)
    expect(isWeekComplete(p, 1)).toBe(false)
    p = submitReflection(p, 1, 'littles', '🔥', FRI_W1)
    expect(isWeekComplete(p, 1)).toBe(true)
  })

  it('journal weeks complete on Done even with empty text — never force disclosure', () => {
    let p = markViewed(kid('12'), 1, FRI_W1)
    p = submitReflection(p, 1, 'teens', '', FRI_W1) // "just think it — tapping done is enough"
    expect(isWeekComplete(p, 1)).toBe(true)
    expect(getWeekState(p, 1).reflection).toBe('')
  })

  it('autosaving a draft persists text without completing', () => {
    let p = markViewed(kid('6'), 1, FRI_W1)
    p = saveJournalDraft(p, 1, 'half a thought…')
    expect(getWeekState(p, 1).reflection).toBe('half a thought…')
    expect(isWeekComplete(p, 1)).toBe(false) // draft is not a submission
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
    const done = submitReflection(markViewed(p, 1, FRI_W1), 1, 'core', 'ok', FRI_W1)
    expect(mindsetMissionItem(done, START_MON, FRI_W1).item.done).toBe(true)
  })
})

// ---------- PRIVACY (load-bearing) ----------

const SECRET = 'MY_TOUGHEST_LOSS_a7f3_dad_must_never_read_this'

function stateWithJournal(): { state: AppState; profileId: string } {
  const base = defaultAppState()
  let p = markViewed(base.profiles.p3, 1, FRI_W1) // p3 = the 6th grader
  p = submitReflection(p, 1, 'core', SECRET, FRI_W1)
  return { state: { ...base, profiles: { ...base.profiles, p3: p } }, profileId: 'p3' }
}

describe('PRIVACY — journal text never reaches the panel or the standard export', () => {
  it('the standard export-all strips reflection text but keeps completion', () => {
    const { state } = stateWithJournal()
    const json = serializeAllBackup(state)
    expect(json).not.toContain(SECRET) // no text leaves in Dad's backup
    expect(json).toContain('completedAt') // completion status is preserved
    expect(json).not.toContain('"reflection"') // the field itself is gone
    // …and the sanitized export is still a valid, importable app state.
    expect(isAppState(JSON.parse(json))).toBe(true)
  })

  it('sanitizeStateForExport removes reflection yet preserves the completion signals', () => {
    const { state } = stateWithJournal()
    const safe = sanitizeStateForExport(state)
    const ws = safe.profiles.p3.mindset!.weeks[1]
    expect(ws.reflection).toBeUndefined()
    expect(ws.completedAt).toBe(FRI_W1)
    expect(ws.viewed).toBe(true)
    expect(ws.reflected).toBe(true)
    // The original state is untouched (pure copy).
    expect(state.profiles.p3.mindset!.weeks[1].reflection).toBe(SECRET)
  })

  it('the Grown-Ups completion summary carries only booleans — no text, no excerpts, no word counts', () => {
    const { state } = stateWithJournal()
    const summary = mindsetCompletionSummary(state.profiles.p3)
    const asJson = JSON.stringify(summary)
    expect(asJson).not.toContain(SECRET)
    expect(summary).toHaveLength(9)
    expect(summary[0]).toEqual({ week: 1, title: 'Your Brain Trains Like a Muscle', completed: true })
    expect(summary[1].completed).toBe(false)
    // Shape has no text-bearing keys.
    for (const row of summary) {
      expect(Object.keys(row).sort()).toEqual(['completed', 'title', 'week'])
    }
  })

  it('positive control: the girl\'s own "export MY journal" DOES include her text', () => {
    const { state } = stateWithJournal()
    const mine = serializeMyJournal(state.profiles.p3)
    expect(mine).toContain(SECRET) // her private export is the one place text appears
    expect(mine).toContain('mindset-journal')
  })
})
