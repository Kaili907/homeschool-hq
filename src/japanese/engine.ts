import type {
  ISODate,
  JapaneseCharacterState,
  JapaneseState,
  Profile,
  Question,
} from '../types'
import { ALL_HIRAGANA, HIRAGANA_GROUPS, type HiraganaCharacter } from './content'

export const JAPANESE_QUIZ_TOTAL = 10
export const MASTERY_STREAK = 3

export type JapaneseQuizMode = 'character-to-sound' | 'sound-to-character'

export function defaultJapaneseState(): JapaneseState {
  return { unlockedGroupIndex: 0, characters: {}, sessionsCompleted: 0 }
}

export function getJapaneseState(profile: Profile): JapaneseState {
  return profile.japanese ?? defaultJapaneseState()
}

export function unlockedCharacters(state: JapaneseState): HiraganaCharacter[] {
  const top = Math.min(Math.max(0, state.unlockedGroupIndex), HIRAGANA_GROUPS.length - 1)
  return HIRAGANA_GROUPS.slice(0, top + 1).flatMap((g) => g.characters)
}

export function currentGroup(state: JapaneseState) {
  return HIRAGANA_GROUPS[Math.min(state.unlockedGroupIndex, HIRAGANA_GROUPS.length - 1)]
}

export function characterById(id: string): HiraganaCharacter | undefined {
  return ALL_HIRAGANA.find((c) => c.id === id)
}

export function ladderComplete(state: JapaneseState): boolean {
  return ALL_HIRAGANA.every((c) => state.characters[c.id]?.mastered)
}

/** Pure per-answer update. Three consecutive correct answers master a character. */
export function applyJapaneseAnswer(
  prev: JapaneseState,
  characterId: string,
  correct: boolean,
  today: ISODate,
): JapaneseState {
  if (!characterById(characterId)) return prev
  const before: JapaneseCharacterState = prev.characters[characterId] ?? {
    attempts: 0,
    correct: 0,
    streak: 0,
    mastered: false,
  }
  const streak = correct ? before.streak + 1 : 0
  const nextCharacter: JapaneseCharacterState = {
    attempts: before.attempts + 1,
    correct: before.correct + (correct ? 1 : 0),
    streak,
    mastered: before.mastered || streak >= MASTERY_STREAK,
    lastSeen: today,
  }
  const characters = { ...prev.characters, [characterId]: nextCharacter }
  const group = currentGroup(prev)
  const cleared = group.characters.every((c) => characters[c.id]?.mastered)
  const unlockedGroupIndex = cleared
    ? Math.min(prev.unlockedGroupIndex + 1, HIRAGANA_GROUPS.length - 1)
    : prev.unlockedGroupIndex
  return { ...prev, characters, unlockedGroupIndex, lastPracticedDate: today }
}

export function finishJapaneseSession(prev: JapaneseState, today: ISODate): JapaneseState {
  return {
    ...prev,
    sessionsCompleted: prev.sessionsCompleted + 1,
    lastPracticedDate: today,
  }
}

function sample<T>(items: T[], count: number, pick: (n: number) => number): T[] {
  const pool = [...items]
  const out: T[] = []
  while (pool.length && out.length < count) {
    const raw = pick(pool.length)
    const index = Math.min(pool.length - 1, Math.max(0, Math.floor(raw)))
    out.push(pool.splice(index, 1)[0])
  }
  return out
}

/**
 * Adapts hiragana content to the app's existing multiple-choice Question shape.
 * `skillId` is a legacy quiz-engine routing field and is not written to math state.
 */
export function makeJapaneseQuestion(
  target: HiraganaCharacter,
  mode: JapaneseQuizMode,
  pool: HiraganaCharacter[],
  pick: (n: number) => number = (n) => Math.floor(Math.random() * n),
): Question {
  const rawEligible = pool.filter(
    (c) => c.id !== target.id && (mode === 'sound-to-character' || c.romaji !== target.romaji),
  )
  const seenValues = new Set<string>()
  const eligible = rawEligible.filter((c) => {
    const value = mode === 'character-to-sound' ? c.romaji : c.kana
    if (seenValues.has(value)) return false
    seenValues.add(value)
    return true
  })
  const distractors = sample(eligible, 3, pick)
  const values =
    mode === 'character-to-sound'
      ? [target, ...distractors].map((c) => c.romaji)
      : [target, ...distractors].map((c) => c.kana)
  const shift = values.length ? Math.abs(Math.floor(pick(values.length))) % values.length : 0
  const choices = [...values.slice(shift), ...values.slice(0, shift)]
  const answer = mode === 'character-to-sound' ? target.romaji : target.kana
  return {
    skillId: 'mult',
    difficulty: 1,
    prompt: mode === 'character-to-sound' ? `${target.kana}\nWhich sound?` : 'Listen, then pick the character.',
    choices,
    answerIndex: choices.indexOf(answer),
  }
}

export function targetForQuestion(
  question: Question,
  mode: JapaneseQuizMode,
): HiraganaCharacter | undefined {
  const answer = question.choices[question.answerIndex]
  return mode === 'character-to-sound'
    ? ALL_HIRAGANA.find((c) => c.kana === question.prompt.split('\n')[0] && c.romaji === answer)
    : ALL_HIRAGANA.find((c) => c.kana === answer)
}
