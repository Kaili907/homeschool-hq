import type { Profile } from '../../types'
import { TEST_BY_ID } from '../../assessment/banks'
import { getState, startStatus } from '../../assessment/attempts'
import type { FixedTest } from '../../assessment/types'

export interface HomeAssessmentCard {
  test: FixedTest
  status: 'not-started' | 'in-progress' | 'retake-ready'
}

/**
 * Tests to surface on a girl's home: assigned by Dad and not yet completed
 * (or in progress, or retake-unlocked). Completed+locked tests never show —
 * she can't restart alone.
 */
export function assignedOpenTests(profile: Profile): HomeAssessmentCard[] {
  const state = getState(profile.assessments)
  const cards: HomeAssessmentCard[] = []
  for (const a of state.assigned) {
    const test = TEST_BY_ID[a.testId]
    if (!test) continue
    const status = startStatus(state, a.testId)
    if (status === 'completed-locked') continue
    cards.push({ test, status })
  }
  return cards
}
