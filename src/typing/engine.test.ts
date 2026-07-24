import { describe, expect, it } from 'vitest'
import {
  applyDrillResult,
  buildDrillText,
  computeAccuracy,
  computeWpm,
  defaultTypingState,
  gradeWpmTarget,
  isMastered,
  ladderComplete,
  unlockedLessons,
  type DrillResult,
} from './engine'
import { LESSONS } from './lessons'

const TODAY = '2026-07-23'

// A drill result that yields a given accuracy on a given lesson.
function drill(lessonId: string, correct: number, typed: number, elapsedMs = 60000): DrillResult {
  return { lessonId, correctChars: correct, typedChars: typed, elapsedMs }
}

describe('WPM calculation', () => {
  it('counts one word per 5 correct chars over elapsed minutes', () => {
    expect(computeWpm(25, 60000)).toBe(5) // 25/5 chars in 1 min
    expect(computeWpm(200, 60000)).toBe(40)
    expect(computeWpm(100, 120000)).toBe(10) // 20 words in 2 min
  })
  it('ignores mistyped chars (only correct chars count toward speed)', () => {
    // correctChars is already the correct-only count; a 150-char/min correct rate:
    expect(computeWpm(150, 60000)).toBe(30)
  })
  it('guards zero/negative elapsed and zero chars', () => {
    expect(computeWpm(50, 0)).toBe(0)
    expect(computeWpm(50, -10)).toBe(0)
    expect(computeWpm(0, 60000)).toBe(0)
  })
})

describe('accuracy calculation', () => {
  it('is the whole-percent of typed chars that were correct', () => {
    expect(computeAccuracy(90, 100)).toBe(90)
    expect(computeAccuracy(45, 50)).toBe(90)
    expect(computeAccuracy(99, 100)).toBe(99)
    expect(computeAccuracy(100, 100)).toBe(100)
  })
  it('shows a friendly 100 before anything is typed', () => {
    expect(computeAccuracy(0, 0)).toBe(100)
  })
  it('clamps correct to typed (never above 100%)', () => {
    expect(computeAccuracy(120, 100)).toBe(100)
  })
})

describe('grade speed targets (pacing guidance only)', () => {
  it('scales by grade', () => {
    expect(gradeWpmTarget('3')).toBe(15)
    expect(gradeWpmTarget('4')).toBe(20)
    expect(gradeWpmTarget('6')).toBe(30)
  })
  it('falls back for non-trainer grades', () => {
    expect(gradeWpmTarget('10')).toBe(20)
    expect(gradeWpmTarget('12')).toBe(20)
  })
})

describe('mastery gate', () => {
  it('requires 90% accuracy', () => {
    expect(isMastered(89)).toBe(false)
    expect(isMastered(90)).toBe(true)
    expect(isMastered(100)).toBe(true)
  })
})

describe('ladder advancement (accuracy gates, speed never does)', () => {
  const l0 = LESSONS[0].id
  const l1 = LESSONS[1].id

  it('a 90%+ drill on the frontier lesson unlocks the next and latches passed', () => {
    const s0 = defaultTypingState()
    const s1 = applyDrillResult(s0, drill(l0, 90, 100), TODAY)
    expect(s1.unlockedIndex).toBe(1)
    expect(s1.lessons[l0].passed).toBe(true)
    expect(s1.lessons[l0].bestAccuracy).toBe(90)
    expect(s1.drillsCompleted).toBe(1)
    expect(unlockedLessons(s1)).toHaveLength(2)
  })

  it('a sub-90% drill records best stats but does NOT advance or pass', () => {
    const s0 = defaultTypingState()
    const s1 = applyDrillResult(s0, drill(l0, 89, 100), TODAY)
    expect(s1.unlockedIndex).toBe(0)
    expect(s1.lessons[l0].passed).toBe(false)
    expect(s1.lessons[l0].bestAccuracy).toBe(89)
    expect(unlockedLessons(s1)).toHaveLength(1)
  })

  it('a slow but accurate drill still advances (speed is not a gate)', () => {
    const s0 = defaultTypingState()
    // painfully slow: 10 correct chars over 5 minutes → 0 wpm, but 100% accuracy
    const s1 = applyDrillResult(s0, drill(l0, 10, 10, 300000), TODAY)
    expect(computeWpm(10, 300000)).toBe(0) // speed floor — yet it must still advance
    expect(s1.unlockedIndex).toBe(1)
    expect(s1.lessons[l0].passed).toBe(true)
  })

  it('mastering a lesson below the frontier does not push the frontier forward', () => {
    let s = defaultTypingState()
    s = applyDrillResult(s, drill(l0, 95, 100), TODAY) // unlockedIndex -> 1
    const before = s.unlockedIndex
    s = applyDrillResult(s, drill(l0, 100, 100), TODAY) // re-master lesson 0
    expect(s.unlockedIndex).toBe(before) // frontier only moves on the current top lesson
  })

  it('best stats only ever improve', () => {
    let s = defaultTypingState()
    s = applyDrillResult(s, drill(l0, 95, 100, 60000), TODAY) // acc 95, fast
    s = applyDrillResult(s, drill(l0, 60, 100, 600000), TODAY) // worse acc + slower
    expect(s.lessons[l0].bestAccuracy).toBe(95)
    expect(s.lessons[l0].bestWpm).toBeGreaterThanOrEqual(computeWpm(95, 60000))
    expect(s.lessons[l0].passed).toBe(true) // stays passed
  })

  it('counts every finished drill', () => {
    let s = defaultTypingState()
    s = applyDrillResult(s, drill(l0, 50, 100), TODAY)
    s = applyDrillResult(s, drill(l0, 60, 100), TODAY)
    expect(s.drillsCompleted).toBe(2)
  })

  it('ignores an unknown lesson id (state untouched)', () => {
    const s0 = defaultTypingState()
    const s1 = applyDrillResult(s0, drill('no-such-lesson', 100, 100), TODAY)
    expect(s1).toEqual(s0)
  })

  it('never advances past the last lesson', () => {
    let s = defaultTypingState()
    // master every lesson in order
    for (const lesson of LESSONS) {
      s = applyDrillResult(s, drill(lesson.id, 100, 100), TODAY)
    }
    expect(s.unlockedIndex).toBe(LESSONS.length - 1)
    expect(ladderComplete(s)).toBe(true)
  })
})

describe('drill text generation (neutral banks only)', () => {
  it('builds a non-empty string from the lesson bank', () => {
    for (const lesson of LESSONS) {
      const text = buildDrillText(lesson, 120, () => 0) // deterministic: always first token
      expect(text.length).toBeGreaterThan(0)
      // with a fixed picker it repeats the first bank token
      expect(text.startsWith(lesson.bank[0])).toBe(true)
    }
  })
  it('reaches roughly the requested length', () => {
    const text = buildDrillText(LESSONS[0], 200, () => 0)
    expect(text.length).toBeGreaterThanOrEqual(120)
  })
})
