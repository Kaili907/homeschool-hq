import { isoToday } from '../appState'
import type { Profile } from '../types'
import { applyJapaneseAnswer, finishJapaneseSession, getJapaneseState } from './engine'

/** Functional profile patch for a single quiz/flashcard response. */
export function recordJapaneseAnswer(
  profile: Profile,
  characterId: string,
  correct: boolean,
): Profile {
  return {
    ...profile,
    japanese: applyJapaneseAnswer(getJapaneseState(profile), characterId, correct, isoToday()),
  }
}

/** Functional profile patch for a completed ten-question quiz. */
export function recordJapaneseSession(profile: Profile): Profile {
  return {
    ...profile,
    japanese: finishJapaneseSession(getJapaneseState(profile), isoToday()),
  }
}
