import { describe, it, expect } from 'vitest'
import type { Profile, ReadingState } from '../types'
import {
  addCalibration,
  benchmarkFor,
  conqueredWords,
  defaultReadingState,
  estimateWcpm,
  getReadingState,
  manualSession,
  needsCalibration,
  practiceWordFrequency,
  readingStreak,
  recordReadingSession,
  selectPassage,
  sessionFromAlignment,
  wcpmTrend,
} from './fluency'
import { alignReading } from './align'
import { passagesForGrade } from './passages'

function baseProfile(): Profile {
  return {
    id: 'p1',
    name: 'Kid',
    grade: '3',
    pin: '',
    theme: 'playful',
    skills: {},
    missions: {},
    streaks: { current: 0, best: 0, lastActiveDate: '' },
    createdAt: '2026-01-01T00:00:00.000Z',
    placementDone: false,
    totals: { questionsAnswered: 0, correct: 0, bestStreak: 0, sessions: 0 },
  }
}

describe('estimateWcpm', () => {
  it('is correct-words over minutes, rounded', () => {
    expect(estimateWcpm(60, 60)).toBe(60)
    expect(estimateWcpm(45, 30)).toBe(90)
    expect(estimateWcpm(0, 60)).toBe(0)
    expect(estimateWcpm(50, 0)).toBe(0)
  })
})

describe('recordReadingSession (functional fold)', () => {
  it('appends the session and tracks the passage as seen without mutating prev', () => {
    const p = baseProfile()
    const log = manualSession('2026-02-02', 'g3-01', 70, 60)
    const next = recordReadingSession(p, log)
    expect(p.reading).toBeUndefined() // prev untouched
    expect(next.reading!.sessions).toHaveLength(1)
    expect(next.reading!.seenPassageIds).toEqual(['g3-01'])
    expect(next.reading!.lastReadDate).toBe('2026-02-02')
  })

  it('builds an estimated session from an alignment result', () => {
    const passage = passagesForGrade('3')[0]
    const align = alignReading(passage.text, passage.text) // perfect read
    const log = sessionFromAlignment('2026-02-02', passage.id, align, 60)
    expect(log.mode).toBe('estimated')
    expect(log.wcpm).toBe(passage.wordCount) // all correct in 1 min
    expect(log.wordsPracticed).toEqual([])
  })
})

describe('selectPassage (spacing / no-repeat)', () => {
  it('never repeats a passage until the whole grade pool has cycled', () => {
    let state: ReadingState = defaultReadingState()
    const served: string[] = []
    const poolSize = passagesForGrade('3').length
    for (let i = 0; i < poolSize; i++) {
      const p = selectPassage(state, '3')!
      served.push(p.id)
      state = { ...state, seenPassageIds: [...state.seenPassageIds, p.id] }
    }
    expect(new Set(served).size).toBe(poolSize) // all distinct → no repeat in the window
  })

  it('fluency-check prefers a fresh unseen passage', () => {
    const pool = passagesForGrade('3')
    // mark all but the last as seen
    const seen = pool.slice(0, pool.length - 1).map((p) => p.id)
    const state: ReadingState = { ...defaultReadingState(), seenPassageIds: seen }
    const chosen = selectPassage(state, '3', { fluencyCheck: true })!
    expect(chosen.id).toBe(pool[pool.length - 1].id)
  })
})

describe('readingStreak', () => {
  it('counts consecutive reading days ending at the latest', () => {
    const state: ReadingState = {
      ...defaultReadingState(),
      sessions: [
        manualSession('2026-02-01', 'g3-01', 60, 60),
        manualSession('2026-02-02', 'g3-02', 60, 60),
        manualSession('2026-02-03', 'g3-03', 60, 60),
      ],
    }
    expect(readingStreak(state)).toBe(3)
  })
  it('breaks on a gap', () => {
    const state: ReadingState = {
      ...defaultReadingState(),
      sessions: [
        manualSession('2026-02-01', 'g3-01', 60, 60),
        manualSession('2026-02-03', 'g3-02', 60, 60), // gap on the 2nd
      ],
    }
    expect(readingStreak(state)).toBe(1)
  })
})

describe('practice words & conquered', () => {
  const state: ReadingState = {
    ...defaultReadingState(),
    sessions: [
      { date: '2026-02-01', passageId: 'g3-01', mode: 'estimated', wcpm: 70, wordsPracticed: ['fox', 'den'], durationSec: 60 },
      { date: '2026-02-02', passageId: 'g3-02', mode: 'estimated', wcpm: 72, wordsPracticed: ['fox', 'oak'], durationSec: 60 },
      { date: '2026-02-03', passageId: 'g3-03', mode: 'estimated', wcpm: 80, wordsPracticed: ['oak'], durationSec: 60 },
    ],
  }
  it('frequency counts across sessions, most-frequent first', () => {
    const freq = practiceWordFrequency(state)
    expect(freq[0]).toEqual({ word: 'fox', count: 2 })
    expect(freq.find((f) => f.word === 'oak')?.count).toBe(2)
    expect(freq.find((f) => f.word === 'den')?.count).toBe(1)
  })
  it('conquered = practiced earlier but not in the latest session', () => {
    // latest session practiced only "oak"; fox & den were flagged before and not now.
    expect(conqueredWords(state).sort()).toEqual(['den', 'fox'])
  })
})

describe('calibration reminder', () => {
  it('due after 2 weeks or when never calibrated (with reading history)', () => {
    let p = baseProfile()
    p = recordReadingSession(p, manualSession('2026-02-01', 'g3-01', 60, 60))
    expect(needsCalibration(getReadingState(p), '2026-02-01')).toBe(true) // never calibrated
    p = addCalibration(p, { date: '2026-02-01', wcpm: 75 })
    expect(needsCalibration(getReadingState(p), '2026-02-10')).toBe(false) // 9 days
    expect(needsCalibration(getReadingState(p), '2026-02-15')).toBe(true) // 14 days
  })
  it('never nags a profile that has not read yet', () => {
    expect(needsCalibration(defaultReadingState(), '2026-02-15')).toBe(false)
  })
})

describe('benchmarks', () => {
  it('rise by grade and put year-end above entering', () => {
    for (const g of ['3', '4', '6'] as const) {
      const b = benchmarkFor(g)
      expect(b.yearEnd).toBeGreaterThan(b.entering)
    }
    expect(benchmarkFor('6').entering).toBeGreaterThan(benchmarkFor('3').entering)
  })
})

describe('wcpmTrend', () => {
  it('flags estimated vs ground-truth points', () => {
    const state: ReadingState = {
      ...defaultReadingState(),
      sessions: [
        manualSession('2026-02-01', 'g3-01', 60, 60),
        { date: '2026-02-02', passageId: 'g3-02', mode: 'estimated', wcpm: 70, wordsPracticed: [], durationSec: 60 },
      ],
    }
    const trend = wcpmTrend(state)
    expect(trend[0].estimated).toBe(false) // manual = ground truth
    expect(trend[1].estimated).toBe(true)
  })
})
