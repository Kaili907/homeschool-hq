import { describe, expect, it } from 'vitest'
import { emitLesson } from '../src/emit.ts'
import {
  grade3RoundingSampleR1Oracle,
  type RoundingSampleOracleParameters,
} from '../src/g34/grade3RoundingSampleR1.ts'
import { readLessons } from '../src/lessonSources.ts'
import { validateLesson } from '../src/validate.ts'

const LESSON_ID = 'ma-g3-mathematics-u01-l02'
const lesson = readLessons(3).find((entry) => entry.ref.lessonId === LESSON_ID)
if (!lesson) throw new Error(`Missing ${LESSON_ID}`)
const emitted = emitLesson(lesson)
const section = (id: string) => emitted.package.sections.find((entry) => entry.sectionId === id)

describe('Grade 3 Rounding Sample R1', () => {
  it('keeps the exact canonical lesson identity and approved standards', () => {
    expect(emitted.package.lessonRef).toEqual(lesson.ref)
    expect(emitted.package.standards).toEqual(lesson.standards)
    expect(emitted.package.lessonRef.courseDay).toBe(2)
    expect(emitted.package.lessonRef.title).toBe('Concept build A: the place-value structure of three-digit numbers')
  })

  it('has the required deep-lesson composition', () => {
    expect(emitted.package.sections.filter((entry) => entry.sectionId.startsWith('learn-'))).toHaveLength(3)
    expect(section('ex')?.items).toHaveLength(3)
    expect(section('gp')?.items).toHaveLength(5)
    expect(section('ip')?.items).toHaveLength(10)
    expect(section('mc')?.items).toHaveLength(5)
    expect(section('rm')?.items).toHaveLength(4)
    expect(section('xt')?.items).toHaveLength(2)
  })

  it('uses distinct prompts and exact adult authority for every graded item', () => {
    const items = emitted.package.sections.flatMap((entry) => entry.items)
    const graded = items.filter((item) => item.kind !== 'worked-example')
    const prompts = items.map((item) => item.prompt)
    expect(new Set(prompts).size).toBe(prompts.length)
    expect(new Set(graded.map((item) => item.ref)).size).toBe(graded.length)
    expect(emitted.answerKey.answers).toHaveLength(graded.length)
    for (const answer of emitted.answerKey.answers) {
      expect(
        grade3RoundingSampleR1Oracle(
          answer.verification.parameters as unknown as RoundingSampleOracleParameters,
        ),
      ).toBe(answer.answer)
    }
  })

  it('keeps answer-bearing fields out of learner graded records', () => {
    const forbidden = ['answer', 'answerIndex', 'correctAnswer', 'expectedAnswer', 'workedSolution', 'solutionReasoning', 'given', 'verification']
    for (const item of emitted.package.sections.flatMap((entry) => entry.items)) {
      if (item.kind === 'worked-example') continue
      for (const field of forbidden) expect(Object.keys(item)).not.toContain(field)
    }
  })

  it('uses Grade 3-facing section language', () => {
    expect(emitted.package.sections.map((entry) => entry.title)).toEqual([
      'Learn: Find the Nearby Hundreds',
      'Learn: Let the Tens Digit Help',
      'Learn: What Happens Halfway?',
      'Examples',
      "Let's Try One",
      'Your Turn',
      'Check What You Know',
      'Need Help?',
      'Challenge',
    ])
    const learnerText = JSON.stringify(emitted.package).toLowerCase()
    for (const phrase of ['diagnostic evidence', 'advisory only', 'mastery state', 'response kind', 'active segment']) {
      expect(learnerText).not.toContain(phrase)
    }
  })

  it('conforms to the established package/key validator', () => {
    expect(validateLesson(emitted.package, emitted.answerKey, lesson)).toEqual([])
  })

  it('is deterministic', () => {
    expect(JSON.stringify(emitLesson(lesson))).toBe(JSON.stringify(emitted))
  })
})
