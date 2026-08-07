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
})
