import type {
  Assignment,
  AssessmentState,
  Attempt,
  AutoScore,
  FixedTest,
  Item,
  ScoreVerdict,
} from './types'
import { emptyAssessmentState } from './types'
import { allItems } from './banks'
import { scoreItem } from './normalizer'

export function getState(a: AssessmentState | undefined): AssessmentState {
  if (!a) return emptyAssessmentState()
  return {
    assigned: a.assigned ?? [],
    attempts: a.attempts ?? [],
    retakeUnlocked: a.retakeUnlocked ?? [],
  }
}

// ---------- assignment (Dad) ----------

export function assignTest(state: AssessmentState, testId: string, startCode: string, nowISO: string): AssessmentState {
  const s = getState(state)
  const assigned: Assignment[] = [
    ...s.assigned.filter((x) => x.testId !== testId),
    { testId, startCode, assignedAt: nowISO },
  ]
  return { ...s, assigned }
}

export function unassignTest(state: AssessmentState, testId: string): AssessmentState {
  const s = getState(state)
  return { ...s, assigned: s.assigned.filter((x) => x.testId !== testId) }
}

export function findAssignment(state: AssessmentState, testId: string): Assignment | undefined {
  return getState(state).assigned.find((x) => x.testId === testId)
}

// ---------- attempt lookup ----------

export function completedAttempt(state: AssessmentState, testId: string): Attempt | undefined {
  return getState(state).attempts.find((a) => a.testId === testId && a.finishedAt)
}

export function inProgressAttempt(state: AssessmentState, testId: string): Attempt | undefined {
  return getState(state).attempts.find((a) => a.testId === testId && !a.finishedAt)
}

export type StartStatus = 'not-started' | 'in-progress' | 'completed-locked' | 'retake-ready'

export function startStatus(state: AssessmentState, testId: string): StartStatus {
  const s = getState(state)
  if (inProgressAttempt(s, testId)) return 'in-progress'
  if (completedAttempt(s, testId)) {
    return (s.retakeUnlocked ?? []).includes(testId) ? 'retake-ready' : 'completed-locked'
  }
  return 'not-started'
}

// ---------- start / resume ----------

/**
 * Begin (or resume) an attempt. A completed test only starts again when Dad has
 * unlocked a retake; that unlock is consumed here and the retake is stored as a
 * NEW, separate attempt (prior attempts are never overwritten).
 */
export function startAttempt(
  state: AssessmentState,
  testId: string,
  profileId: string,
  nowISO: string,
): { state: AssessmentState; attempt: Attempt } {
  const s = getState(state)
  const existing = inProgressAttempt(s, testId)
  if (existing) return { state: s, attempt: existing }

  const done = completedAttempt(s, testId)
  const unlocked = (s.retakeUnlocked ?? []).includes(testId)
  if (done && !unlocked) {
    // locked — return unchanged; caller should have gated on startStatus
    return { state: s, attempt: done }
  }

  const attempt: Attempt = {
    testId,
    profileId,
    startedAt: nowISO,
    answers: {},
  }
  return {
    state: {
      ...s,
      attempts: [...s.attempts, attempt],
      retakeUnlocked: (s.retakeUnlocked ?? []).filter((id) => id !== testId), // consume unlock
    },
    attempt,
  }
}

/** Persist an answer into the in-progress attempt. Accumulates time-on-item. */
export function recordAnswer(
  state: AssessmentState,
  testId: string,
  itemId: string,
  value: string,
  skipped: boolean,
  addMs: number,
): AssessmentState {
  const s = getState(state)
  const attempts = s.attempts.map((a) => {
    if (a.testId !== testId || a.finishedAt) return a
    const prev = a.answers[itemId]
    return {
      ...a,
      answers: {
        ...a.answers,
        [itemId]: {
          value,
          skipped,
          msOnItem: (prev?.msOnItem ?? 0) + Math.max(0, addMs),
        },
      },
    }
  })
  return { ...s, attempts }
}

// ---------- scoring ----------

export interface ItemGrade {
  item: Item
  sectionName: string
  value: string
  skipped: boolean
  msOnItem: number
  verdict: ScoreVerdict
}

/** Grade every item of an attempt (used by the results screen and autoScore). */
export function gradeAttempt(test: FixedTest, attempt: Attempt): ItemGrade[] {
  const grades: ItemGrade[] = []
  for (const section of test.sections) {
    for (const item of section.items) {
      const ans = attempt.answers[item.id]
      const value = ans?.value ?? ''
      const skipped = ans ? ans.skipped : true // never-reached items count as skips
      grades.push({
        item,
        sectionName: section.name,
        value,
        skipped,
        msOnItem: ans?.msOnItem ?? 0,
        verdict: scoreItem(item, value, skipped),
      })
    }
  }
  return grades
}

export function computeAutoScore(test: FixedTest, attempt: Attempt): AutoScore {
  const bySection: Record<string, { correct: number; of: number }> = {}
  let gradedItems = 0
  let skips = 0
  for (const section of test.sections) bySection[section.name] = { correct: 0, of: 0 }

  for (const g of gradeAttempt(test, attempt)) {
    const bucket = bySection[g.sectionName]
    switch (g.verdict) {
      case 'correct':
        bucket.correct++
        bucket.of++
        break
      case 'incorrect':
        bucket.of++
        break
      case 'unmatched':
      case 'ungraded':
        gradedItems++
        break
      case 'skip':
        skips++
        break
    }
  }
  return { bySection, gradedItems, skips }
}

export function finishAttempt(
  state: AssessmentState,
  test: FixedTest,
  nowISO: string,
): AssessmentState {
  const s = getState(state)
  const attempts = s.attempts.map((a) => {
    if (a.testId !== test.id || a.finishedAt) return a
    return { ...a, finishedAt: nowISO, autoScore: computeAutoScore(test, a) }
  })
  return { ...s, attempts }
}

// ---------- retake (Dad) ----------

export function unlockRetake(state: AssessmentState, testId: string): AssessmentState {
  const s = getState(state)
  const set = new Set(s.retakeUnlocked ?? [])
  set.add(testId)
  return { ...s, retakeUnlocked: [...set] }
}

// ---------- misc ----------

export function attemptProgress(test: FixedTest, attempt: Attempt): { answered: number; total: number } {
  const items = allItems(test)
  const answered = items.filter((i) => {
    const a = attempt.answers[i.id]
    return a && (a.skipped || a.value.trim() !== '')
  }).length
  return { answered, total: items.length }
}
