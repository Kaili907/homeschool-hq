import type {
  Assignment,
  AssessmentState,
  Attempt,
  AutoScore,
  FixedTest,
  Item,
  ItemAnswer,
  ResponseDisposition,
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
  /** true ONLY when the child pressed SKIP. Never inferred from a missing record. */
  skipped: boolean
  msOnItem: number
  disposition: ResponseDisposition
}

/**
 * What one item's stored record supports — and nothing more.
 *
 * A missing record is not a decision the child made, so it is never a skip. On a
 * FINISHED attempt it means the item was seen and left alone: the player advances
 * one item at a time and only offers Finish on the last one, so reaching the end
 * means every item was in front of her (see TestPlayer.evidence.test.tsx, which
 * pins that invariant). On an unfinished attempt there is genuinely no evidence.
 */
function dispositionOf(item: Item, ans: ItemAnswer | undefined, finished: boolean): ResponseDisposition {
  if (!ans) return finished ? 'no-response' : 'not-reached'
  if (ans.skipped) return 'deliberate-skip'
  // A stored blank is the same event as an absent record: the item was in front
  // of her and nothing came back. There is no response to hand a human, so this
  // must not fall through to the scorer, which answers 'unmatched' for a blank.
  if (ans.value.trim() === '') return 'no-response'
  const verdict: ScoreVerdict = scoreItem(item, ans.value, false)
  // scoreItem only answers 'skip' when told the item was skipped, which it was not.
  return verdict === 'skip' ? 'deliberate-skip' : verdict
}

/** Grade every item of an attempt (used by the results screen and autoScore). */
export function gradeAttempt(test: FixedTest, attempt: Attempt): ItemGrade[] {
  const finished = !!attempt.finishedAt
  const grades: ItemGrade[] = []
  for (const section of test.sections) {
    for (const item of section.items) {
      const ans = attempt.answers[item.id]
      grades.push({
        item,
        sectionName: section.name,
        value: ans?.value ?? '',
        skipped: ans?.skipped === true,
        msOnItem: ans?.msOnItem ?? 0,
        disposition: dispositionOf(item, ans, finished),
      })
    }
  }
  return grades
}

export function computeAutoScore(test: FixedTest, attempt: Attempt): AutoScore {
  const bySection: Record<string, { correct: number; of: number }> = {}
  let gradedItems = 0
  let skips = 0
  let noResponse = 0
  for (const section of test.sections) bySection[section.name] = { correct: 0, of: 0 }

  for (const g of gradeAttempt(test, attempt)) {
    const bucket = bySection[g.sectionName]
    switch (g.disposition) {
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
      case 'deliberate-skip':
        skips++
        break
      case 'no-response':
        noResponse++
        break
      case 'not-reached':
        // Counted nowhere. An unfinished attempt holds no evidence about an item
        // the child never saw, and putting it in a tally would manufacture some.
        break
    }
  }
  return { bySection, gradedItems, skips, noResponse }
}

export function finishAttempt(
  state: AssessmentState,
  test: FixedTest,
  nowISO: string,
): AssessmentState {
  const s = getState(state)
  const attempts = s.attempts.map((a) => {
    if (a.testId !== test.id || a.finishedAt) return a
    // Score the attempt as it will be STORED, not as it is now. dispositionOf reads
    // finishedAt to tell "never reached" from "seen and left blank", so scoring the
    // pre-finish object persists a tally the finished attempt itself contradicts:
    // every untouched item counts as not-reached here and as no-response forever after.
    const finished: Attempt = { ...a, finishedAt: nowISO }
    return { ...finished, autoScore: computeAutoScore(test, finished) }
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
