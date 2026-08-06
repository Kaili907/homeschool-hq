import { afterEach, describe, expect, it } from 'vitest'
import type { Difficulty } from '../types'
import { setRng } from '../genUtils'
import { curriculumAnswer, type CurriculumQuestion, type CurriculumWorkedExample } from './generatorCore'
import { GRADE5_MATH_UNIT6_ITEM_DEFINITIONS, GRADE5_MATH_UNIT6_ITEM_TYPES, GRADE5_MATH_UNIT6_SCALING_EXAMPLES, generateGrade5MathUnit6Question } from './grade5MathUnit6Generator'
import { GRADE5_MATH_UNIT7_ITEM_DEFINITIONS, GRADE5_MATH_UNIT7_ITEM_TYPES, generateGrade5MathUnit7Question } from './grade5MathUnit7Generator'
import { GRADE5_MATH_UNIT8_ITEM_DEFINITIONS, GRADE5_MATH_UNIT8_ITEM_TYPES, generateGrade5MathUnit8Question } from './grade5MathUnit8Generator'

afterEach(() => setRng(null))

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

type AnyQuestion = CurriculumQuestion<string, unknown>

interface UnitUnderTest {
  unit: number
  seed: number
  types: readonly string[]
  definitions: Record<string, { workedExample: CurriculumWorkedExample }>
  generate: (type: string, difficulty: Difficulty) => AnyQuestion
}

const UNITS: readonly UnitUnderTest[] = [
  {
    unit: 6,
    seed: 6_000,
    types: GRADE5_MATH_UNIT6_ITEM_TYPES,
    definitions: GRADE5_MATH_UNIT6_ITEM_DEFINITIONS,
    generate: (type, difficulty) =>
      generateGrade5MathUnit6Question(type as (typeof GRADE5_MATH_UNIT6_ITEM_TYPES)[number], difficulty),
  },
  {
    unit: 7,
    seed: 7_000,
    types: GRADE5_MATH_UNIT7_ITEM_TYPES,
    definitions: GRADE5_MATH_UNIT7_ITEM_DEFINITIONS,
    generate: (type, difficulty) =>
      generateGrade5MathUnit7Question(type as (typeof GRADE5_MATH_UNIT7_ITEM_TYPES)[number], difficulty),
  },
  {
    unit: 8,
    seed: 8_000,
    types: GRADE5_MATH_UNIT8_ITEM_TYPES,
    definitions: GRADE5_MATH_UNIT8_ITEM_DEFINITIONS,
    generate: (type, difficulty) =>
      generateGrade5MathUnit8Question(type as (typeof GRADE5_MATH_UNIT8_ITEM_TYPES)[number], difficulty),
  },
]

/**
 * The generic filler that shipped in Units 6-8 before this card. A worked example
 * is the only teaching a student sees after a wrong answer, so these sentences
 * must never come back.
 */
const PLACEHOLDER_PHRASES = [
  'Represent the quantities as fractions or whole numbers.',
  'Use the operation shown and simplify the result.',
  'Align place values using a common power of ten.',
  'Compute with whole-number scaled values, then place the decimal point.',
  'Identify the measurement relationship or dimensions.',
  'Compute exactly and include the correct unit.',
]

/**
 * `scaling-magnitude` answers with a comparison word, so its three options are the
 * question's own answer space rather than a numeric pool that could have been
 * derived from the item. Every other item type answers with a value.
 */
const COMPARISON_ITEM_TYPES = new Set(['scaling-magnitude'])

/** Collapses a string to its shape: "$13.77" -> "$#.#", "1 1/2 meters" -> "# #/# meters". */
const shapeOf = (text: string): string => text.replace(/\d+/g, '#')

/**
 * A step that teaches states an operation on real numbers and its result, such as
 * "3 × 12 = 36" or "18 ÷ 3 = 6 tenths". Prose that only describes the method fails.
 */
const CONCRETE_STEP = /\d[\d/. ]*\s*[+\-×÷]\s*[\d/. ]*\d[^=]*=\s*\d/

function sample(unit: UnitUnderTest, type: string, seed: number, perDifficulty = 120): AnyQuestion[] {
  setRng(seededRng(seed))
  const items: AnyQuestion[] = []
  for (const difficulty of [1, 2, 3] as const)
    for (let n = 0; n < perDifficulty; n++) items.push(unit.generate(type, difficulty))
  return items
}

describe('Grade 5 Units 6-8 worked examples teach a concrete method', () => {
  for (const unit of UNITS) {
    it(`U${unit.unit}: no item type ships the generic placeholder prose`, () => {
      for (const type of unit.types) {
        const example = unit.definitions[type].workedExample
        const prose = [example.prompt, example.answer, ...example.steps].join(' ')
        for (const phrase of PLACEHOLDER_PHRASES)
          expect(prose, `${type} still ships placeholder prose`).not.toContain(phrase)
        expect(example.steps.length, `${type} has too few steps`).toBeGreaterThanOrEqual(3)
        expect(example.answer.trim().length, `${type} has no stated answer`).toBeGreaterThan(0)
      }
    })

    it(`U${unit.unit}: every worked example shows at least one concrete numeric step`, () => {
      for (const type of unit.types) {
        const example = unit.definitions[type].workedExample
        const concrete = example.steps.filter((step) => CONCRETE_STEP.test(step))
        expect(
          concrete.length,
          `${type} steps show no arithmetic: ${example.steps.join(' | ')}`,
        ).toBeGreaterThanOrEqual(1)
      }
    })

    it(`U${unit.unit}: every worked example is an instance of the generated prompt shape`, () => {
      for (const type of unit.types) {
        const shapes = new Set(sample(unit, type, unit.unit * 97 + 13).map((item) => shapeOf(item.prompt)))
        expect(
          shapes.has(shapeOf(unit.definitions[type].workedExample.prompt)),
          `${type} worked prompt "${unit.definitions[type].workedExample.prompt}" does not match any generated prompt shape`,
        ).toBe(true)
      }
    })
  }

  it('U6 scaling-magnitude: each comparison case has its own authored walkthrough', () => {
    const shapes = new Set(sample(UNITS[0], 'scaling-magnitude', 5_151).map((item) => shapeOf(item.prompt)))
    for (const [comparison, example] of Object.entries(GRADE5_MATH_UNIT6_SCALING_EXAMPLES)) {
      // The walkthrough must resolve to the case it is filed under and answer in
      // the same shape as the item's choices — a comparison word, not "less than 12".
      expect(example.answer, `${comparison} example answers the wrong case`).toBe(comparison)
      expect(shapes.has(shapeOf(example.prompt)), `${comparison} example prompt shape`).toBe(true)
      expect(example.steps.length).toBeGreaterThanOrEqual(3)
      expect(
        example.steps.filter((step) => CONCRETE_STEP.test(step)).length,
        `${comparison} example shows no arithmetic: ${example.steps.join(' | ')}`,
      ).toBeGreaterThanOrEqual(1)
      for (const phrase of PLACEHOLDER_PHRASES) expect(example.steps.join(' ')).not.toContain(phrase)
    }
    expect(Object.keys(GRADE5_MATH_UNIT6_SCALING_EXAMPLES).sort()).toEqual([
      'equal to',
      'greater than',
      'less than',
    ])
  })

  it('U6 scaling-magnitude: every item is taught the case the student actually met', () => {
    for (const item of sample(UNITS[0], 'scaling-magnitude', 5_252)) {
      const answer = curriculumAnswer(item)
      expect(item.choices).toContain(item.workedExample.answer)
      expect(
        item.workedExample.answer,
        `"${item.prompt}" answers ${answer} but was taught ${item.workedExample.answer}`,
      ).toBe(answer)
    }
  })
})

describe('Grade 5 Units 6-8 distractors come from the item, not a fixed pool', () => {
  for (const unit of UNITS) {
    for (const [index, type] of unit.types.entries()) {
      it(`U${unit.unit} ${type}: the distractor set varies with the item's own numbers`, () => {
        const items = sample(unit, type, unit.seed + index)
        const distractors = new Set<string>()
        for (const item of items)
          for (const choice of item.choices)
            if (choice !== curriculumAnswer(item)) distractors.add(choice)

        if (COMPARISON_ITEM_TYPES.has(type)) {
          // Whichever comparison is correct, the other two are the options — so
          // across a run every one of the three words appears as a distractor.
          expect([...distractors].sort()).toEqual(['equal to', 'greater than', 'less than'])
          return
        }
        // The replaced pools held 6-7 fixed strings no matter what the item asked.
        // Anything derived from the item's numbers spreads much wider over 360 items.
        expect(
          distractors.size,
          `${type} distractors: ${[...distractors].slice(0, 12).join(', ')}`,
        ).toBeGreaterThanOrEqual(25)
      })
    }
  }

  it('U6 scaling-magnitude: no single comparison can be answered by rote', () => {
    const items = sample(UNITS[0], 'scaling-magnitude', 5_353)
    const counts = new Map<string, number>()
    for (const item of items) {
      const answer = curriculumAnswer(item)
      counts.set(answer, (counts.get(answer) ?? 0) + 1)
    }
    const report = [...counts].map(([k, v]) => `${k}=${v}`).join(' ')
    // All three directions of 5.NF.5 must actually occur. Before this fix the
    // scale factor was always proper, so "less than" was 360/360 and a student
    // scored full marks without reading the fraction.
    for (const comparison of ['less than', 'greater than', 'equal to']) {
      const share = (counts.get(comparison) ?? 0) / items.length
      expect(share, `${comparison} share (${report})`).toBeGreaterThanOrEqual(0.2)
      expect(share, `${comparison} share (${report})`).toBeLessThanOrEqual(0.5)
    }
  })

  for (const unit of UNITS) {
    for (const [index, type] of unit.types.entries()) {
      if (COMPARISON_ITEM_TYPES.has(type)) continue
      it(`U${unit.unit} ${type}: the answer is not identifiable by format alone`, () => {
        const items = sample(unit, type, unit.seed + 500 + index)
        // A student who does no arithmetic can still pick the choice whose shape is
        // unlike every other one. Measure how often that shortcut wins. Before this
        // card, "$13.77" among "$2"/"$3"/"$1" made it win every single time.
        let played = 0
        let won = 0
        for (const item of items) {
          const shapes = item.choices.map(shapeOf)
          const oddOnesOut = item.choices.filter(
            (_, i) => shapes.filter((shape) => shape === shapes[i]).length === 1,
          )
          if (oddOnesOut.length !== 1) continue
          played++
          if (oddOnesOut[0] === curriculumAnswer(item)) won++
        }
        expect(
          won / items.length,
          `${type}: odd-shape-out picked the answer on ${won}/${items.length} items`,
        ).toBeLessThanOrEqual(0.4)
        expect(
          played === 0 ? 0 : won / played,
          `${type}: odd-shape-out accuracy on the ${played} items where it fires`,
        ).toBeLessThanOrEqual(0.6)
      })
    }
  }
})
