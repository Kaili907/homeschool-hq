import { describe, expect, it } from 'vitest'
import { emptyProfile } from '../migration'
import {
  ALL_HIRAGANA,
  BASIC_HIRAGANA,
  HIRAGANA_GROUPS,
  JAPANESE_VOCAB,
  MARKED_HIRAGANA,
} from './content'
import {
  applyJapaneseAnswer,
  defaultJapaneseState,
  makeJapaneseQuestion,
  targetForQuestion,
  unlockedCharacters,
} from './engine'
import { recordJapaneseAnswer } from './japaneseState'

const TODAY = '2026-07-24'

describe('hiragana content', () => {
  it('contains all 46 basic hiragana in standard row order', () => {
    expect(BASIC_HIRAGANA).toHaveLength(46)
    expect(HIRAGANA_GROUPS.slice(0, 11).map((g) => g.id)).toEqual([
      'vowels',
      'k',
      's',
      't',
      'n',
      'h',
      'm',
      'y',
      'r',
      'w',
      'final-n',
    ])
    expect(BASIC_HIRAGANA.map((c) => c.kana).join('')).toBe(
      'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん',
    )
  })

  it('adds every standard dakuten and handakuten character', () => {
    expect(MARKED_HIRAGANA).toHaveLength(25)
    expect(ALL_HIRAGANA).toHaveLength(71)
    expect(MARKED_HIRAGANA.filter((c) => c.kind === 'dakuten')).toHaveLength(20)
    expect(MARKED_HIRAGANA.filter((c) => c.kind === 'handakuten')).toHaveLength(5)
    expect(new Set(ALL_HIRAGANA.map((c) => c.kana)).size).toBe(71)
  })

  it('has well-formed vocabulary cards whose focus characters exist', () => {
    const ids = new Set(ALL_HIRAGANA.map((c) => c.id))
    expect(JAPANESE_VOCAB.length).toBeGreaterThanOrEqual(10)
    for (const card of JAPANESE_VOCAB) {
      expect(card.kana.trim()).not.toBe('')
      expect(card.romaji.trim()).not.toBe('')
      expect(card.meaning.trim()).not.toBe('')
      expect(ids.has(card.focusId)).toBe(true)
    }
  })
})

describe('hiragana mastery ladder', () => {
  it('masters at three consecutive correct answers and advances after the whole row', () => {
    let state = defaultJapaneseState()
    for (const character of HIRAGANA_GROUPS[0].characters) {
      state = applyJapaneseAnswer(state, character.id, true, TODAY)
      state = applyJapaneseAnswer(state, character.id, true, TODAY)
      expect(state.characters[character.id].mastered).toBe(false)
      state = applyJapaneseAnswer(state, character.id, true, TODAY)
      expect(state.characters[character.id].mastered).toBe(true)
    }
    expect(state.unlockedGroupIndex).toBe(1)
    expect(unlockedCharacters(state)).toHaveLength(10)
  })

  it('a miss resets the streak, while earned mastery stays latched', () => {
    const character = ALL_HIRAGANA[0]
    let state = defaultJapaneseState()
    state = applyJapaneseAnswer(state, character.id, true, TODAY)
    state = applyJapaneseAnswer(state, character.id, false, TODAY)
    expect(state.characters[character.id].streak).toBe(0)
    state = applyJapaneseAnswer(state, character.id, true, TODAY)
    state = applyJapaneseAnswer(state, character.id, true, TODAY)
    state = applyJapaneseAnswer(state, character.id, true, TODAY)
    state = applyJapaneseAnswer(state, character.id, false, TODAY)
    expect(state.characters[character.id].mastered).toBe(true)
  })

  it('profile writes are additive, immutable, and functional-update friendly', () => {
    const profile = emptyProfile('p1', 'Learner', '3')
    const character = ALL_HIRAGANA[0]
    const next = recordJapaneseAnswer(profile, character.id, true)
    expect(next).not.toBe(profile)
    expect(profile.japanese).toBeUndefined()
    expect(next.japanese?.characters[character.id].attempts).toBe(1)
  })
})

describe('hiragana quiz adapter', () => {
  it('builds valid four-choice questions in both modes for every character', () => {
    for (const target of ALL_HIRAGANA) {
      for (const mode of ['character-to-sound', 'sound-to-character'] as const) {
        for (let seed = 0; seed < 8; seed++) {
          let turn = seed
          const question = makeJapaneseQuestion(
            target,
            mode,
            ALL_HIRAGANA,
            (n) => (turn++ * 17 + seed * 7) % n,
          )
          expect(question.choices).toHaveLength(4)
          expect(new Set(question.choices).size).toBe(4)
          expect(question.answerIndex).toBeGreaterThanOrEqual(0)
          expect(question.answerIndex).toBeLessThan(question.choices.length)
          expect(question.choices[question.answerIndex]).toBeTruthy()
          expect(targetForQuestion(question, mode)?.id).toBe(target.id)
        }
      }
    }
  })
})
