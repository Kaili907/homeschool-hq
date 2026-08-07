import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import type { Difficulty } from '../types'
import { setRng } from '../genUtils'
import type { CurriculumQuestion, CurriculumWorkedExample } from './generatorCore'
import {
  GRADE7_MATH_UNIT7_GENERATORS,
  GRADE7_MATH_UNIT7_ITEM_DEFINITIONS,
  GRADE7_MATH_UNIT7_ITEM_TYPES,
  generateGrade7MathUnit7Question,
} from './grade7MathUnit7Generator'
import {
  GRADE7_MATH_UNIT8_GENERATORS,
  GRADE7_MATH_UNIT8_ITEM_DEFINITIONS,
  GRADE7_MATH_UNIT8_ITEM_TYPES,
  generateGrade7MathUnit8Question,
} from './grade7MathUnit8Generator'

afterEach(() => setRng(null))

/**
 * ============================================================================
 * GRADE 7 UNITS 7 AND 8 - BYTE-LEVEL FREEZE GUARD
 * ============================================================================
 *
 * `grade7MathWorkedExamples.test.ts` carries a 48-row byte-level fingerprint,
 * but its `UNITS` table covers Units 1-6, 9 and 10 only. Units 7 and 8 expose
 * 24 further item types that no byte-level guard pinned, so a change to any
 * Unit 7 or Unit 8 prompt, choice, answer, parameter or worked example could
 * land without a single test failing. This file closes that gap. It adds no
 * content and touches no generator: it only records what the frozen tree
 * already emits.
 *
 * ----------------------------------------------------------------------------
 * THE RECIPE (deterministic, documented, reproducible)
 * ----------------------------------------------------------------------------
 *
 * 1. INVENTORY. The rows are the 24 item types exported by the two units, in
 *    their declared order: Unit 7's twelve first, then Unit 8's twelve. The
 *    exact names are re-listed below in `INVENTORIED_*_ITEM_TYPES` and checked
 *    against the exported arrays, the item-definition tables and the generator
 *    tables, so a renamed, reordered, added or removed item type fails here
 *    with a readable message before any digest is compared. Row key is
 *    `u<unit>:<itemType>`.
 *
 * 2. SEEDING. Every single generated item gets its OWN independent RNG:
 *
 *        seed = (unit * 1_000_003 + typeIndex * 10_007
 *                + difficulty * 101 + run) >>> 0
 *        rng  = splitmix32(seed)
 *
 *    with `typeIndex` the item type's 0-based position inside its own unit,
 *    `difficulty` in 1..3 and `run` in 0..59. The four terms cannot collide:
 *    run < 60 < 101, difficulty * 101 <= 303, and 303 + 59 < 10_007.
 *
 *    Per-ITEM seeding rather than one continuous per-type stream is deliberate.
 *    A shared stream makes every record downstream of a change move even when
 *    that change did not touch them: `finishDistinctChoices` shuffles a
 *    deduplicated distractor pool, so a pool that deduplicates to a different
 *    size consumes a different number of random values and realigns everything
 *    after it. Under this recipe each of the 4,320 records is an independent
 *    probe, so a future diff moves exactly the records it actually changed and
 *    the failure output localises the defect instead of reporting all 24 rows.
 *
 *    `splitmix32` (not the LCG used by the 48-row fingerprint) is required by
 *    the per-item seeding: an LCG seeded with adjacent seeds emits adjacent
 *    first outputs, so run 0 and run 1 would draw the same `pick()` branch 60
 *    times running. splitmix32 avalanches the seed before its first output, so
 *    consecutive runs are uncorrelated. Its arithmetic is exact 32-bit integer
 *    work (`Math.imul` + `>>>`), and the single division is by 2**32, so the
 *    stream is bit-identical on any conforming engine.
 *
 * 3. DRAW. For each row: difficulty 1 runs 0..59, then difficulty 2 runs 0..59,
 *    then difficulty 3 runs 0..59 - 180 items per row, 4,320 in total, 60 per
 *    difficulty per item type, which is what makes this fingerprint
 *    difficulty-covering. The order is fixed by the loops, never by a Map or
 *    object iteration whose order could drift.
 *
 * 4. RECORD. Each item becomes one line: a JSON array of alternating field
 *    name and value in this fixed order -
 *
 *        itemType, difficulty, standard, lessonFocus, prompt, choiceCount,
 *        choices, answerIndex, correctAnswer, parameters, workedExample
 *
 *    `choices` is recorded IN ITS GENERATED ORDER (never sorted - the 48-row
 *    fingerprint sorts, and so cannot see a reshuffle), `correctAnswer` is
 *    `choices[answerIndex]`, and `workedExample` is recorded as
 *    `[prompt, answer, steps]`.
 *
 *    NOTHING TEXTUAL IS NORMALISED. No trimming, no case folding, no unicode
 *    normalisation, no whitespace collapsing, no number reformatting, no array
 *    reordering. `JSON.stringify` supplies the escaping, which is what makes
 *    the record unambiguous even though the prompts contain `"`, `'`, `’`,
 *    `π`, `°`, `²` and `−`. The ONE canonicalisation applied
 *    anywhere is that OBJECT KEYS INSIDE `parameters` ARE SORTED, so the digest
 *    pins the parameter (key, value) mapping rather than the order in which a
 *    generator's object literal happens to spell it. Array order inside
 *    `parameters` is preserved, because there it is data.
 *
 * 5. DIGEST. `sha256(records.join('\n'))`, hex, one digest per row.
 *
 * ----------------------------------------------------------------------------
 * DERIVATION
 * ----------------------------------------------------------------------------
 *
 * The 24 digests below were NOT copied out of a failing run of this file. They
 * were derived first, by a separately written CommonJS harness driving the
 * generators as compiled by `tsc` out of a pristine `git worktree` checkout of
 * 6b41fa821a57eeeafcf6e9bb2220ccd1898339d4 - a different checkout, a different
 * module system and a different transform pipeline from vitest's. This file is
 * the second, independent reproduction of that derivation. The two harnesses
 * share only the recipe written above.
 *
 * Neither harness observed a single throw across all 4,320 draws.
 */

const RUNS_PER_DIFFICULTY = 60
const DIFFICULTIES = [1, 2, 3] as const satisfies readonly Difficulty[]

/** Independently transcribed inventory of Unit 7's item types, in declared order. */
const INVENTORIED_UNIT7_ITEM_TYPES = [
  'circumference-from-radius-or-diameter',
  'find-radius-or-diameter-from-circumference',
  'area-of-circle-from-radius-or-diameter',
  'circumference-area-relationship',
  'complementary-supplementary-angle',
  'vertical-angles-with-expressions',
  'angle-equation-multistep',
  'angles-on-a-line-or-around-a-point',
  'area-of-composite-figure',
  'missing-dimension-from-area',
  'surface-area-of-rectangular-prism',
  'volume-of-rectangular-prism',
] as const

/** Independently transcribed inventory of Unit 8's item types, in declared order. */
const INVENTORIED_UNIT8_ITEM_TYPES = [
  'identify-population-vs-sample',
  'sampling-method-bias-analysis',
  'estimate-population-from-sample-proportion',
  'sample-estimate-variation-range',
  'sample-size-representativeness',
  'generalization-validity-check',
  'compute-mean-median-range',
  'mean-vs-median-with-outlier',
  'compute-mean-absolute-deviation',
  'visual-overlap-in-mad-units',
  'compare-two-samples-center',
  'compare-two-samples-variability',
] as const

type AnyQuestion = CurriculumQuestion<string, unknown>

interface UnitUnderFreeze {
  unit: 7 | 8
  inventoried: readonly string[]
  types: readonly string[]
  definitions: Record<string, { standard: string; lessonFocus: string; workedExample: CurriculumWorkedExample }>
  generators: Record<string, unknown>
  generate: (type: string, difficulty: Difficulty) => AnyQuestion
}

const UNITS: readonly UnitUnderFreeze[] = [
  {
    unit: 7,
    inventoried: INVENTORIED_UNIT7_ITEM_TYPES,
    types: GRADE7_MATH_UNIT7_ITEM_TYPES,
    definitions: GRADE7_MATH_UNIT7_ITEM_DEFINITIONS,
    generators: GRADE7_MATH_UNIT7_GENERATORS,
    generate: (type, difficulty) => generateGrade7MathUnit7Question(type as never, difficulty),
  },
  {
    unit: 8,
    inventoried: INVENTORIED_UNIT8_ITEM_TYPES,
    types: GRADE7_MATH_UNIT8_ITEM_TYPES,
    definitions: GRADE7_MATH_UNIT8_ITEM_DEFINITIONS,
    generators: GRADE7_MATH_UNIT8_GENERATORS,
    generate: (type, difficulty) => generateGrade7MathUnit8Question(type as never, difficulty),
  },
]

// ---------- recipe step 2: seeded, order-stable, per-item RNG ----------

/**
 * splitmix32. Exact 32-bit integer arithmetic; the only floating-point step is
 * the final division by 2**32, which is exact for every 32-bit input.
 */
function splitmix32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x9e37_79b9) >>> 0
    let z = state
    z = Math.imul(z ^ (z >>> 16), 0x21f0_aaad) >>> 0
    z = Math.imul(z ^ (z >>> 15), 0x735a_2d97) >>> 0
    z = (z ^ (z >>> 15)) >>> 0
    return z / 0x1_0000_0000
  }
}

const seedFor = (unit: number, typeIndex: number, difficulty: number, run: number): number =>
  (unit * 1_000_003 + typeIndex * 10_007 + difficulty * 101 + run) >>> 0

// ---------- recipe step 4: record serialisation ----------

/** Recursively sorts object keys. Arrays keep their order; nothing else is touched. */
function withSortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withSortedKeys)
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort())
      sorted[key] = withSortedKeys((value as Record<string, unknown>)[key])
    return sorted
  }
  return value
}

function recordFor(item: AnyQuestion): string {
  const example = item.workedExample
  return JSON.stringify([
    'itemType', item.itemType,
    'difficulty', item.difficulty,
    'standard', item.standard,
    'lessonFocus', item.lessonFocus,
    'prompt', item.prompt,
    'choiceCount', item.choices.length,
    'choices', [...item.choices],
    'answerIndex', item.answerIndex,
    'correctAnswer', item.choices[item.answerIndex],
    'parameters', withSortedKeys(item.parameters),
    'workedExample', [example.prompt, example.answer, [...example.steps]],
  ])
}

/**
 * The record shape the existing 48-row fingerprint uses, reproduced here only so
 * the positive controls can show what that shape cannot see. It is never hashed
 * into this file's digests.
 */
const legacyStyleRecord = (item: AnyQuestion): string =>
  [item.prompt, item.choices[item.answerIndex], [...item.choices].sort().join('||')].join(' >> ')

// ---------- recipe steps 3 and 5: draw and digest ----------

/** Deep copy, so a positive control can corrupt an item without touching the frozen definition it points at. */
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

interface RowRun {
  key: string
  records: string[]
  digest: string
  threw: number
  perDifficulty: Record<number, number>
}

/**
 * Replays one row. `mutateAt` is used only by the positive controls: when
 * supplied, the item drawn at that (difficulty, run) position is cloned,
 * corrupted and recorded in place of the real one. It is never supplied by the
 * fingerprint test itself.
 */
function runRow(
  unit: UnitUnderFreeze,
  typeIndex: number,
  mutateAt?: { difficulty: Difficulty; run: number; mutate: (item: AnyQuestion) => void },
): RowRun {
  const itemType = unit.types[typeIndex]
  const records: string[] = []
  const perDifficulty: Record<number, number> = {}
  let threw = 0
  for (const difficulty of DIFFICULTIES) {
    perDifficulty[difficulty] = 0
    for (let run = 0; run < RUNS_PER_DIFFICULTY; run++) {
      setRng(splitmix32(seedFor(unit.unit, typeIndex, difficulty, run)))
      try {
        let item = unit.generate(itemType, difficulty)
        if (mutateAt && mutateAt.difficulty === difficulty && mutateAt.run === run) {
          item = clone(item)
          mutateAt.mutate(item)
        }
        records.push(recordFor(item))
        perDifficulty[difficulty] += 1
      } catch (error) {
        threw += 1
        records.push(JSON.stringify(['THREW', String((error as Error).message)]))
      } finally {
        setRng(null)
      }
    }
  }
  return {
    key: `u${unit.unit}:${itemType}`,
    records,
    digest: createHash('sha256').update(records.join('\n')).digest('hex'),
    threw,
    perDifficulty,
  }
}

function runAllRows(): RowRun[] {
  const rows: RowRun[] = []
  for (const unit of UNITS)
    for (let typeIndex = 0; typeIndex < unit.types.length; typeIndex++)
      rows.push(runRow(unit, typeIndex))
  return rows
}

/**
 * Byte-level freeze fingerprint of Grade 7 Units 7 and 8, captured at
 * 6b41fa821a57eeeafcf6e9bb2220ccd1898339d4, the commit independently classified
 * READY_FOR_GRADE7_CONTENT_FREEZE.
 *
 * Each digest covers 180 items of one item type - 60 at each of the three
 * difficulties - and records the item type, difficulty, standard, lesson focus,
 * prompt, choice count, choices in generated order, answer index, correct
 * answer, parameters and worked example of every one of them. A change to any
 * of those, in any of the 4,320 items, moves exactly the rows it touches.
 *
 * These 24 rows are disjoint from the 48 rows in
 * `grade7MathWorkedExamples.test.ts`: that table covers Units 1-6, 9 and 10, and
 * none of the 24 names below appears in it. Together the two tables now pin all
 * 72 Grade 7 Mathematics item types.
 *
 * FOUR ROW RE-DERIVATIONS HAVE HAPPENED SINCE THAT CAPTURE, in three waves.
 *
 * WAVE 1 moved `u8:compare-two-samples-center`, after `randomTwoSamplesByMean`
 * stopped handing the greater center to Sample B every single time - a defect
 * this very freeze card surfaced, under which the item was answerable without
 * reading either sample.
 *
 * WAVE 2 moved `u8:compare-two-samples-center` again and
 * `u8:compare-two-samples-variability` for the first time, after both items'
 * four answer choices were rebuilt as a balanced 2x2 of (sample named) x
 * (statistic attribution). The old option set named the keyed sample in two of
 * its three numeric choices and quoted the keyed statistic ordering exactly
 * once, so two independent choice-text-only rules - "take the label that
 * appears twice" and "take the odd ordering out" - each scored 100% without
 * reading either sample. Sample construction was NOT touched in this wave: at
 * matched seeds across 720,000 draws spanning all twelve Unit 8 item types, the
 * prompt, the parameters, the keyed answer text and the answer index are all
 * byte-identical to wave 1, and only the two comparison types' choice ARRAYS
 * move. That is why wave 2 moves exactly these two rows.
 *
 * WAVE 3 moves `u8:sample-size-representativeness`, for the first time, after
 * that item's four answer choices were rebuilt as a balanced 2x2 of (student
 * named) x (direction claimed). The old option set gave the keyed choice a
 * longer explanatory clause than any distractor and quoted the winner's - by
 * construction larger - sample size in it, so THREE independent choice-text-only
 * rules, "take the longest choice", "take the choice with the most words" and
 * "take the choice holding the largest number", each scored 100% without reading
 * the prompt. Sample construction was NOT touched in this wave either: at
 * matched seeds across 720,000 draws spanning all twelve Unit 8 item types, the
 * prompt, the parameters and the answer index are byte-identical for every type
 * including this one, and only this type's choice array, keyed answer text and
 * worked-example answer move. That is why wave 3 moves exactly this one row.
 *
 * Every replacement digest was derived twice, by two separately written
 * CommonJS harnesses over two separately compiled source trees, and neither
 * harness was shown a failing assertion. Both harnesses also re-derived the
 * other 22 rows and reproduced them byte for byte, which is what establishes
 * that each correction moved the rows it claims and no others.
 */
const U78_FREEZE_FINGERPRINT: ReadonlyArray<readonly [string, string]> = [
  ['u7:circumference-from-radius-or-diameter', 'ab7405489cfa2a58751a010dad246dbd242ad74d36f772142834780bf0923742'],
  ['u7:find-radius-or-diameter-from-circumference', '18472c75747dd831e2cb84bb3da95af34d2dfcc83cf5d824f1d0448f7849d3fb'],
  ['u7:area-of-circle-from-radius-or-diameter', 'cfbd1567597ba5ac05199ffc68429f34d8e453e7e9ade9db796e8e8b2611b666'],
  ['u7:circumference-area-relationship', 'f498ee155130494e56dc29df8d4e0d32a38953d738d15fba74119745e7a0a394'],
  ['u7:complementary-supplementary-angle', '437a298bd59ebc5d4ca5ce148e4723bbf6edd1b63998ca7684108adbd2005372'],
  ['u7:vertical-angles-with-expressions', 'ae3a22be24ec56a3ef18e384f0b3be3f62842da99340ce83f9280f5bf60523f1'],
  ['u7:angle-equation-multistep', '5b3acde140266a4952dfedf3de64a337118478c965fa97b8919009afe91d27b4'],
  ['u7:angles-on-a-line-or-around-a-point', '2dcfacb939290ce1fa5a723f7b3ed90ddde03eb4ba43cd547a5315a48139b397'],
  ['u7:area-of-composite-figure', '32bc34f2993092430730bc14ed9b07741000e9e8cc98ccf08c621338bde66caf'],
  ['u7:missing-dimension-from-area', '4cf2937bdf6d1c24e6ace1be313e2277b844674ad76dc9c30902def7995d165a'],
  ['u7:surface-area-of-rectangular-prism', 'bfb3a1b6920ced54c7503a3b1af5998a1e8bd133d7aa7cc0b871313e55d38dba'],
  ['u7:volume-of-rectangular-prism', '362ae4ce891ad96c73857f33dfe77478c74249a7072f022ae8ef15ec7b7bba18'],
  ['u8:identify-population-vs-sample', '90cc0ab20e889c6bdca3f3f800ae52e8c83c63905e7bea490f3f0866334279cd'],
  ['u8:sampling-method-bias-analysis', '802a99c75b55469ce333a4d4b2c6d1b1c44bc6972e25fe165b47ed444be95ee1'],
  ['u8:estimate-population-from-sample-proportion', '193b4ee129b62319e8da4e25eacdd0b08c65af3804724f4ad0e710bfcf0220d0'],
  ['u8:sample-estimate-variation-range', '85c748342b58c3ffb1aff559a38d3913ed24bbcaf9e3c1bbd7461df80d81cdbb'],
  ['u8:sample-size-representativeness', 'f194c73f14dd98478d409a5bfcb698e6e76b2b766f599a21df6c41ee755bd4b5'],
  ['u8:generalization-validity-check', '4007569338798d9451736677702aded4128872050f567de070ad33e07505413e'],
  ['u8:compute-mean-median-range', '6309a6a76adfadc102396ee2026ea5ecefc24bea9e2d019cc988710ef3996458'],
  ['u8:mean-vs-median-with-outlier', '15dea600d3aff7ee1e9b392c74e8d0b7fa01eb1f484ef642900472dc0f19e115'],
  ['u8:compute-mean-absolute-deviation', 'ace2a60a8d8edcc6ed6d0c1004b78836c93d11dcd185a3c3718a86eb59e3d5a4'],
  ['u8:visual-overlap-in-mad-units', 'ab578814bf1a061ede69c8c203cb02699b97b54ed63bb01b7d6bf0716c9088c4'],
  ['u8:compare-two-samples-center', 'b454519047dd1e8d5d3fdf4e5374ad483e1d7fda1fd734f57c26c36218ab4640'],
  ['u8:compare-two-samples-variability', '99fca8ac4e53ee9729f140695945b17799ba9c3f662db53786c24892304095bb'],
]

describe('Grade 7 Units 7 and 8: item-type inventory', () => {
  it('exposes exactly the 24 item types this guard was written against', () => {
    for (const unit of UNITS) {
      expect([...unit.types], `U${unit.unit} item types`).toEqual([...unit.inventoried])
      expect(Object.keys(unit.definitions), `U${unit.unit} item definitions`).toEqual([...unit.inventoried])
      expect(Object.keys(unit.generators), `U${unit.unit} generator table`).toEqual([...unit.inventoried])
    }
    const rowKeys = UNITS.flatMap((unit) => unit.types.map((type) => `u${unit.unit}:${type}`))
    expect(rowKeys).toHaveLength(24)
    expect(new Set(rowKeys).size, 'row keys must be unique').toBe(24)
    expect(rowKeys).toEqual(U78_FREEZE_FINGERPRINT.map(([key]) => key))
  })

  it('serves every item its unit definition verbatim, so the digests pin authored teaching too', () => {
    for (const unit of UNITS)
      for (const type of unit.types) {
        const definition = unit.definitions[type]
        setRng(splitmix32(seedFor(unit.unit, unit.types.indexOf(type), 1, 0)))
        const item = unit.generate(type, 1)
        setRng(null)
        expect(item.standard).toBe(definition.standard)
        expect(item.lessonFocus).toBe(definition.lessonFocus)
        expect(item.workedExample).toEqual(definition.workedExample)
      }
  })
})

describe('Grade 7 Units 7 and 8 are frozen byte for byte', () => {
  it('reproduces the byte-level fingerprint of all 24 item types', () => {
    const observed = runAllRows().map((row) => [row.key, row.digest] as const)
    expect(observed).toEqual(U78_FREEZE_FINGERPRINT)
  })

  it('draws all 4,320 recorded items cleanly, 60 at each difficulty, with no generator throwing', () => {
    const rows = runAllRows()
    expect(rows).toHaveLength(24)
    let total = 0
    for (const row of rows) {
      expect(row.threw, `${row.key} threw during the frozen sample`).toBe(0)
      expect(row.records, `${row.key} record count`).toHaveLength(RUNS_PER_DIFFICULTY * DIFFICULTIES.length)
      for (const difficulty of DIFFICULTIES)
        expect(row.perDifficulty[difficulty], `${row.key} difficulty ${difficulty} coverage`).toBe(RUNS_PER_DIFFICULTY)
      total += row.records.length
    }
    expect(total).toBe(4_320)
  })

  it('is stable across repeated runs, so a failure means the tree moved and not the harness', () => {
    const first = runAllRows().map((row) => row.digest)
    const second = runAllRows().map((row) => row.digest)
    expect(second).toEqual(first)
  })
})

/**
 * Positive controls. A fingerprint that cannot fail proves nothing, so each
 * recorded field is corrupted IN THIS HARNESS - never in a generator - and the
 * record and the row digest are required to move. Every mutation is applied to a
 * deep clone, so nothing leaks into the next test.
 */
const FIELD_MUTATIONS: ReadonlyArray<readonly [string, (item: AnyQuestion) => void]> = [
  ['itemType', (item) => { item.itemType = `${item.itemType}-shadow` }],
  ['difficulty', (item) => { item.difficulty = (item.difficulty === 3 ? 1 : 3) as Difficulty }],
  ['standard', (item) => { item.standard = `${item.standard}a` }],
  ['lessonFocus', (item) => { item.lessonFocus = `${item.lessonFocus} (revised)` }],
  ['prompt (one appended space)', (item) => { item.prompt = `${item.prompt} ` }],
  ['prompt (case)', (item) => { item.prompt = item.prompt.toUpperCase() }],
  ['choices (a distractor reworded)', (item) => {
    const distractor = item.choices.findIndex((_, index) => index !== item.answerIndex)
    item.choices[distractor] = `${item.choices[distractor]} `
  }],
  ['choices (generated order)', (item) => {
    const [first, second] = item.choices.map((_, index) => index).filter((index) => index !== item.answerIndex)
    ;[item.choices[first], item.choices[second]] = [item.choices[second], item.choices[first]]
  }],
  ['answerIndex', (item) => { item.answerIndex = (item.answerIndex + 1) % item.choices.length }],
  ['parameters', (item) => { expect(bumpFirstLeaf(item.parameters)).toBe(true) }],
  ['workedExample.prompt', (item) => { item.workedExample = { ...item.workedExample, prompt: `${item.workedExample.prompt} ` } }],
  ['workedExample.answer', (item) => { item.workedExample = { ...item.workedExample, answer: `${item.workedExample.answer} ` } }],
  ['workedExample.steps', (item) => {
    const steps = [...item.workedExample.steps]
    steps[0] = `${steps[0]} `
    item.workedExample = { ...item.workedExample, steps }
  }],
]

/** Depth-first; nudges the first primitive leaf it finds. Returns false only if there is none. */
function bumpFirstLeaf(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false
  const container = value as Record<string, unknown>
  for (const key of Object.keys(container)) {
    const leaf = container[key]
    if (typeof leaf === 'number') { container[key] = leaf + 1; return true }
    if (typeof leaf === 'string') { container[key] = `${leaf} `; return true }
    if (typeof leaf === 'boolean') { container[key] = !leaf; return true }
    if (bumpFirstLeaf(leaf)) return true
  }
  return false
}

describe('the Units 7 and 8 fingerprint fails when any recorded field moves', () => {
  for (const unit of UNITS)
    for (const [typeIndex, itemType] of unit.types.entries()) {
      const key = `u${unit.unit}:${itemType}`

      it(`${key}: every recorded field is load-bearing in the record`, () => {
        setRng(splitmix32(seedFor(unit.unit, typeIndex, 2, 0)))
        const original = unit.generate(itemType, 2)
        setRng(null)
        const baseline = recordFor(original)
        for (const [label, mutate] of FIELD_MUTATIONS) {
          const corrupted = clone(original)
          mutate(corrupted)
          expect(recordFor(corrupted), `${key}: mutating ${label} left the record unchanged`).not.toBe(baseline)
        }
      })

      it(`${key}: corrupting one of its 180 items moves this row's digest and no other`, () => {
        const frozen = new Map(U78_FREEZE_FINGERPRINT)
        const corrupted = runRow(unit, typeIndex, {
          difficulty: 2,
          run: 30,
          mutate: (item) => { item.prompt = `${item.prompt} ` },
        })
        expect(corrupted.key).toBe(key)
        expect(corrupted.digest, `${key} absorbed a corrupted prompt without moving`).not.toBe(frozen.get(key))
        expect(runRow(unit, typeIndex).digest, `${key} is not reproducible`).toBe(frozen.get(key))
      })
    }

  /**
   * The 48-row fingerprint hashes `[...choices].sort()`, so a reshuffle of a
   * question's choices is invisible to it. Recording the generated order is the
   * one place this guard is strictly stronger, and this is the proof.
   */
  it('catches a choice reshuffle that a sorted-choices recipe cannot see', () => {
    for (const unit of UNITS)
      for (const [typeIndex, itemType] of unit.types.entries()) {
        setRng(splitmix32(seedFor(unit.unit, typeIndex, 3, 0)))
        const original = unit.generate(itemType, 3)
        setRng(null)
        const reshuffled = clone(original)
        const [first, second] = reshuffled.choices
          .map((_, index) => index)
          .filter((index) => index !== reshuffled.answerIndex)
        ;[reshuffled.choices[first], reshuffled.choices[second]] =
          [reshuffled.choices[second], reshuffled.choices[first]]

        const key = `u${unit.unit}:${itemType}`
        expect(reshuffled.answerIndex, `${key}: the swap must not move the answer`).toBe(original.answerIndex)
        expect(reshuffled.choices[reshuffled.answerIndex]).toBe(original.choices[original.answerIndex])
        expect(legacyStyleRecord(reshuffled), `${key}: sorted-choices recipe should be blind here`)
          .toBe(legacyStyleRecord(original))
        expect(recordFor(reshuffled), `${key}: this recipe must see the reshuffle`)
          .not.toBe(recordFor(original))
      }
  })
})
