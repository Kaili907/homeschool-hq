import { describe, expect, it } from 'vitest'
import { setRng } from '../../../../src/genUtils.ts'
import { blueprintFor } from '../src/blueprint.ts'
import { CORPUS_VERSION, emitLesson } from '../src/emit.ts'
import { unitBankFor } from '../src/itemBank.ts'
import {
  ELIGIBLE_GRADES,
  readAllLessons,
  readLessons,
  type EligibleGrade,
} from '../src/lessonSources.ts'
import { hasEquivalentDistractor, isEquivalentButDifferent, numericValue } from '../src/numericForm.ts'
import { createRng } from '../src/rng.ts'
import { standardCoveredBy, standardsAlign } from '../src/standards.ts'
import { validateLesson } from '../src/validate.ts'

const allLessons = readAllLessons()

describe('lesson sources', () => {
  it('covers every eligible grade with a full 180-lesson course', () => {
    for (const grade of ELIGIBLE_GRADES as readonly EligibleGrade[]) {
      expect(readLessons(grade)).toHaveLength(180)
    }
    expect(allLessons).toHaveLength(360)
  })

  it('is scoped to exactly grades 3 and 4', () => {
    expect(ELIGIBLE_GRADES).toContain(3)
    expect(ELIGIBLE_GRADES).toContain(4)
    expect(allLessons.every((lesson) => lesson.ref.grade === 3 || lesson.ref.grade === 4)).toBe(true)
  })
})

describe('corpus emission', () => {
  it('emits a validated package and answer key for every eligible lesson', () => {
    const issues = allLessons.flatMap((lesson) => {
      const emitted = emitLesson(lesson)
      return validateLesson(emitted.package, emitted.answerKey, lesson)
    })
    expect(issues).toEqual([])
  })

  it('is deterministic: the same lesson emits identical output on every run', () => {
    for (const lesson of [allLessons[0], allLessons[179], allLessons[359]]) {
      const first = JSON.stringify(emitLesson(lesson))
      const second = JSON.stringify(emitLesson(lesson))
      expect(second).toBe(first)
    }
  })

  it('is not sensitive to ambient RNG state, so generation order cannot change it', () => {
    const lesson = allLessons[200]
    const baseline = JSON.stringify(emitLesson(lesson))
    setRng(createRng('deliberately-different-ambient-state'))
    expect(JSON.stringify(emitLesson(lesson))).toBe(baseline)
    setRng(null)
  })

  it('varies package composition by lesson phase rather than reusing one template', () => {
    const unitLessons = allLessons.filter(
      (lesson) => lesson.ref.courseId === 'ma-g3-mathematics' && lesson.ref.unitNumber === 3,
    )
    const profiles = new Set(unitLessons.map((lesson) => blueprintFor(lesson.ref.phase).profile))
    expect(profiles.size).toBeGreaterThan(10)

    const shapes = new Set(
      unitLessons.map((lesson) =>
        emitLesson(lesson)
          .package.sections.map((section) => `${section.kind}:${section.items.length}`)
          .join('|'),
      ),
    )
    // Eighteen lessons from one unit must not produce one repeated worksheet shape.
    expect(shapes.size).toBeGreaterThan(8)
  })

  it('gives lessons in the same unit different questions', () => {
    // Grade 3/4 lessons cite far fewer standards each than grades 5-12 (about
    // 1.5 on average), so orderedItemTypes (src/itemPlan.ts) is deliberately
    // restricted to on-standard item types only (see its doc comment) to keep
    // every item aligned with its lesson's own claimed standards. That
    // legitimately narrows the item-type pool available to any one lesson, so
    // this checks that lessons still differ (via reseeded numbers), not that
    // they hit the same variety a wider item-type pool would give.
    const unitLessons = allLessons.filter(
      (lesson) => lesson.ref.courseId === 'ma-g3-mathematics' && lesson.ref.unitNumber === 3,
    )
    const first = new Set(
      emitLesson(unitLessons[1]).package.sections.flatMap((section) =>
        section.items.map((item) => item.prompt),
      ),
    )
    const second = emitLesson(unitLessons[2]).package.sections.flatMap((section) =>
      section.items.map((item) => item.prompt),
    )
    const overlap = second.filter((prompt) => first.has(prompt))
    expect(overlap.length).toBeLessThan(second.length)
  })
})

describe('answer separation', () => {
  const forbidden = ['answerIndex', 'workedSolution', 'solutionReasoning', 'commonErrors', 'given']

  it('never exposes an answer-bearing field on a graded item', () => {
    for (const lesson of allLessons) {
      const emitted = emitLesson(lesson)
      for (const section of emitted.package.sections) {
        for (const item of section.items) {
          if (item.kind === 'worked-example') continue
          for (const key of forbidden) {
            expect(Object.keys(item)).not.toContain(key)
          }
        }
      }
    }
  })

  it('keeps the answer key out of the student projection entirely', () => {
    const neverInPackage = ['answerIndex', 'solutionReasoning', 'commonErrors', 'given']
    for (const lesson of allLessons) {
      const serialized = JSON.stringify(emitLesson(lesson).package)
      for (const key of neverInPackage) {
        expect(serialized).not.toContain(`"${key}"`)
      }
    }
  })

  it('shows a worked solution only on instructional items', () => {
    for (const lesson of allLessons) {
      for (const section of emitLesson(lesson).package.sections) {
        for (const item of section.items) {
          const hasSolution = 'workedSolution' in item
          expect(hasSolution).toBe(item.kind === 'worked-example')
        }
      }
    }
  })

  it('resolves every graded item to exactly one answer key entry', () => {
    for (const lesson of allLessons) {
      const emitted = emitLesson(lesson)
      const graded = emitted.package.sections
        .flatMap((section) => section.items)
        .filter((item) => item.kind !== 'worked-example')
      const refs = emitted.answerKey.answers.map((entry) => entry.ref)
      expect(new Set(refs).size).toBe(refs.length)
      expect(refs.sort()).toEqual(graded.map((item) => item.ref).sort())
    }
  })

  it('points every multiple-choice answerIndex at the keyed answer', () => {
    for (const lesson of allLessons) {
      const emitted = emitLesson(lesson)
      const items = new Map(
        emitted.package.sections.flatMap((section) => section.items).map((item) => [item.ref, item]),
      )
      for (const entry of emitted.answerKey.answers) {
        const item = items.get(entry.ref)
        if (item?.kind !== 'multiple-choice') continue
        expect(item.choices[entry.answerIndex as number]).toBe(entry.answer)
      }
    }
  })
})

describe('answer authority', () => {
  it('recomputes every Grade 3/4 answer from parameters on an independent oracle', () => {
    // makeG34UnitBank throws when its oracle disagrees with the built answer, so
    // exercising every item type across difficulties is the check.
    let generated = 0
    for (const grade of [3, 4] as const) {
      for (let unit = 1; unit <= 10; unit += 1) {
        const bank = unitBankFor(grade, unit)
        expect(bank.itemTypes.length).toBeGreaterThan(0)
        for (const itemType of bank.itemTypes) {
          for (const difficulty of [1, 2, 3] as const) {
            for (let trial = 0; trial < 25; trial += 1) {
              setRng(createRng(`oracle|${grade}|${unit}|${itemType}|${difficulty}|${trial}`))
              const item = bank.generate(itemType, difficulty)
              expect(item.verification?.method).toBe('recomputed')
              expect(item.solutionSteps?.length ?? 0).toBeGreaterThan(0)
              expect(new Set(item.choices).size).toBe(item.choices.length)
              expect(item.choices[item.answerIndex]).toBeTruthy()
              generated += 1
            }
          }
        }
      }
    }
    setRng(null)
    expect(generated).toBeGreaterThan(1_000)
  })

  it('records how each answer was established', () => {
    for (const lesson of [allLessons[0], allLessons[300]]) {
      const emitted = emitLesson(lesson)
      for (const entry of emitted.answerKey.answers) {
        expect(entry.verification.method).toBe('recomputed')
        expect(entry.verification.oracle).not.toBe('')
        expect(entry.answer.trim()).not.toBe('')
        expect(entry.solutionReasoning.steps.length).toBeGreaterThan(0)
      }
    }
  })

  it('reasons about the item itself, using this item’s own quantities', () => {
    for (const lesson of allLessons.slice(0, 200)) {
      for (const entry of emitLesson(lesson).answerKey.answers) {
        expect(entry.solutionReasoning.answer).toBe(entry.answer)
      }
    }
  })
})

describe('standard alignment', () => {
  it('treats a sub-standard as covering its parent and nothing else', () => {
    expect(standardsAlign('3.MD.5a', '3.MD.5')).toBe(true)
    expect(standardsAlign('3.MD.5', '3.MD.5a')).toBe(true)
    expect(standardsAlign('3.MD.5', '3.MD.50')).toBe(false)
    expect(standardsAlign('3.MD.5', '3.MD.4')).toBe(false)
    expect(standardCoveredBy('4.NF.3', ['4.MD.2', '4.NF.3'])).toBe(true)
    expect(standardCoveredBy('4.NF.3', ['4.MD.2'])).toBe(false)
  })

  it('only asks questions against standards the lesson actually claims', () => {
    for (const lesson of allLessons) {
      const emitted = emitLesson(lesson)
      for (const section of emitted.package.sections) {
        for (const item of section.items) {
          expect(standardCoveredBy(item.standard, lesson.standards)).toBe(true)
        }
      }
    }
  })

  it('never lets a Grade 3 item carry a Grade 4 standard code, or vice versa', () => {
    for (const lesson of allLessons) {
      const emitted = emitLesson(lesson)
      const otherGradePrefix = lesson.ref.grade === 3 ? '4.' : '3.'
      for (const section of emitted.package.sections) {
        for (const item of section.items) {
          expect(item.standard.startsWith(otherGradePrefix)).toBe(false)
        }
      }
    }
  })
})

describe('course identity', () => {
  it('keeps each package bound to its own course, grade, and corpus version', () => {
    for (const lesson of allLessons) {
      const emitted = emitLesson(lesson)
      expect(emitted.package.lessonRef.courseId).toBe(lesson.ref.courseId)
      expect(emitted.package.lessonRef.grade).toBe(lesson.ref.grade)
      expect(emitted.package.integrity.corpusVersion).toBe(CORPUS_VERSION)
      expect(emitted.package.answerKeyRef).toContain(String(lesson.ref.grade).padStart(2, '0'))
      expect(emitted.answerKey.packageId).toBe(emitted.package.packageId)
    }
  })

  it('does not reuse questions across the two courses', () => {
    const grade3 = new Set(
      emitLesson(readLessons(3)[90]).package.sections.flatMap((section) =>
        section.items.map((item) => item.prompt),
      ),
    )
    const grade4 = emitLesson(readLessons(4)[90]).package.sections.flatMap((section) =>
      section.items.map((item) => item.prompt),
    )
    expect(grade4.filter((prompt) => grade3.has(prompt))).toEqual([])
  })
})

describe('equivalent-distractor guard', () => {
  it('parses the numeric forms the corpus renders', () => {
    expect(numericValue('24')).toBe(24)
    expect(numericValue('−12')).toBe(-12)
    expect(numericValue('4/5')).toBeCloseTo(0.8)
    expect(numericValue('32/40')).toBeCloseTo(0.8)
    // Anything unrecognised must be non-comparable rather than guessed at.
    expect(numericValue('x + 3')).toBeNull()
    expect(numericValue('Option A')).toBeNull()
  })

  it('flags a distractor equal in value to the answer but written differently', () => {
    expect(isEquivalentButDifferent('32/40', '4/5')).toBe(true)
    expect(isEquivalentButDifferent('24', '24')).toBe(false)
    expect(isEquivalentButDifferent('25', '24')).toBe(false)
    expect(isEquivalentButDifferent('acute', 'obtuse')).toBe(false)
  })

  it('never emits an item offering the answer in two forms', () => {
    for (const lesson of allLessons) {
      const emitted = emitLesson(lesson)
      const keyed = new Map(emitted.answerKey.answers.map((entry) => [entry.ref, entry.answer]))
      for (const section of emitted.package.sections) {
        for (const item of section.items) {
          if (item.kind !== 'multiple-choice') continue
          const answer = keyed.get(item.ref)
          if (!answer) continue
          expect(hasEquivalentDistractor(item.choices, answer)).toBe(false)
        }
      }
    }
  })
})
