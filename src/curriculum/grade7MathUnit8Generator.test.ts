import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import {
  GRADE7_MATH_UNIT8_ITEM_TYPES,
  generateGrade7MathUnit8Question,
  type Grade7MathUnit8ItemType,
  type Grade7MathUnit8Question,
} from './grade7MathUnit8Generator'

const RUNS_PER_DIFFICULTY = 200
const DIFFICULTIES = [1, 2, 3] as const

afterEach(() => setRng(null))

/**
 * The oracle below never imports arithmetic from grade7MathUnit8Generator.ts.
 * It parses the RENDERED PROMPT TEXT with independent regexes and recomputes
 * the answer with its own BigInt-exact fraction math, then compares the
 * result to the generator's actual answer text.
 */

interface BigFraction {
  num: bigint
  den: bigint
}

function bfGcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a
  let y = b < 0n ? -b : b
  while (y !== 0n) {
    ;[x, y] = [y, x % y]
  }
  return x === 0n ? 1n : x
}

function bfReduce(f: BigFraction): BigFraction {
  const sign = f.den < 0n ? -1n : 1n
  const num = f.num * sign
  const den = f.den < 0n ? -f.den : f.den
  if (num === 0n) return { num: 0n, den: 1n }
  const divisor = bfGcd(num < 0n ? -num : num, den)
  return { num: num / divisor, den: den / divisor }
}

function bfInt(n: number | bigint): BigFraction {
  return { num: BigInt(n), den: 1n }
}

function bfAdd(a: BigFraction, b: BigFraction): BigFraction {
  return bfReduce({ num: a.num * b.den + b.num * a.den, den: a.den * b.den })
}

function bfDiv(a: BigFraction, b: BigFraction): BigFraction {
  return bfReduce({ num: a.num * b.den, den: a.den * b.num })
}

function bfCompare(a: BigFraction, b: BigFraction): -1 | 0 | 1 {
  const left = a.num * b.den
  const right = b.num * a.den
  return left < right ? -1 : left > right ? 1 : 0
}

function bfMixedText(f: BigFraction): string {
  const r = bfReduce(f)
  if (r.den === 1n) return r.num.toString()
  const whole = r.num / r.den
  const remainder = r.num - whole * r.den
  if (whole === 0n) return `${remainder}/${r.den}`
  return remainder === 0n ? whole.toString() : `${whole} ${remainder}/${r.den}`
}

function parseMixedNumber(text: string): BigFraction {
  const trimmed = text.trim()
  let m = /^(\d+)\s+(\d+)\/(\d+)$/.exec(trimmed)
  if (m) {
    const whole = BigInt(m[1])
    const n = BigInt(m[2])
    const d = BigInt(m[3])
    return bfReduce({ num: whole * d + n, den: d })
  }
  m = /^(\d+)\/(\d+)$/.exec(trimmed)
  if (m) return bfReduce({ num: BigInt(m[1]), den: BigInt(m[2]) })
  m = /^(\d+)$/.exec(trimmed)
  if (m) return { num: BigInt(m[1]), den: 1n }
  throw new Error(`cannot parse number text: "${text}"`)
}

function parseNumberList(text: string): number[] {
  return text.split(',').map((s) => Number(s.trim()))
}

function required(match: RegExpExecArray | null, prompt: string): RegExpExecArray {
  if (!match) throw new Error(`prompt did not match expected pattern: "${prompt}"`)
  return match
}

function bfMean(data: number[]): BigFraction {
  const sum = data.reduce((total, v) => total + BigInt(v), 0n)
  return bfReduce({ num: sum, den: BigInt(data.length) })
}

function bfMedian(data: number[]): BigFraction {
  const sorted = [...data].sort((a, b) => a - b)
  const n = sorted.length
  const mid = Math.floor(n / 2)
  if (n % 2 === 1) return bfInt(sorted[mid])
  return bfReduce({ num: BigInt(sorted[mid - 1] + sorted[mid]), den: 2n })
}

function numericRange(data: number[]): number {
  return Math.max(...data) - Math.min(...data)
}

function oracleAnswer(question: Grade7MathUnit8Question): string {
  const prompt = question.prompt
  switch (question.itemType) {
    case 'identify-population-vs-sample': {
      const m = required(
        /^A researcher wants to know about all (\d+) (.+?)\. She randomly selects (\d+) of them to survey\. What is the (population|sample) in this situation\?$/.exec(
          prompt,
        ),
        prompt,
      )
      const totalSize = m[1]
      const subject = m[2]
      const sampleSize = m[3]
      const askAbout = m[4]
      return askAbout === 'population' ? `All ${totalSize} ${subject}` : `The ${sampleSize} randomly selected ${subject}`
    }
    case 'sampling-method-bias-analysis': {
      const representative = prompt.includes('random number generator') || prompt.includes('every 10th person')
      const biased = prompt.includes('sitting closest to her') || prompt.includes('choose to respond')
      if (representative === biased) throw new Error(`could not classify sampling method: "${prompt}"`)
      return representative
        ? 'Yes, likely representative — every member had a fair, known chance of being chosen.'
        : 'No, likely not representative — the method favors certain members over others.'
    }
    case 'estimate-population-from-sample-proportion': {
      const m = required(
        /^In a random sample of (\d+) (.+?), (\d+) preferred (.+?)\. Based on this sample, about how many of the (\d+) /.exec(
          prompt,
        ),
        prompt,
      )
      const sampleSize = BigInt(m[1])
      const sampleCount = BigInt(m[3])
      const populationSize = BigInt(m[5])
      const ratio = bfReduce({ num: sampleCount * populationSize, den: sampleSize })
      if (ratio.den !== 1n) throw new Error(`non-integer population estimate: ${ratio.num}/${ratio.den}`)
      return ratio.num.toString()
    }
    case 'sample-estimate-variation-range': {
      const m = required(/mean scores: (.+?)\. What is the range/.exec(prompt), prompt)
      const estimates = parseNumberList(m[1])
      return String(numericRange(estimates))
    }
    case 'sample-size-representativeness': {
      const m = required(
        /Student A takes a random sample of (\d+)\. Student B takes a random sample of (\d+)\./.exec(prompt),
        prompt,
      )
      const aSize = Number(m[1])
      const bSize = Number(m[2])
      const winner = bSize > aSize ? 'B' : 'A'
      const winnerSize = Math.max(aSize, bSize)
      return `Student ${winner}'s sample of ${winnerSize}, because larger random samples tend to produce more consistent, accurate estimates.`
    }
    case 'generalization-validity-check': {
      const m = required(
        /using (a simple random sample|a convenience sample of her classmates only) and records/.exec(prompt),
        prompt,
      )
      const valid = m[1] === 'a simple random sample'
      return valid
        ? 'Yes, because the sample was selected randomly, so it is likely representative of the population.'
        : 'No, because the sample was not randomly selected, so it may not represent the population.'
    }
    case 'compute-mean-median-range': {
      const m = required(
        /A sample of \d+ values is: (.+?)\. What is the (mean|median|range) of this data set\?/.exec(prompt),
        prompt,
      )
      const data = parseNumberList(m[1])
      if (m[2] === 'range') return String(numericRange(data))
      return bfMixedText(m[2] === 'mean' ? bfMean(data) : bfMedian(data))
    }
    case 'mean-vs-median-with-outlier': {
      const m = required(
        /A data set has \d+ values: (.+?)\. What is the new mean if an outlier of (\d+) is added/.exec(prompt),
        prompt,
      )
      const values = parseNumberList(m[1])
      const outlier = Number(m[2])
      const sum = values.reduce((total, v) => total + v, 0) + outlier
      return bfMixedText(bfReduce({ num: BigInt(sum), den: BigInt(values.length + 1) }))
    }
    case 'compute-mean-absolute-deviation': {
      const m = required(/A data set is: (.+?), with a mean of (\d+)\. What is the mean absolute deviation/.exec(prompt), prompt)
      const data = parseNumberList(m[1])
      const meanValue = Number(m[2])
      const sumAbsDev = data.reduce((total, v) => total + Math.abs(v - meanValue), 0)
      return bfMixedText(bfReduce({ num: BigInt(sumAbsDev), den: BigInt(data.length) }))
    }
    case 'visual-overlap-in-mad-units': {
      const m = required(
        /means of (\d+) and (\d+)\. Their mean absolute deviation \(MAD\) is (.+?)\. Express the difference/.exec(prompt),
        prompt,
      )
      const meanA = Number(m[1])
      const meanB = Number(m[2])
      const mad = parseMixedNumber(m[3])
      const diff = bfInt(meanB - meanA)
      const ratio = bfDiv(diff, mad)
      return `${bfMixedText(ratio)} times the MAD`
    }
    case 'compare-two-samples-center': {
      const m = required(/Sample A: (.+?)\. Sample B: (.+?)\. Based on the means/.exec(prompt), prompt)
      const dataA = parseNumberList(m[1])
      const dataB = parseNumberList(m[2])
      const meanA = bfMean(dataA)
      const meanB = bfMean(dataB)
      const aGreater = bfCompare(meanA, meanB) > 0
      const label = aGreater ? 'A' : 'B'
      const greater = aGreater ? meanA : meanB
      const lesser = aGreater ? meanB : meanA
      return `Sample ${label}, with a mean of ${bfMixedText(greater)} compared to ${bfMixedText(lesser)}.`
    }
    case 'compare-two-samples-variability': {
      const m = required(/Sample A: (.+?)\. Sample B: (.+?)\. Based on the range/.exec(prompt), prompt)
      const dataA = parseNumberList(m[1])
      const dataB = parseNumberList(m[2])
      const rangeA = numericRange(dataA)
      const rangeB = numericRange(dataB)
      const aSmaller = rangeA < rangeB
      const label = aSmaller ? 'A' : 'B'
      const smaller = aSmaller ? rangeA : rangeB
      const larger = aSmaller ? rangeB : rangeA
      return `Sample ${label}, with a range of ${smaller} compared to ${larger}.`
    }
  }
}

describe('grade7MathUnit8Generator', () => {
  describe.each(GRADE7_MATH_UNIT8_ITEM_TYPES)('%s', (itemType: Grade7MathUnit8ItemType) => {
    it(`matches an independent prompt-parsing oracle across ${RUNS_PER_DIFFICULTY} runs per difficulty`, () => {
      for (const difficulty of DIFFICULTIES) {
        for (let i = 0; i < RUNS_PER_DIFFICULTY; i++) {
          const question = generateGrade7MathUnit8Question(itemType, difficulty)
          expect(question.itemType).toBe(itemType)
          expect(question.difficulty).toBe(difficulty)
          expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
        }
      }
    })
  })

  it('reaches every item type at every difficulty (coverage)', () => {
    for (const itemType of GRADE7_MATH_UNIT8_ITEM_TYPES) {
      for (const difficulty of DIFFICULTIES) {
        const question = generateGrade7MathUnit8Question(itemType, difficulty)
        expect(question.itemType).toBe(itemType)
        expect(question.difficulty).toBe(difficulty)
      }
    }
  })

  function seededRng(seed: number): () => number {
    let state = seed >>> 0
    return () => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
      return state / 0x1_0000_0000
    }
  }

  it('produces distinct, non-empty choices under a constant injected RNG', () => {
    setRng(seededRng(20260805))
    for (const itemType of GRADE7_MATH_UNIT8_ITEM_TYPES) {
      for (const difficulty of DIFFICULTIES) {
        for (let i = 0; i < 25; i++) {
          const question = generateGrade7MathUnit8Question(itemType, difficulty)
          expect(question.choices.length).toBe(new Set(question.choices).size)
          expect(question.choices).toContain(curriculumAnswer(question))
          for (const choice of question.choices) {
            expect(choice.trim()).not.toBe('')
          }
        }
      }
    }
  })

  it('always produces a strictly positive range for sample-estimate-variation-range (no all-tied sets)', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let i = 0; i < 100; i++) {
        const question = generateGrade7MathUnit8Question('sample-estimate-variation-range', difficulty)
        expect(numericRange(question.parameters.estimates)).toBeGreaterThan(0)
      }
    }
  })

  it('keeps mean-absolute-deviation data sets exactly centered on the stated mean', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let i = 0; i < 100; i++) {
        const question = generateGrade7MathUnit8Question('compute-mean-absolute-deviation', difficulty)
        const sum = question.parameters.data.reduce((total, v) => total + v, 0)
        expect(sum).toBe(question.parameters.mean * question.parameters.data.length)
      }
    }
  })

  it('exercises a fractional MAD at difficulty 3 for visual-overlap-in-mad-units and still verifies exactly', () => {
    let sawFraction = false
    for (let i = 0; i < 100; i++) {
      const question = generateGrade7MathUnit8Question('visual-overlap-in-mad-units', 3)
      if (question.parameters.mad.den !== 1) sawFraction = true
      expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
    }
    expect(sawFraction).toBe(true)
  })

  it('never ties the two samples being compared (center or variability)', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let i = 0; i < 100; i++) {
        const centerQuestion = generateGrade7MathUnit8Question('compare-two-samples-center', difficulty)
        const meanA = bfMean(centerQuestion.parameters.dataA)
        const meanB = bfMean(centerQuestion.parameters.dataB)
        expect(bfCompare(meanA, meanB)).not.toBe(0)

        const variabilityQuestion = generateGrade7MathUnit8Question('compare-two-samples-variability', difficulty)
        expect(numericRange(variabilityQuestion.parameters.dataA)).not.toBe(
          numericRange(variabilityQuestion.parameters.dataB),
        )
      }
    }
  })

  /**
   * ==========================================================================
   * RENDERED-DATA COMPARISON ORACLE
   * ==========================================================================
   *
   * The two `compare-two-samples-*` item types are only worth asking if the
   * learner has to read the samples. Both helpers below therefore consult ONLY
   * `question.prompt`: they re-parse the two printed samples with their own
   * regexes, recompute each sample's centre (or spread) with the BigInt-exact
   * helpers at the top of this file, and decide the winner without ever
   * touching `question.parameters` or any generator export. A generator that
   * decided the answer from a parameter the prompt does not actually render
   * would be caught here rather than agreed with.
   */
  const CENTER_PROMPT =
    /^Sample A: (.+?)\. Sample B: (.+?)\. Based on the means, which sample tends to have greater values\?$/
  const VARIABILITY_PROMPT =
    /^Sample A: (.+?)\. Sample B: (.+?)\. Based on the range of each sample, which sample is more consistent \(less variable\)\?$/

  interface RenderedVerdict {
    winner: 'A' | 'B'
    answerText: string
    tied: boolean
  }

  function parseRenderedSamples(prompt: string, pattern: RegExp): [number[], number[]] {
    const m = required(pattern.exec(prompt), prompt)
    const dataA = parseNumberList(m[1])
    const dataB = parseNumberList(m[2])
    for (const value of [...dataA, ...dataB])
      if (!Number.isInteger(value)) throw new Error(`non-integer datum rendered in prompt: "${prompt}"`)
    return [dataA, dataB]
  }

  function renderedCenterVerdict(prompt: string): RenderedVerdict {
    const [dataA, dataB] = parseRenderedSamples(prompt, CENTER_PROMPT)
    const meanA = bfMean(dataA)
    const meanB = bfMean(dataB)
    const order = bfCompare(meanA, meanB)
    const winner = order > 0 ? 'A' : 'B'
    const greater = order > 0 ? meanA : meanB
    const lesser = order > 0 ? meanB : meanA
    return {
      winner,
      answerText: `Sample ${winner}, with a mean of ${bfMixedText(greater)} compared to ${bfMixedText(lesser)}.`,
      tied: order === 0,
    }
  }

  function renderedVariabilityVerdict(prompt: string): RenderedVerdict {
    const [dataA, dataB] = parseRenderedSamples(prompt, VARIABILITY_PROMPT)
    const rangeA = numericRange(dataA)
    const rangeB = numericRange(dataB)
    const winner = rangeA < rangeB ? 'A' : 'B'
    return {
      winner,
      answerText: `Sample ${winner}, with a range of ${Math.min(rangeA, rangeB)} compared to ${Math.max(rangeA, rangeB)}.`,
      tied: rangeA === rangeB,
    }
  }

  const BALANCE_RUNS = 2_000
  /**
   * A deliberately broad band. The intent is "a learner cannot pass by always
   * naming the same sample", not an exact 50/50 pin that would flake on an
   * honest generator. Every draw is won by exactly one of the two samples, so
   * bounding Sample A's share on both sides bounds Sample B's share too.
   */
  const BALANCE_MIN_SHARE = 0.35
  const BALANCE_MAX_SHARE = 0.65

  function expectBothSamplesWin(
    itemType: 'compare-two-samples-center' | 'compare-two-samples-variability',
    verdictOf: (prompt: string) => RenderedVerdict,
  ): void {
    for (const difficulty of DIFFICULTIES) {
      const wins = { A: 0, B: 0 }
      for (let i = 0; i < BALANCE_RUNS; i++) {
        const question = generateGrade7MathUnit8Question(itemType, difficulty)
        const label = `${itemType} d${difficulty}`
        const verdict = verdictOf(question.prompt)
        expect(verdict.tied, `${label}: the rendered samples tied, so the item has no answer`).toBe(false)
        expect(question.answerIndex, `${label}: answer index out of range`).toBeGreaterThanOrEqual(0)
        expect(question.answerIndex, `${label}: answer index out of range`).toBeLessThan(question.choices.length)
        expect(new Set(question.choices).size, `${label}: duplicate choices`).toBe(question.choices.length)
        expect(question.choices[question.answerIndex], `${label}: keyed answer contradicts the rendered data`).toBe(
          verdict.answerText,
        )
        wins[verdict.winner] += 1
      }
      const shareA = wins.A / BALANCE_RUNS
      const report = `${itemType} d${difficulty}: Sample A won ${wins.A} of ${BALANCE_RUNS} draws`
      expect(shareA, report).toBeGreaterThanOrEqual(BALANCE_MIN_SHARE)
      expect(shareA, report).toBeLessThanOrEqual(BALANCE_MAX_SHARE)
    }
  }

  it('lets either sample hold the greater centre, decided by the rendered data, at every difficulty', () => {
    expectBothSamplesWin('compare-two-samples-center', renderedCenterVerdict)
  })

  it('lets either sample be the more consistent one, decided by the rendered data, at every difficulty', () => {
    expectBothSamplesWin('compare-two-samples-variability', renderedVariabilityVerdict)
  })

  it('always yields an outlier-inflated mean greater than the original mean', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let i = 0; i < 100; i++) {
        const question = generateGrade7MathUnit8Question('mean-vs-median-with-outlier', difficulty)
        const original = bfMean(question.parameters.values)
        const withOutlier = bfReduce({
          num:
            question.parameters.values.reduce((total, v) => total + BigInt(v), 0n) +
            BigInt(question.parameters.outlier),
          den: BigInt(question.parameters.values.length + 1),
        })
        expect(bfCompare(withOutlier, original)).toBe(1)
      }
    }
  })

  /**
   * ==========================================================================
   * CHOICE-TEXT-ONLY SHORTCUTS MUST NOT ANSWER THE COMPARISON ITEMS
   * ==========================================================================
   *
   * Both `compare-two-samples-*` types used to be answerable from the four
   * choice strings alone, without reading either sample, by two independent
   * cues:
   *
   *   LEAK A - statistic ordering. Exactly one choice quoted the two statistics
   *     in the keyed relationship (greater-first for the centre item,
   *     lesser-first for the variability item). "Take the odd one out" scored
   *     100%.
   *
   *   LEAK B - majority sample label. The keyed sample was named by two of the
   *     three numeric choices and the other sample by one. "Take the label that
   *     appears twice" identified the keyed sample 100% of the time.
   *
   *   (A third, weaker cue rode along: the "Both samples have the same ..."
   *   option was the only choice quoting no statistics at all, and was never
   *   the answer, so it could be struck out on sight.)
   *
   * Everything in this section is computed from `question.choices` and nothing
   * else - never the prompt, the samples, the parameters, the answer index or
   * the worked example - except where a helper is explicitly named as the
   * rendered-data oracle, which is the only thing allowed to decide what the
   * true answer is.
   */

  /** Every quantity token a choice renders, in rendered order, parsed exactly. */
  const QUANTITY_TOKEN = /\d+\s+\d+\/\d+|\d+\/\d+|\d+/g
  const quantitiesIn = (choice: string): BigFraction[] =>
    (choice.match(QUANTITY_TOKEN) ?? []).map(parseMixedNumber)

  type Ordering = 'greater-first' | 'lesser-first' | 'equal'

  /** The ordering relationship a choice renders between its two statistics. */
  function orderingOf(choice: string): Ordering | null {
    const quantities = quantitiesIn(choice)
    if (quantities.length !== 2) return null
    const order = bfCompare(quantities[0], quantities[1])
    return order > 0 ? 'greater-first' : order < 0 ? 'lesser-first' : 'equal'
  }

  function labelOf(choice: string): 'A' | 'B' | null {
    const m = /^Sample ([AB]),/.exec(choice)
    return m ? (m[1] as 'A' | 'B') : null
  }

  const countWhere = <T,>(items: readonly T[], fn: (item: T) => boolean): number =>
    items.filter(fn).length

  /**
   * The rendered-data oracle's verdict, plus the exact per-sample statistic, so
   * a choice can be judged true or false on the data rather than on its text.
   */
  interface ComparisonTruth {
    winner: 'A' | 'B'
    valueA: BigFraction
    valueB: BigFraction
  }

  const CENTER_TRUTH = (prompt: string): ComparisonTruth => {
    const [dataA, dataB] = parseRenderedSamples(prompt, CENTER_PROMPT)
    const valueA = bfMean(dataA)
    const valueB = bfMean(dataB)
    return { winner: bfCompare(valueA, valueB) > 0 ? 'A' : 'B', valueA, valueB }
  }

  const VARIABILITY_TRUTH = (prompt: string): ComparisonTruth => {
    const [dataA, dataB] = parseRenderedSamples(prompt, VARIABILITY_PROMPT)
    const valueA = bfInt(numericRange(dataA))
    const valueB = bfInt(numericRange(dataB))
    return { winner: bfCompare(valueA, valueB) < 0 ? 'A' : 'B', valueA, valueB }
  }

  /**
   * Judges one choice against the rendered data. A choice is true only when it
   * names the sample the data actually favours AND attributes the correct
   * statistic to each sample. Values are compared numerically, not as text, so
   * two differently-spelled renderings of the same quantity would still be
   * caught as equivalent.
   */
  const CLAIM_SHAPE = /^Sample ([AB]), with a (?:mean|range) of (.+?) compared to (.+?)\.$/

  function claimIsTrue(choice: string, truth: ComparisonTruth): boolean {
    const m = CLAIM_SHAPE.exec(choice)
    if (!m) return false
    const label = m[1] as 'A' | 'B'
    if (label !== truth.winner) return false
    const claimedOwn = parseMixedNumber(m[2])
    const claimedOther = parseMixedNumber(m[3])
    const actualOwn = label === 'A' ? truth.valueA : truth.valueB
    const actualOther = label === 'A' ? truth.valueB : truth.valueA
    return bfCompare(claimedOwn, actualOwn) === 0 && bfCompare(claimedOther, actualOther) === 0
  }

  /**
   * The choice-text-only adversary. Every rule is a pure function of the
   * shuffled choice strings and returns a choice index, or null to abstain.
   * Chance is 1/4 = 25%; the two rules that used to score 100% are first.
   */
  const onlyIndex = (indices: readonly number[]): number | null =>
    indices.length === 1 ? indices[0] : null
  const indicesWhere = (choices: readonly string[], fn: (choice: string) => boolean): number[] =>
    choices.map((choice, index) => (fn(choice) ? index : -1)).filter((index) => index >= 0)

  function majorityLabel(choices: readonly string[]): 'A' | 'B' | null {
    const a = countWhere(choices, (choice) => labelOf(choice) === 'A')
    const b = countWhere(choices, (choice) => labelOf(choice) === 'B')
    return a === b ? null : a > b ? 'A' : 'B'
  }

  function uniqueBy(choices: readonly string[], keyOf: (choice: string) => string): number | null {
    const keys = choices.map(keyOf)
    const counts = new Map<string, number>()
    for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1)
    const singletons = [...counts.entries()].filter(([, n]) => n === 1).map(([key]) => key)
    return singletons.length === 1 ? keys.indexOf(singletons[0]) : null
  }

  /**
   * LEAK A exactly as it scored 100% on the frozen tree: among the choices that
   * actually quote an ordering, take the one whose ordering no other quoting
   * choice shares. Choices quoting no statistics at all are skipped rather than
   * counted as a category of their own - counting them would have made this rule
   * abstain on the old four-option set, which had two lesser-first choices, one
   * greater-first choice and one "Both samples have the same ..." choice.
   */
  function oddOrderingOut(choices: readonly string[]): number | null {
    const orderings = choices.map(orderingOf)
    const counts = new Map<Ordering, number>()
    for (const ordering of orderings)
      if (ordering !== null) counts.set(ordering, (counts.get(ordering) ?? 0) + 1)
    const singletons = [...counts.entries()].filter(([, n]) => n === 1).map(([ordering]) => ordering)
    return singletons.length === 1 ? orderings.indexOf(singletons[0]) : null
  }

  type ChoiceOnlyRule = readonly [name: string, pick: (choices: readonly string[]) => number | null]

  const CHOICE_ONLY_RULES: readonly ChoiceOnlyRule[] = [
    // The cue this section exists to remove. It must now abstain.
    ['LEAK A: the odd-one-out ordering', oddOrderingOut],
    // Directional rules that never abstain, so they measure the true ceiling.
    ['the unique greater-first choice', (choices) =>
      onlyIndex(indicesWhere(choices, (c) => orderingOf(c) === 'greater-first'))],
    ['the unique lesser-first choice', (choices) =>
      onlyIndex(indicesWhere(choices, (c) => orderingOf(c) === 'lesser-first'))],
    ['earliest greater-first choice', (choices) =>
      indicesWhere(choices, (c) => orderingOf(c) === 'greater-first')[0] ?? null],
    ['earliest lesser-first choice', (choices) =>
      indicesWhere(choices, (c) => orderingOf(c) === 'lesser-first')[0] ?? null],
    ['latest greater-first choice', (choices) => {
      const found = indicesWhere(choices, (c) => orderingOf(c) === 'greater-first')
      return found.length ? found[found.length - 1] : null
    }],
    ['majority label, earliest position', (choices) => {
      const label = majorityLabel(choices)
      return label === null ? null : indicesWhere(choices, (c) => labelOf(c) === label)[0] ?? null
    }],
    ['always Sample A, earliest position', (choices) =>
      indicesWhere(choices, (c) => labelOf(c) === 'A')[0] ?? null],
    // Position.
    ...[0, 1, 2, 3].map(
      (position) => [`always position ${position}`, () => position] as ChoiceOnlyRule,
    ),
    // Lexical shape.
    ['longest choice', (choices) =>
      choices.indexOf(choices.reduce((best, c) => (c.length > best.length ? c : best), choices[0]))],
    ['shortest choice', (choices) =>
      choices.indexOf(choices.reduce((best, c) => (c.length < best.length ? c : best), choices[0]))],
    ['unique choice length', (choices) => uniqueBy(choices, (c) => String(c.length))],
    ['unique word count', (choices) => uniqueBy(choices, (c) => String(c.trim().split(/\s+/).length))],
    ['unique punctuation signature', (choices) => uniqueBy(choices, (c) => (c.match(/[^\w\s]/g) ?? []).join(''))],
    ['unique de-numbered template', (choices) => uniqueBy(choices, (c) => c.replace(QUANTITY_TOKEN, '#'))],
    ['lexicographically first', (choices) => choices.indexOf([...choices].sort()[0])],
    ['the only choice quoting no statistics', (choices) =>
      onlyIndex(indicesWhere(choices, (c) => quantitiesIn(c).length === 0))],
    // Magnitude.
    ['choice holding the largest quantity', (choices) => {
      let best: BigFraction | null = null
      let index = 0
      choices.forEach((choice, i) => {
        for (const q of quantitiesIn(choice))
          if (best === null || bfCompare(q, best) > 0) { best = q; index = i }
      })
      return index
    }],
    ['choice whose first quantity is largest', (choices) => {
      let best: BigFraction | null = null
      let index = 0
      choices.forEach((choice, i) => {
        const q = quantitiesIn(choice)
        if (q.length && (best === null || bfCompare(q[0], best) > 0)) { best = q[0]; index = i }
      })
      return index
    }],
    ['choice whose first quantity is smallest', (choices) => {
      let best: BigFraction | null = null
      let index = 0
      choices.forEach((choice, i) => {
        const q = quantitiesIn(choice)
        if (q.length && (best === null || bfCompare(q[0], best) < 0)) { best = q[0]; index = i }
      })
      return index
    }],
  ]

  /**
   * LEAK B was never an index cue - it identified the keyed SAMPLE, which is the
   * conclusion the item is actually asking for. These rules are therefore scored
   * against the label the keyed choice names, where chance is 1/2, not 1/4.
   */
  type LabelOnlyRule = readonly [name: string, pick: (choices: readonly string[]) => 'A' | 'B' | null]

  const LABEL_ONLY_RULES: readonly LabelOnlyRule[] = [
    ['LEAK B: the majority sample label', majorityLabel],
    ['the minority sample label', (choices) => {
      const majority = majorityLabel(choices)
      return majority === null ? null : majority === 'A' ? 'B' : 'A'
    }],
    ['label of the earliest greater-first choice', (choices) => {
      const found = indicesWhere(choices, (c) => orderingOf(c) === 'greater-first')[0]
      return found === undefined ? null : labelOf(choices[found])
    }],
    ['label of the earliest lesser-first choice', (choices) => {
      const found = indicesWhere(choices, (c) => orderingOf(c) === 'lesser-first')[0]
      return found === undefined ? null : labelOf(choices[found])
    }],
    ['label of the choice holding the largest quantity', (choices) => {
      let best: BigFraction | null = null
      let index = -1
      choices.forEach((choice, i) => {
        for (const quantity of quantitiesIn(choice))
          if (best === null || bfCompare(quantity, best) > 0) { best = quantity; index = i }
      })
      return index < 0 ? null : labelOf(choices[index])
    }],
    ['always Sample A', () => 'A'],
    ['the label at position 0', (choices) => labelOf(choices[0])],
  ]

  /**
   * Rules that must ABSTAIN on every single item, because the structure they
   * key on no longer exists. Named by their entries in the two rule tables.
   */
  const MUST_ALWAYS_ABSTAIN = [
    'LEAK A: the odd-one-out ordering',
    'LEAK B: the majority sample label',
    'the minority sample label',
    'unique choice length',
    'unique word count',
    'unique punctuation signature',
    'unique de-numbered template',
    'the only choice quoting no statistics',
  ] as const

  /**
   * The honest ceiling. The item has exactly two possible conclusions - Sample A
   * or Sample B - and the keyed one is drawn ~50/50 from the data, so a rule
   * that narrows the four choices to one A-claim and one B-claim still has to
   * guess. 50% is therefore the floor for this item shape, not a residual leak:
   * it is the same 50% a learner faces who reads the choices and then has to
   * open the samples to break the tie. What must be gone is any rule that beats
   * it. The band allows for seeded sampling noise around that 50%.
   */
  const CHOICE_ONLY_CEILING = 0.55
  const ADVERSARY_RUNS = 1_500

  interface ComparisonUnderTest {
    itemType: 'compare-two-samples-center' | 'compare-two-samples-variability'
    truthOf: (prompt: string) => ComparisonTruth
    statistic: 'mean' | 'range'
  }

  const COMPARISONS: readonly ComparisonUnderTest[] = [
    { itemType: 'compare-two-samples-center', truthOf: CENTER_TRUTH, statistic: 'mean' },
    { itemType: 'compare-two-samples-variability', truthOf: VARIABILITY_TRUTH, statistic: 'range' },
  ]

  /** Collected so a failure names the first few offending items instead of one anonymous count. */
  const report = (violations: readonly string[]): string[] => violations.slice(0, 8)

  describe.each(COMPARISONS)('$itemType choice construction', (comparison: ComparisonUnderTest) => {
    it('names each sample in exactly two of the four choices, so no label is the majority', () => {
      const violations: string[] = []
      for (const difficulty of DIFFICULTIES) {
        for (let i = 0; i < ADVERSARY_RUNS; i++) {
          const question = generateGrade7MathUnit8Question(comparison.itemType, difficulty)
          const choices = question.choices
          const a = countWhere(choices, (choice) => labelOf(choice) === 'A')
          const b = countWhere(choices, (choice) => labelOf(choice) === 'B')
          if (a !== 2 || b !== 2)
            violations.push(`d${difficulty} #${i}: A named ${a}x, B named ${b}x in ${JSON.stringify(choices)}`)
          else if (majorityLabel(choices) !== null)
            violations.push(`d${difficulty} #${i}: a majority label survives in ${JSON.stringify(choices)}`)
        }
      }
      expect(report(violations), `${comparison.itemType}: ${violations.length} label-balance violations`).toEqual([])
    })

    it('splits the four choices two-and-two by ordering, so the keyed ordering is never unique', () => {
      const violations: string[] = []
      for (const difficulty of DIFFICULTIES) {
        for (let i = 0; i < ADVERSARY_RUNS; i++) {
          const question = generateGrade7MathUnit8Question(comparison.itemType, difficulty)
          const choices = question.choices
          const orderings = choices.map(orderingOf)
          const greaterFirst = countWhere(orderings, (order) => order === 'greater-first')
          const lesserFirst = countWhere(orderings, (order) => order === 'lesser-first')
          if (greaterFirst !== 2 || lesserFirst !== 2) {
            violations.push(
              `d${difficulty} #${i}: ${greaterFirst} greater-first / ${lesserFirst} lesser-first in ${JSON.stringify(choices)}`,
            )
            continue
          }
          const keyedOrdering = orderings[question.answerIndex]
          if (countWhere(orderings, (order) => order === keyedOrdering) !== 2)
            violations.push(`d${difficulty} #${i}: keyed ordering is unique in ${JSON.stringify(choices)}`)
        }
      }
      expect(report(violations), `${comparison.itemType}: ${violations.length} ordering-balance violations`).toEqual([])
    })

    it('crosses label against ordering, so every one of the four cells is filled exactly once', () => {
      const violations: string[] = []
      for (const difficulty of DIFFICULTIES) {
        for (let i = 0; i < ADVERSARY_RUNS; i++) {
          const question = generateGrade7MathUnit8Question(comparison.itemType, difficulty)
          const cells = question.choices.map((choice) => `${labelOf(choice)}/${orderingOf(choice)}`).sort()
          const expected = ['A/greater-first', 'A/lesser-first', 'B/greater-first', 'B/lesser-first']
          if (JSON.stringify(cells) !== JSON.stringify(expected))
            violations.push(`d${difficulty} #${i}: cells were ${JSON.stringify(cells)}`)
        }
      }
      expect(report(violations), `${comparison.itemType}: ${violations.length} 2x2 cell violations`).toEqual([])
    })

    /**
     * Text shape must not single any choice out. Length, word count and
     * punctuation are required to be *identical* across all four, which they can
     * be because the four choices are the same sentence holding the same two
     * numbers in a different arrangement. The de-numbered template cannot be
     * identical - it still spells "Sample A" or "Sample B" - so the requirement
     * there is the weaker but sufficient one: it splits two and two, so no
     * template is unique to one choice.
     */
    it('gives no choice a distinguishing length, word count, punctuation or template', () => {
      const violations: string[] = []
      const identical = ['length', 'words', 'punctuation'] as const
      for (const difficulty of DIFFICULTIES) {
        for (let i = 0; i < ADVERSARY_RUNS; i++) {
          const { choices } = generateGrade7MathUnit8Question(comparison.itemType, difficulty)
          const shapes: Record<string, string[]> = {
            length: choices.map((choice) => String(choice.length)),
            words: choices.map((choice) => String(choice.trim().split(/\s+/).length)),
            punctuation: choices.map((choice) => (choice.match(/[^\w\s]/g) ?? []).join('')),
          }
          for (const feature of identical)
            if (new Set(shapes[feature]).size !== 1)
              violations.push(`d${difficulty} #${i}: ${feature} varies across ${JSON.stringify(choices)}`)

          const templates = choices.map((choice) => choice.replace(QUANTITY_TOKEN, '#'))
          const perTemplate = [...new Set(templates)].map(
            (template) => countWhere(templates, (candidate) => candidate === template),
          )
          if (perTemplate.length !== 2 || perTemplate.some((count) => count !== 2))
            violations.push(`d${difficulty} #${i}: templates split ${perTemplate} in ${JSON.stringify(choices)}`)
        }
      }
      expect(report(violations), `${comparison.itemType}: ${violations.length} choice-shape violations`).toEqual([])
    })

    it('leaves exactly one choice true against the rendered data, with no equivalent second', () => {
      const violations: string[] = []
      for (const difficulty of DIFFICULTIES) {
        for (let i = 0; i < ADVERSARY_RUNS; i++) {
          const question = generateGrade7MathUnit8Question(comparison.itemType, difficulty)
          const truth = comparison.truthOf(question.prompt)
          const trueIndices = indicesWhere(question.choices, (choice) => claimIsTrue(choice, truth))
          const context = `d${difficulty} #${i}: ${JSON.stringify(question.choices)}`
          if (trueIndices.length !== 1) violations.push(`${context} had ${trueIndices.length} true choices`)
          else if (trueIndices[0] !== question.answerIndex)
            violations.push(`${context} keys index ${question.answerIndex} but the data favours ${trueIndices[0]}`)
          if (new Set(question.choices).size !== question.choices.length)
            violations.push(`${context} contains a duplicate choice`)
          if (question.choices.length !== 4) violations.push(`${context} has ${question.choices.length} choices`)
          for (const choice of question.choices)
            if (!CLAIM_SHAPE.test(choice)) violations.push(`${context} has an off-template choice "${choice}"`)
        }
      }
      expect(report(violations), `${comparison.itemType}: ${violations.length} exactly-one-correct violations`).toEqual([])
    })

    it('leaves no choice-text-only rule ahead of the two-way conclusion prior', () => {
      const byIndex = CHOICE_ONLY_RULES.map(() => ({ hit: 0, abstain: 0, seen: 0 }))
      const byLabel = LABEL_ONLY_RULES.map(() => ({ hit: 0, abstain: 0, seen: 0 }))
      for (const difficulty of DIFFICULTIES) {
        for (let i = 0; i < ADVERSARY_RUNS; i++) {
          const question = generateGrade7MathUnit8Question(comparison.itemType, difficulty)
          // The adversary is handed the choice strings and nothing else.
          const choices: readonly string[] = [...question.choices]
          const keyedLabel = labelOf(question.choices[question.answerIndex])
          CHOICE_ONLY_RULES.forEach(([, pick], rule) => {
            const chosen = pick(choices)
            byIndex[rule].seen += 1
            if (chosen === null) byIndex[rule].abstain += 1
            else if (chosen === question.answerIndex) byIndex[rule].hit += 1
          })
          LABEL_ONLY_RULES.forEach(([, pick], rule) => {
            const chosen = pick(choices)
            byLabel[rule].seen += 1
            if (chosen === null) byLabel[rule].abstain += 1
            else if (chosen === keyedLabel) byLabel[rule].hit += 1
          })
        }
      }

      const tooStrong: string[] = []
      const resolved: string[] = []
      const score = (name: string, tally: { hit: number; abstain: number; seen: number }): void => {
        const rate = tally.hit / tally.seen
        if (rate > CHOICE_ONLY_CEILING)
          tooStrong.push(`${name}: ${(rate * 100).toFixed(2)}% of ${tally.seen} (ceiling ${CHOICE_ONLY_CEILING * 100}%)`)
        if ((MUST_ALWAYS_ABSTAIN as readonly string[]).includes(name) && tally.abstain !== tally.seen)
          resolved.push(`${name}: resolved ${tally.seen - tally.abstain} of ${tally.seen} items instead of abstaining`)
      }
      CHOICE_ONLY_RULES.forEach(([name], rule) => score(name, byIndex[rule]))
      LABEL_ONLY_RULES.forEach(([name], rule) => score(name, byLabel[rule]))

      expect(tooStrong, `${comparison.itemType}: a choice-text-only rule beat the two-way prior`).toEqual([])
      expect(resolved, `${comparison.itemType}: a retired cue still resolves`).toEqual([])
    })
  })
})
