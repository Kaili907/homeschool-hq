import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getPilotAssignments } from '../../../curriculum/family-pilot/catalog'
import { loadFamilyPilotCatalog } from '../../../curriculum/family-pilot/source.node'
import type { PilotLessonRef } from '../../../curriculum/family-pilot/types'
import {
  canGeneratePilotPractice,
  checkPilotPracticeAnswer,
  generatePilotPractice,
  practiceSummary,
  type PilotPracticeItem,
} from './practice'
import { mathPracticeUnit } from './mathPracticeUnit'

const catalog = loadFamilyPilotCatalog()

function firstLessonInUnit(grade: '5' | '7' | '8', unitNumber: number): PilotLessonRef {
  const lesson = getPilotAssignments(catalog, { studentRef: 'stu-fixture', grade }).find(
    (l) => l.unitNumber === unitNumber,
  )
  if (!lesson) throw new Error(`fixture assumption broken: no grade ${grade} unit ${unitNumber} lesson in catalog`)
  return lesson
}

function itemsOrThrow(lessonRef: PilotLessonRef): readonly PilotPracticeItem[] {
  const result = generatePilotPractice(lessonRef)
  if (result.status !== 'available') throw new Error('expected practice to be available')
  return result.items
}

describe('FAMILY-PILOT-PRACTICE-1 canGeneratePilotPractice / generatePilotPractice — real content refs', () => {
  it('Grade 5: a real lessonRef from the catalog produces a compatible practice round', () => {
    const lessonRef = firstLessonInUnit('5', 1)
    expect(canGeneratePilotPractice(lessonRef)).toBe(true)
    const items = itemsOrThrow(lessonRef)
    expect(items).toHaveLength(10)
    for (const item of items) expect(item.unitNumber).toBe(1)
  })

  it('Grade 7: a real lessonRef from the catalog produces a compatible practice round', () => {
    const lessonRef = firstLessonInUnit('7', 1)
    expect(canGeneratePilotPractice(lessonRef)).toBe(true)
    const items = itemsOrThrow(lessonRef)
    expect(items).toHaveLength(10)
    for (const item of items) expect(item.unitNumber).toBe(1)
  })

  it('Grade 8: a real lessonRef from the catalog produces a compatible practice round', () => {
    const lessonRef = firstLessonInUnit('8', 1)
    expect(canGeneratePilotPractice(lessonRef)).toBe(true)
    const items = itemsOrThrow(lessonRef)
    expect(items).toHaveLength(10)
    for (const item of items) expect(item.unitNumber).toBe(1)
  })

  it('every unit across all three grades in the real catalog is generator-compatible', () => {
    for (const grade of ['5', '7', '8'] as const) {
      const assignments = getPilotAssignments(catalog, { studentRef: 'stu-fixture', grade })
      const unitNumbers = new Set(assignments.map((l) => l.unitNumber))
      for (const unitNumber of unitNumbers) {
        expect(canGeneratePilotPractice(firstLessonInUnit(grade, unitNumber))).toBe(true)
      }
    }
  })
})

describe('FAMILY-PILOT-PRACTICE-1 answer checking', () => {
  it('reports a correct answer when the selected index matches answerIndex', () => {
    const [item] = itemsOrThrow(firstLessonInUnit('5', 1))
    const result = checkPilotPracticeAnswer(item, item.answerIndex)
    expect(result.correct).toBe(true)
    expect(result.correctAnswer).toBe(item.choices[item.answerIndex])
    expect(result.itemRef).toBe(item.itemRef)
  })

  it('reports an incorrect answer when the selected index does not match answerIndex', () => {
    const [item] = itemsOrThrow(firstLessonInUnit('7', 1))
    const wrongIndex = (item.answerIndex + 1) % item.choices.length
    const result = checkPilotPracticeAnswer(item, wrongIndex)
    expect(result.correct).toBe(false)
    expect(result.correctAnswer).toBe(item.choices[item.answerIndex])
  })

  it('practiceSummary aggregates a mix of correct and incorrect results', () => {
    const items = itemsOrThrow(firstLessonInUnit('8', 1))
    const results = items.map((item, index) =>
      checkPilotPracticeAnswer(item, index % 2 === 0 ? item.answerIndex : (item.answerIndex + 1) % item.choices.length),
    )
    const summary = practiceSummary(results)
    expect(summary.itemCount).toBe(items.length)
    expect(summary.correctCount).toBe(Math.ceil(items.length / 2))
    expect(summary.accuracy).toBeCloseTo(summary.correctCount / summary.itemCount)
  })

  it('practiceSummary of an empty result set has zero accuracy, not NaN', () => {
    expect(practiceSummary([])).toEqual({ itemCount: 0, correctCount: 0, accuracy: 0 })
  })
})

describe('FAMILY-PILOT-PRACTICE-1 stable item refs', () => {
  it('every item in a round has a unique itemRef', () => {
    const items = itemsOrThrow(firstLessonInUnit('5', 2))
    const refs = new Set(items.map((item) => item.itemRef))
    expect(refs.size).toBe(items.length)
  })

  it('itemRef stays anchored to the same lessonId and unit across separate generations', () => {
    const lessonRef = firstLessonInUnit('7', 2)
    const first = itemsOrThrow(lessonRef)
    const second = itemsOrThrow(lessonRef)
    expect(first.map((item) => item.itemRef)).toEqual(second.map((item) => item.itemRef))
    for (const item of first) {
      expect(item.itemRef.startsWith(`${lessonRef.lessonId}:u${lessonRef.unitNumber}:`)).toBe(true)
    }
  })
})

describe('FAMILY-PILOT-PRACTICE-1 lesson isolation', () => {
  it('practice for one lesson never carries another lesson/unit\'s ref or item types', () => {
    const unit1Ref = firstLessonInUnit('5', 1)
    const unit2Ref = firstLessonInUnit('5', 2)
    const unit1ItemTypes = new Set(mathPracticeUnit('5', 1)!.itemTypes)
    const unit2ItemTypes = new Set(mathPracticeUnit('5', 2)!.itemTypes)

    const unit1Items = itemsOrThrow(unit1Ref)
    const unit2Items = itemsOrThrow(unit2Ref)

    for (const item of unit1Items) {
      expect(item.unitNumber).toBe(1)
      expect(item.lessonId).toBe(unit1Ref.lessonId)
      expect(unit1ItemTypes.has(item.itemType)).toBe(true)
    }
    for (const item of unit2Items) {
      expect(item.unitNumber).toBe(2)
      expect(item.lessonId).toBe(unit2Ref.lessonId)
      expect(unit2ItemTypes.has(item.itemType)).toBe(true)
      expect(item.itemRef.includes(':u1:')).toBe(false)
    }
  })
})

describe('FAMILY-PILOT-PRACTICE-1 student separation', () => {
  it('interleaved rounds for two different lessons never cross-contaminate', () => {
    const studentALesson = firstLessonInUnit('5', 1)
    const studentBLesson = firstLessonInUnit('8', 1)

    const aFirst = itemsOrThrow(studentALesson)
    const bFirst = itemsOrThrow(studentBLesson)
    const aSecond = itemsOrThrow(studentALesson)

    // Generating for "student B" in between does not change what "student A" gets.
    expect(aFirst.map((i) => i.itemRef)).toEqual(aSecond.map((i) => i.itemRef))
    for (const item of aFirst) expect(item.lessonId).toBe(studentALesson.lessonId)
    for (const item of bFirst) expect(item.lessonId).toBe(studentBLesson.lessonId)
  })
})

describe('FAMILY-PILOT-PRACTICE-1 functional fallback', () => {
  it('an unsupported unit number returns practice-unavailable, not an invented question', () => {
    const unsupportedLessonRef: PilotLessonRef = {
      lessonId: 'ma-g5-mathematics-u11-l01',
      courseId: 'ma-g5-mathematics',
      grade: '5',
      unitId: 'u11',
      unitNumber: 11,
      dayInUnit: 1,
      courseDay: 181,
      title: 'Unsupported future unit',
    }
    expect(canGeneratePilotPractice(unsupportedLessonRef)).toBe(false)
    expect(generatePilotPractice(unsupportedLessonRef)).toEqual({ status: 'practice-unavailable' })
  })
})

describe('FAMILY-PILOT-PRACTICE-1 no curriculum advancement side effect', () => {
  const forbiddenIdentifiers = [
    'enrollInCatalog',
    'startLesson',
    'completeSegment',
    'submitLessonCheck',
    'reopenLesson',
    'recordReassessment',
    'recordAssessmentAttempt',
    'setWorkingLevel',
    'reconcileEnrollment',
    'recordHsAnswer',
    'academyState',
    'workingLevel',
    'hsState',
  ]

  it('the bridge source never references a Profile/academy mutator', () => {
    const sources = [
      readFileSync(new URL('./practice.ts', import.meta.url), 'utf-8'),
      readFileSync(new URL('./mathPracticeUnit.ts', import.meta.url), 'utf-8'),
    ]
    for (const source of sources) {
      for (const identifier of forbiddenIdentifiers) {
        expect(source.includes(identifier)).toBe(false)
      }
    }
  })

  it('generating and checking practice does not advance the lesson catalog', () => {
    const lessonRef = firstLessonInUnit('5', 1)
    const before = getPilotAssignments(catalog, { studentRef: 'stu-fixture', grade: '5' })
    const items = itemsOrThrow(lessonRef)
    items.forEach((item) => checkPilotPracticeAnswer(item, item.answerIndex))
    const after = getPilotAssignments(catalog, { studentRef: 'stu-fixture', grade: '5' })
    expect(after).toEqual(before)
  })
})
