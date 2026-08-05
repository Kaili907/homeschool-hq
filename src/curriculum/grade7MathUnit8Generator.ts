import type { Difficulty } from '../types'
import { pick, ri } from '../genUtils'
import {
  makeCurriculumQuestion,
  type CurriculumGenerator,
  type CurriculumQuestion,
  type CurriculumWorkedExample,
} from './generatorCore'

/**
 * Coverage contract derived from Grade 7 Mathematics Unit 8, course days
 * 127-144, its 18 lesson records, and standards 7.SP.1-7.SP.4.
 */
export const GRADE7_MATH_UNIT8_ITEM_TYPES = [
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

export type Grade7MathUnit8ItemType = (typeof GRADE7_MATH_UNIT8_ITEM_TYPES)[number]

/**
 * Every rational in this unit (sample proportions, means, mean absolute
 * deviations, and MAD-multiples) is carried as an exact integer
 * numerator/denominator pair, reduced by the gcd after every operation. No
 * binary floating point is ever used: means and MAD values that do not divide
 * evenly are reported as exact fractions or mixed numbers, never rounded
 * decimals.
 */
export interface Fraction {
  num: number
  den: number
}

interface PopulationVsSampleParameters {
  totalSize: number
  sampleSize: number
  subject: string
  askAbout: 'population' | 'sample'
}

type SamplingMethodKey = 'random' | 'convenience' | 'voluntary' | 'systematic'

interface SamplingMethodParameters {
  methodKey: SamplingMethodKey
  n: number
  subject: string
}

interface ProportionEstimateParameters {
  sampleSize: number
  sampleCount: number
  populationSize: number
  subject: string
  trait: string
}

interface EstimateVariationParameters {
  estimates: number[]
}

interface SampleSizeParameters {
  smallSize: number
  largeSize: number
  populationSize: number
  subject: string
}

type GeneralizationMethodKey = 'random' | 'convenience'

interface GeneralizationValidityParameters {
  methodKey: GeneralizationMethodKey
  sampleSize: number
  populationSize: number
  subject: string
}

interface CenterMeasuresParameters {
  data: number[]
  ask: 'mean' | 'median' | 'range'
}

interface OutlierMeanParameters {
  values: number[]
  outlier: number
}

interface MadParameters {
  data: number[]
  mean: number
}

interface OverlapParameters {
  meanA: number
  meanB: number
  mad: Fraction
}

interface TwoSampleParameters {
  dataA: number[]
  dataB: number[]
}

type Unit8Question<TItemType extends Grade7MathUnit8ItemType, TParameters> =
  CurriculumQuestion<TItemType, TParameters>

export type Grade7MathUnit8Question =
  | Unit8Question<'identify-population-vs-sample', PopulationVsSampleParameters>
  | Unit8Question<'sampling-method-bias-analysis', SamplingMethodParameters>
  | Unit8Question<'estimate-population-from-sample-proportion', ProportionEstimateParameters>
  | Unit8Question<'sample-estimate-variation-range', EstimateVariationParameters>
  | Unit8Question<'sample-size-representativeness', SampleSizeParameters>
  | Unit8Question<'generalization-validity-check', GeneralizationValidityParameters>
  | Unit8Question<'compute-mean-median-range', CenterMeasuresParameters>
  | Unit8Question<'mean-vs-median-with-outlier', OutlierMeanParameters>
  | Unit8Question<'compute-mean-absolute-deviation', MadParameters>
  | Unit8Question<'visual-overlap-in-mad-units', OverlapParameters>
  | Unit8Question<'compare-two-samples-center', TwoSampleParameters>
  | Unit8Question<'compare-two-samples-variability', TwoSampleParameters>

type Unit8Standard = '7.SP.1' | '7.SP.2' | '7.SP.3' | '7.SP.4'

interface ItemDefinition {
  standard: Unit8Standard
  lessonFocus:
    | 'populations and samples'
    | 'random sampling'
    | 'representative samples'
    | 'measures of center'
    | 'variability and overlap'
    | 'informal comparative inference'
  workedExample: CurriculumWorkedExample
}

export const GRADE7_MATH_UNIT8_ITEM_DEFINITIONS = {
  'identify-population-vs-sample': {
    standard: '7.SP.1',
    lessonFocus: 'populations and samples',
    workedExample: {
      prompt:
        'A researcher wants to know about all 400 students at Lincoln Middle School. She randomly selects 40 of them to survey. What is the sample in this situation?',
      answer: 'The 40 randomly selected students at Lincoln Middle School',
      steps: [
        'The population is every member of the group being studied: all 400 students.',
        'The sample is the subset actually surveyed: the 40 randomly selected students.',
      ],
    },
  },
  'sampling-method-bias-analysis': {
    standard: '7.SP.1',
    lessonFocus: 'random sampling',
    workedExample: {
      prompt:
        'A student wants to know the favorite lunch food of her whole school. She only surveys the 10 friends at her lunch table. Is this method likely to produce a representative sample?',
      answer:
        'No, likely not representative — the method favors certain members over others.',
      steps: [
        'The sample is limited to friends at one table, a convenience sample.',
        'Convenience samples are not randomly selected, so some students have no chance of being chosen.',
        "Because the selection isn't random, the sample likely does not represent the whole school.",
      ],
    },
  },
  'estimate-population-from-sample-proportion': {
    standard: '7.SP.2',
    lessonFocus: 'random sampling',
    workedExample: {
      prompt:
        'In a random sample of 20 students, 8 preferred pizza. Based on this sample, about how many of the 200 students in the school would you expect to prefer pizza?',
      answer: '80',
      steps: [
        'Find the sample proportion: 8 out of 20 preferred pizza.',
        'Scale up to the population: the school is 200 ÷ 20 = 10 times the sample size.',
        'Multiply: 8 × 10 = 80 students.',
      ],
    },
  },
  'sample-estimate-variation-range': {
    standard: '7.SP.2',
    lessonFocus: 'representative samples',
    workedExample: {
      prompt:
        'Five random samples of the same population produced these mean scores: 72, 75, 68, 74, 71. What is the range of these sample estimates?',
      answer: '7',
      steps: [
        'Find the greatest estimate: 75.',
        'Find the least estimate: 68.',
        'Subtract: 75 − 68 = 7.',
      ],
    },
  },
  'sample-size-representativeness': {
    standard: '7.SP.2',
    lessonFocus: 'representative samples',
    workedExample: {
      prompt:
        'A population has 500 students. Student A takes a random sample of 10. Student B takes a random sample of 50. Both use proper random selection. Whose sample is more likely to give an estimate closer to the true population value?',
      answer: "Student B's sample of 50, because larger random samples tend to produce more consistent, accurate estimates.",
      steps: [
        'Both samples are random, so neither is biased by the selection method.',
        'A larger random sample generally has less variability between repeated samples.',
        "Student B's sample of 50 is larger than Student A's sample of 10, so it is more likely to be closer to the true population value.",
      ],
    },
  },
  'generalization-validity-check': {
    standard: '7.SP.1',
    lessonFocus: 'populations and samples',
    workedExample: {
      prompt:
        'A student surveys 30 students using a convenience sample of her classmates only and records the results. Is it valid to generalize this result to all 600 students at the school?',
      answer: 'No, because the sample was not randomly selected, so it may not represent the population.',
      steps: [
        'Generalizing to a population is valid only when the sample is representative.',
        'A convenience sample of classmates only is not randomly selected from the whole school.',
        'Because the sample may be biased, the result should not be generalized to all 600 students.',
      ],
    },
  },
  'compute-mean-median-range': {
    standard: '7.SP.4',
    lessonFocus: 'measures of center',
    workedExample: {
      prompt: 'A sample of 5 values is: 12, 15, 18, 20, 25. What is the mean of this data set?',
      answer: '18',
      steps: [
        'Add all the values: 12 + 15 + 18 + 20 + 25 = 90.',
        'Divide by the number of values: 90 ÷ 5 = 18.',
      ],
    },
  },
  'mean-vs-median-with-outlier': {
    standard: '7.SP.4',
    lessonFocus: 'measures of center',
    workedExample: {
      prompt:
        'A data set has 4 values: 10, 12, 11, 13. What is the new mean if an outlier of 40 is added to the data set, making 5 values in all?',
      answer: '17 1/5',
      steps: [
        'Find the sum of the original 4 values: 10 + 12 + 11 + 13 = 46.',
        'Add the outlier: 46 + 40 = 86.',
        'Divide by the new count of values: 86 ÷ 5 = 17 1/5.',
      ],
    },
  },
  'compute-mean-absolute-deviation': {
    standard: '7.SP.3',
    lessonFocus: 'variability and overlap',
    workedExample: {
      prompt: 'A data set is: 17, 25, 16, 22, with a mean of 20. What is the mean absolute deviation (MAD) of this data set?',
      answer: '3 1/2',
      steps: [
        'Find each value\'s distance from the mean: |17-20| = 3, |25-20| = 5, |16-20| = 4, |22-20| = 2.',
        'Add the distances: 3 + 5 + 4 + 2 = 14.',
        'Divide by the number of values: 14 ÷ 4 = 3 1/2.',
      ],
    },
  },
  'visual-overlap-in-mad-units': {
    standard: '7.SP.3',
    lessonFocus: 'variability and overlap',
    workedExample: {
      prompt:
        'Two data sets have means of 30 and 42. Their mean absolute deviation (MAD) is 4. Express the difference between the means as a multiple of the MAD.',
      answer: '3 times the MAD',
      steps: [
        'Find the difference between the means: 42 − 30 = 12.',
        'Divide by the MAD: 12 ÷ 4 = 3.',
        'The means differ by 3 times the MAD.',
      ],
    },
  },
  'compare-two-samples-center': {
    standard: '7.SP.4',
    lessonFocus: 'informal comparative inference',
    workedExample: {
      prompt: 'Sample A: 20, 22, 21, 23. Sample B: 15, 17, 16, 14. Based on the means, which sample tends to have greater values?',
      answer: 'Sample A, with a mean of 21 1/2 compared to 15 1/2.',
      steps: [
        'Find the mean of Sample A: (20 + 22 + 21 + 23) ÷ 4 = 86 ÷ 4 = 21 1/2.',
        'Find the mean of Sample B: (15 + 17 + 16 + 14) ÷ 4 = 62 ÷ 4 = 15 1/2.',
        'Since 21 1/2 > 15 1/2, Sample A tends to have greater values.',
      ],
    },
  },
  'compare-two-samples-variability': {
    standard: '7.SP.4',
    lessonFocus: 'informal comparative inference',
    workedExample: {
      prompt: 'Sample A: 10, 12, 11, 13. Sample B: 5, 20, 8, 15. Based on the range of each sample, which sample is more consistent (less variable)?',
      answer: 'Sample A, with a range of 3 compared to 15.',
      steps: [
        'Find the range of Sample A: 13 − 10 = 3.',
        'Find the range of Sample B: 20 − 5 = 15.',
        'Since 3 < 15, Sample A is more consistent (less variable).',
      ],
    },
  },
} as const satisfies Record<Grade7MathUnit8ItemType, ItemDefinition>

// ---------- exact-rational helpers ----------

function intF(n: number): Fraction {
  return { num: n, den: 1 }
}

function gcdExact(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) {
    ;[x, y] = [y, x % y]
  }
  return x || 1
}

function reduceFraction(f: Fraction): Fraction {
  const sign = f.den < 0 ? -1 : 1
  const num = f.num * sign
  const den = Math.abs(f.den)
  if (num === 0) return { num: 0, den: 1 }
  const divisor = gcdExact(num, den)
  return { num: num / divisor, den: den / divisor }
}

function mulFraction(a: Fraction, b: Fraction): Fraction {
  return reduceFraction({ num: a.num * b.num, den: a.den * b.den })
}

function subFraction(a: Fraction, b: Fraction): Fraction {
  return reduceFraction({ num: a.num * b.den - b.num * a.den, den: a.den * b.den })
}

/** Mixed-number text for measurements: 17/2 -> "8 1/2", 8 -> "8". Assumes non-negative input. */
function mixedText(f: Fraction): string {
  const r = reduceFraction(f)
  if (r.den === 1) return String(r.num)
  const whole = Math.floor(r.num / r.den)
  const remainder = r.num - whole * r.den
  if (whole === 0) return `${remainder}/${r.den}`
  return remainder === 0 ? String(whole) : `${whole} ${remainder}/${r.den}`
}

function withFallback(correct: Fraction, candidates: Fraction[]): Fraction[] {
  const d = correct.den
  return [
    ...candidates,
    { num: correct.num + d, den: d },
    { num: correct.num + 2 * d, den: d },
    { num: correct.num + 3 * d, den: d },
    { num: Math.max(0, correct.num - d), den: d },
  ]
}

function fractionChoiceTexts(
  correct: Fraction,
  candidates: Fraction[],
  textFn: (f: Fraction) => string,
): string[] {
  const correctText = textFn(correct)
  const seen = new Set<string>([correctText])
  const result: string[] = []
  for (const candidate of candidates) {
    if (candidate.num < 0) continue
    const text = textFn(reduceFraction(candidate))
    if (!seen.has(text)) {
      seen.add(text)
      result.push(text)
    }
  }
  return result
}

function withIntFallback(correct: number, candidates: number[]): number[] {
  return [...candidates, correct + 1, correct + 2, correct + 3, Math.max(1, correct - 1)]
}

function integerChoiceTexts(correct: number, candidates: number[]): string[] {
  const correctText = String(correct)
  const seen = new Set<string>([correctText])
  const result: string[] = []
  for (const candidate of candidates) {
    if (candidate < 0) continue
    const text = String(candidate)
    if (!seen.has(text)) {
      seen.add(text)
      result.push(text)
    }
  }
  return result
}

function mean(data: number[]): Fraction {
  return reduceFraction({ num: data.reduce((sum, v) => sum + v, 0), den: data.length })
}

function median(data: number[]): Fraction {
  const sorted = [...data].sort((a, b) => a - b)
  const n = sorted.length
  const mid = Math.floor(n / 2)
  if (n % 2 === 1) return intF(sorted[mid])
  return reduceFraction({ num: sorted[mid - 1] + sorted[mid], den: 2 })
}

function range(data: number[]): number {
  return Math.max(...data) - Math.min(...data)
}

const SUBJECTS = [
  'students at Lincoln Middle School',
  'shoppers at a grocery store',
  'visitors to a science museum',
  'commuters on a train line',
] as const

const TRAITS = ['a new snack flavor', 'a proposed schedule change', 'a new park design', 'an extended weekend event'] as const

// ---------- random parameter builders ----------

function randomPopulationVsSample(difficulty: Difficulty): PopulationVsSampleParameters {
  const subject = pick(SUBJECTS)
  const askAbout = pick(['population', 'sample'] as const)
  const totalSize = difficulty === 1 ? ri(50, 200) : difficulty === 2 ? ri(200, 600) : ri(500, 2000)
  const sampleSize = ri(5, Math.floor(totalSize / 4))
  return { totalSize, sampleSize, subject, askAbout }
}

const METHOD_KEYS: readonly SamplingMethodKey[] = ['random', 'convenience', 'voluntary', 'systematic']

function methodScenarioText(methodKey: SamplingMethodKey, n: number, subject: string): string {
  switch (methodKey) {
    case 'random':
      return `A student uses a random number generator to select ${n} ${subject} from the full list, then surveys them.`
    case 'convenience':
      return `A student surveys the ${n} ${subject} sitting closest to her.`
    case 'voluntary':
      return `A student posts an online form, and ${n} ${subject} choose to respond.`
    case 'systematic':
      return `A student picks a random starting point, then surveys every 10th person from the full numbered list of ${subject}, for a total of ${n}.`
  }
}

function isRepresentativeMethod(methodKey: SamplingMethodKey): boolean {
  return methodKey === 'random' || methodKey === 'systematic'
}

function methodVerdictText(representative: boolean): string {
  return representative
    ? 'Yes, likely representative — every member had a fair, known chance of being chosen.'
    : 'No, likely not representative — the method favors certain members over others.'
}

function randomSamplingMethod(difficulty: Difficulty): SamplingMethodParameters {
  const methodKey = pick(METHOD_KEYS)
  const subject = pick(SUBJECTS)
  const n = difficulty === 1 ? ri(5, 15) : difficulty === 2 ? ri(15, 40) : ri(30, 80)
  return { methodKey, n, subject }
}

function randomProportionEstimate(difficulty: Difficulty): ProportionEstimateParameters {
  const subject = pick(SUBJECTS)
  const trait = pick(TRAITS)
  const sampleSize = difficulty === 1 ? ri(4, 10) : difficulty === 2 ? ri(10, 25) : ri(15, 40)
  const scale = difficulty === 1 ? ri(2, 5) : difficulty === 2 ? ri(3, 8) : ri(4, 12)
  const populationSize = sampleSize * scale
  const sampleCount = ri(1, sampleSize - 1)
  return { sampleSize, sampleCount, populationSize, subject, trait }
}

function randomEstimateVariation(difficulty: Difficulty): EstimateVariationParameters {
  const count = difficulty === 1 ? 4 : 5
  const base = difficulty === 1 ? ri(5, 15) : difficulty === 2 ? ri(8, 25) : ri(10, 40)
  const spread = difficulty === 1 ? ri(2, 6) : difficulty === 2 ? ri(3, 10) : ri(4, 15)
  const estimates = Array.from({ length: count }, () => base + ri(-spread, spread))
  if (new Set(estimates).size === 1) estimates[0] += 1
  return { estimates }
}

function randomSampleSize(difficulty: Difficulty): SampleSizeParameters {
  const subject = pick(SUBJECTS)
  const populationSize = difficulty === 1 ? ri(200, 500) : difficulty === 2 ? ri(500, 1500) : ri(1000, 5000)
  const smallSize = ri(5, 20)
  const largeSize = smallSize + ri(15, 60)
  return { smallSize, largeSize, populationSize, subject }
}

const GENERALIZATION_METHOD_TEXT: Record<GeneralizationMethodKey, string> = {
  random: 'a simple random sample',
  convenience: 'a convenience sample of her classmates only',
}

function randomGeneralizationValidity(difficulty: Difficulty): GeneralizationValidityParameters {
  const methodKey = pick(['random', 'convenience'] as const)
  const subject = pick(SUBJECTS)
  const sampleSize = difficulty === 1 ? ri(10, 30) : difficulty === 2 ? ri(20, 60) : ri(30, 100)
  const populationSize = sampleSize * (difficulty === 1 ? ri(10, 20) : difficulty === 2 ? ri(15, 30) : ri(20, 50))
  return { methodKey, sampleSize, populationSize, subject }
}

function randomDataSet(difficulty: Difficulty): number[] {
  const n = difficulty === 1 ? 5 : difficulty === 2 ? 6 : 7
  const base = difficulty === 1 ? ri(10, 30) : difficulty === 2 ? ri(15, 50) : ri(20, 80)
  const spread = difficulty === 1 ? ri(3, 8) : difficulty === 2 ? ri(5, 15) : ri(8, 25)
  return Array.from({ length: n }, () => base + ri(-spread, spread))
}

function randomOutlierSet(difficulty: Difficulty): OutlierMeanParameters {
  const n = difficulty === 1 ? 4 : difficulty === 2 ? 5 : 6
  const base = difficulty === 1 ? ri(10, 20) : difficulty === 2 ? ri(15, 30) : ri(20, 40)
  const spread = ri(2, 5)
  const values = Array.from({ length: n }, () => base + ri(-spread, spread))
  const outlierOffset = difficulty === 1 ? ri(20, 30) : difficulty === 2 ? ri(25, 45) : ri(30, 60)
  const outlier = base + outlierOffset
  return { values, outlier }
}

function randomZeroSumDeviations(n: number, difficulty: Difficulty): number[] {
  const bound = difficulty === 1 ? 6 : difficulty === 2 ? 10 : 14
  const devs: number[] = []
  let sum = 0
  for (let i = 0; i < n - 1; i++) {
    const d = ri(-bound, bound)
    devs.push(d)
    sum += d
  }
  devs.push(-sum)
  return devs
}

function randomMadSet(difficulty: Difficulty): MadParameters {
  const n = difficulty === 1 ? 4 : 5
  const meanValue = difficulty === 1 ? ri(10, 20) : difficulty === 2 ? ri(15, 30) : ri(20, 40)
  const devs = randomZeroSumDeviations(n, difficulty)
  const data = devs.map((d) => meanValue + d)
  return { data, mean: meanValue }
}

function randomOverlapSet(difficulty: Difficulty): OverlapParameters {
  const meanA = difficulty === 1 ? ri(20, 40) : difficulty === 2 ? ri(30, 60) : ri(40, 90)
  const gap = difficulty === 1 ? ri(4, 12) : difficulty === 2 ? ri(6, 20) : ri(8, 30)
  const meanB = meanA + gap
  const mad = difficulty === 3 ? reduceFraction({ num: ri(3, 15), den: 2 }) : intF(difficulty === 1 ? ri(2, 6) : ri(2, 10))
  return { meanA, meanB, mad }
}

function randomTwoSamplesByMean(difficulty: Difficulty): TwoSampleParameters {
  const n = difficulty === 1 ? 4 : difficulty === 2 ? 5 : 6
  const centerA = difficulty === 1 ? ri(15, 30) : difficulty === 2 ? ri(20, 45) : ri(25, 60)
  const gap = difficulty === 1 ? ri(6, 15) : difficulty === 2 ? ri(8, 20) : ri(10, 30)
  const centerB = centerA + gap
  const dataA = randomZeroSumDeviations(n, difficulty).map((d) => centerA + d)
  const dataB = randomZeroSumDeviations(n, difficulty).map((d) => centerB + d)
  return { dataA, dataB }
}

function randomTwoSamplesByRange(difficulty: Difficulty): TwoSampleParameters {
  const n = difficulty === 1 ? 4 : difficulty === 2 ? 5 : 6
  const base = difficulty === 1 ? ri(10, 25) : difficulty === 2 ? ri(15, 40) : ri(20, 55)
  const tightSpread = difficulty === 1 ? ri(1, 3) : difficulty === 2 ? ri(2, 4) : ri(2, 5)
  const wideSpread = tightSpread + (difficulty === 1 ? ri(4, 8) : difficulty === 2 ? ri(6, 12) : ri(8, 18))
  const tight = Array.from({ length: n }, () => base + ri(-tightSpread, tightSpread))
  const wide = Array.from({ length: n }, () => base + ri(-wideSpread, wideSpread))
  const dataA = pick([true, false]) ? tight : wide
  const dataB = dataA === tight ? wide : tight
  if (range(dataA) === range(dataB)) return randomTwoSamplesByRange(difficulty)
  return { dataA, dataB }
}

// ---------- generators ----------

export function generateIdentifyPopulationVsSampleQuestion(
  difficulty: Difficulty,
): Unit8Question<'identify-population-vs-sample', PopulationVsSampleParameters> {
  const { totalSize, sampleSize, subject, askAbout } = randomPopulationVsSample(difficulty)
  const populationText = `All ${totalSize} ${subject}`
  const sampleText = `The ${sampleSize} randomly selected ${subject}`
  const correctAnswer = askAbout === 'population' ? populationText : sampleText
  const distractors = [
    askAbout === 'population' ? sampleText : populationText,
    `Only the first ${Math.min(sampleSize, totalSize)} ${subject} on a list`,
    "The researcher's own estimate",
  ]
  const definition = GRADE7_MATH_UNIT8_ITEM_DEFINITIONS['identify-population-vs-sample']
  return makeCurriculumQuestion({
    itemType: 'identify-population-vs-sample',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A researcher wants to know about all ${totalSize} ${subject}. She randomly selects ${sampleSize} of them to survey. What is the ${askAbout} in this situation?`,
    correctAnswer,
    distractors,
    parameters: { totalSize, sampleSize, subject, askAbout },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateSamplingMethodBiasAnalysisQuestion(
  difficulty: Difficulty,
): Unit8Question<'sampling-method-bias-analysis', SamplingMethodParameters> {
  const { methodKey, n, subject } = randomSamplingMethod(difficulty)
  const representative = isRepresentativeMethod(methodKey)
  const correctAnswer = methodVerdictText(representative)
  const distractors = [
    methodVerdictText(!representative),
    'Yes, likely representative, because the sample size is large enough.',
    'No, likely not representative, because the population is too large.',
  ].filter((text) => text !== correctAnswer)
  const definition = GRADE7_MATH_UNIT8_ITEM_DEFINITIONS['sampling-method-bias-analysis']
  return makeCurriculumQuestion({
    itemType: 'sampling-method-bias-analysis',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `${methodScenarioText(methodKey, n, subject)} Is this sampling method likely to produce a representative sample?`,
    correctAnswer,
    distractors: [...new Set(distractors)],
    parameters: { methodKey, n, subject },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateEstimatePopulationFromSampleProportionQuestion(
  difficulty: Difficulty,
): Unit8Question<'estimate-population-from-sample-proportion', ProportionEstimateParameters> {
  const { sampleSize, sampleCount, populationSize, subject, trait } = randomProportionEstimate(difficulty)
  const correct = (sampleCount * populationSize) / sampleSize
  const definition = GRADE7_MATH_UNIT8_ITEM_DEFINITIONS['estimate-population-from-sample-proportion']
  return makeCurriculumQuestion({
    itemType: 'estimate-population-from-sample-proportion',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `In a random sample of ${sampleSize} ${subject}, ${sampleCount} preferred ${trait}. Based on this sample, about how many of the ${populationSize} ${subject} would you expect to prefer ${trait}?`,
    correctAnswer: String(correct),
    distractors: integerChoiceTexts(correct, withIntFallback(correct, [sampleCount, populationSize - correct, sampleCount * sampleSize])),
    parameters: { sampleSize, sampleCount, populationSize, subject, trait },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateSampleEstimateVariationRangeQuestion(
  difficulty: Difficulty,
): Unit8Question<'sample-estimate-variation-range', EstimateVariationParameters> {
  const { estimates } = randomEstimateVariation(difficulty)
  const correct = Math.max(...estimates) - Math.min(...estimates)
  const countWord = estimates.length === 4 ? 'Four' : 'Five'
  const definition = GRADE7_MATH_UNIT8_ITEM_DEFINITIONS['sample-estimate-variation-range']
  return makeCurriculumQuestion({
    itemType: 'sample-estimate-variation-range',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `${countWord} random samples of the same population produced these mean scores: ${estimates.join(', ')}. What is the range of these sample estimates?`,
    correctAnswer: String(correct),
    distractors: integerChoiceTexts(
      correct,
      withIntFallback(correct, [Math.max(...estimates), Math.min(...estimates), estimates.reduce((sum, v) => sum + v, 0)]),
    ),
    parameters: { estimates },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateSampleSizeRepresentativenessQuestion(
  difficulty: Difficulty,
): Unit8Question<'sample-size-representativeness', SampleSizeParameters> {
  const { smallSize, largeSize, populationSize, subject } = randomSampleSize(difficulty)
  const correctAnswer = `Student B's sample of ${largeSize}, because larger random samples tend to produce more consistent, accurate estimates.`
  const distractors = [
    `Student A's sample of ${smallSize}, because smaller samples are easier to analyze.`,
    'Both are equally likely to be accurate, because both are random.',
    'Neither sample is reliable unless it includes the entire population.',
  ]
  const definition = GRADE7_MATH_UNIT8_ITEM_DEFINITIONS['sample-size-representativeness']
  return makeCurriculumQuestion({
    itemType: 'sample-size-representativeness',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A population has ${populationSize} ${subject}. Student A takes a random sample of ${smallSize}. Student B takes a random sample of ${largeSize}. Both use proper random selection. Whose sample is more likely to give an estimate closer to the true population value?`,
    correctAnswer,
    distractors,
    parameters: { smallSize, largeSize, populationSize, subject },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateGeneralizationValidityCheckQuestion(
  difficulty: Difficulty,
): Unit8Question<'generalization-validity-check', GeneralizationValidityParameters> {
  const { methodKey, sampleSize, populationSize, subject } = randomGeneralizationValidity(difficulty)
  const correctAnswer =
    methodKey === 'random'
      ? 'Yes, because the sample was selected randomly, so it is likely representative of the population.'
      : 'No, because the sample was not randomly selected, so it may not represent the population.'
  const distractors = [
    methodKey === 'random'
      ? 'No, because the sample was not randomly selected, so it may not represent the population.'
      : 'Yes, because the sample was selected randomly, so it is likely representative of the population.',
    'Yes, because the sample size is large enough regardless of how it was chosen.',
    'No, because samples can never be generalized to a population.',
  ]
  const definition = GRADE7_MATH_UNIT8_ITEM_DEFINITIONS['generalization-validity-check']
  return makeCurriculumQuestion({
    itemType: 'generalization-validity-check',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A student surveys ${sampleSize} ${subject} using ${GENERALIZATION_METHOD_TEXT[methodKey]} and records the results. Is it valid to generalize this result to all ${populationSize} ${subject}?`,
    correctAnswer,
    distractors,
    parameters: { methodKey, sampleSize, populationSize, subject },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateComputeMeanMedianRangeQuestion(
  difficulty: Difficulty,
): Unit8Question<'compute-mean-median-range', CenterMeasuresParameters> {
  const data = randomDataSet(difficulty)
  const ask = pick(['mean', 'median', 'range'] as const)
  const meanValue = mean(data)
  const medianValue = median(data)
  const rangeValue = range(data)
  const definition = GRADE7_MATH_UNIT8_ITEM_DEFINITIONS['compute-mean-median-range']
  if (ask === 'range') {
    return makeCurriculumQuestion({
      itemType: 'compute-mean-median-range',
      standard: definition.standard,
      lessonFocus: definition.lessonFocus,
      difficulty,
      prompt: `A sample of ${data.length} values is: ${data.join(', ')}. What is the range of this data set?`,
      correctAnswer: String(rangeValue),
      distractors: integerChoiceTexts(rangeValue, withIntFallback(rangeValue, [Math.max(...data), Math.min(...data)])),
      parameters: { data, ask },
      workedExample: definition.workedExample,
      distractorMode: 'distinct',
    })
  }
  const correct = ask === 'mean' ? meanValue : medianValue
  const other = ask === 'mean' ? medianValue : meanValue
  return makeCurriculumQuestion({
    itemType: 'compute-mean-median-range',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A sample of ${data.length} values is: ${data.join(', ')}. What is the ${ask} of this data set?`,
    correctAnswer: mixedText(correct),
    distractors: fractionChoiceTexts(
      correct,
      withFallback(correct, [other, intF(data.reduce((sum, v) => sum + v, 0)), intF(Math.max(...data))]),
      mixedText,
    ),
    parameters: { data, ask },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateMeanVsMedianWithOutlierQuestion(
  difficulty: Difficulty,
): Unit8Question<'mean-vs-median-with-outlier', OutlierMeanParameters> {
  const { values, outlier } = randomOutlierSet(difficulty)
  const meanWithout = mean(values)
  const meanWith = reduceFraction({
    num: values.reduce((sum, v) => sum + v, 0) + outlier,
    den: values.length + 1,
  })
  const definition = GRADE7_MATH_UNIT8_ITEM_DEFINITIONS['mean-vs-median-with-outlier']
  return makeCurriculumQuestion({
    itemType: 'mean-vs-median-with-outlier',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A data set has ${values.length} values: ${values.join(', ')}. What is the new mean if an outlier of ${outlier} is added to the data set, making ${values.length + 1} values in all?`,
    correctAnswer: mixedText(meanWith),
    distractors: fractionChoiceTexts(
      meanWith,
      withFallback(meanWith, [
        meanWithout,
        reduceFraction({ num: values.reduce((sum, v) => sum + v, 0) + outlier, den: values.length }),
      ]),
      mixedText,
    ),
    parameters: { values, outlier },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateComputeMeanAbsoluteDeviationQuestion(
  difficulty: Difficulty,
): Unit8Question<'compute-mean-absolute-deviation', MadParameters> {
  const { data, mean: meanValue } = randomMadSet(difficulty)
  const sumAbsDev = data.reduce((sum, v) => sum + Math.abs(v - meanValue), 0)
  const mad = reduceFraction({ num: sumAbsDev, den: data.length })
  const definition = GRADE7_MATH_UNIT8_ITEM_DEFINITIONS['compute-mean-absolute-deviation']
  return makeCurriculumQuestion({
    itemType: 'compute-mean-absolute-deviation',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A data set is: ${data.join(', ')}, with a mean of ${meanValue}. What is the mean absolute deviation (MAD) of this data set?`,
    correctAnswer: mixedText(mad),
    distractors: fractionChoiceTexts(
      mad,
      withFallback(mad, [intF(range(data)), intF(0), intF(meanValue)]),
      mixedText,
    ),
    parameters: { data, mean: meanValue },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateVisualOverlapInMadUnitsQuestion(
  difficulty: Difficulty,
): Unit8Question<'visual-overlap-in-mad-units', OverlapParameters> {
  const { meanA, meanB, mad } = randomOverlapSet(difficulty)
  const diff = intF(meanB - meanA)
  const ratio = mulFraction(diff, { num: mad.den, den: mad.num })
  const definition = GRADE7_MATH_UNIT8_ITEM_DEFINITIONS['visual-overlap-in-mad-units']
  return makeCurriculumQuestion({
    itemType: 'visual-overlap-in-mad-units',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Two data sets have means of ${meanA} and ${meanB}. Their mean absolute deviation (MAD) is ${mixedText(mad)}. Express the difference between the means as a multiple of the MAD.`,
    correctAnswer: `${mixedText(ratio)} times the MAD`,
    distractors: fractionChoiceTexts(
      ratio,
      withFallback(ratio, [diff, mad, mulFraction(ratio, intF(2))]),
      (f) => `${mixedText(f)} times the MAD`,
    ),
    parameters: { meanA, meanB, mad },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateCompareTwoSamplesCenterQuestion(
  difficulty: Difficulty,
): Unit8Question<'compare-two-samples-center', TwoSampleParameters> {
  const { dataA, dataB } = randomTwoSamplesByMean(difficulty)
  const meanA = mean(dataA)
  const meanB = mean(dataB)
  const aIsGreater = subFraction(meanA, meanB).num > 0
  const greaterLabel = aIsGreater ? 'A' : 'B'
  const greaterMean = aIsGreater ? meanA : meanB
  const lesserMean = aIsGreater ? meanB : meanA
  const correctAnswer = `Sample ${greaterLabel}, with a mean of ${mixedText(greaterMean)} compared to ${mixedText(lesserMean)}.`
  const otherLabel = aIsGreater ? 'B' : 'A'
  const distractors = [
    `Sample ${otherLabel}, with a mean of ${mixedText(lesserMean)} compared to ${mixedText(greaterMean)}.`,
    `Sample ${greaterLabel}, with a mean of ${mixedText(lesserMean)} compared to ${mixedText(greaterMean)}.`,
    `Both samples have the same mean.`,
  ]
  const definition = GRADE7_MATH_UNIT8_ITEM_DEFINITIONS['compare-two-samples-center']
  return makeCurriculumQuestion({
    itemType: 'compare-two-samples-center',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Sample A: ${dataA.join(', ')}. Sample B: ${dataB.join(', ')}. Based on the means, which sample tends to have greater values?`,
    correctAnswer,
    distractors,
    parameters: { dataA, dataB },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateCompareTwoSamplesVariabilityQuestion(
  difficulty: Difficulty,
): Unit8Question<'compare-two-samples-variability', TwoSampleParameters> {
  const { dataA, dataB } = randomTwoSamplesByRange(difficulty)
  const rangeA = range(dataA)
  const rangeB = range(dataB)
  const aIsSmaller = rangeA < rangeB
  const smallerLabel = aIsSmaller ? 'A' : 'B'
  const smallerRange = aIsSmaller ? rangeA : rangeB
  const largerRange = aIsSmaller ? rangeB : rangeA
  const correctAnswer = `Sample ${smallerLabel}, with a range of ${smallerRange} compared to ${largerRange}.`
  const otherLabel = aIsSmaller ? 'B' : 'A'
  const distractors = [
    `Sample ${otherLabel}, with a range of ${largerRange} compared to ${smallerRange}.`,
    `Sample ${smallerLabel}, with a range of ${largerRange} compared to ${smallerRange}.`,
    `Both samples have the same range.`,
  ]
  const definition = GRADE7_MATH_UNIT8_ITEM_DEFINITIONS['compare-two-samples-variability']
  return makeCurriculumQuestion({
    itemType: 'compare-two-samples-variability',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Sample A: ${dataA.join(', ')}. Sample B: ${dataB.join(', ')}. Based on the range of each sample, which sample is more consistent (less variable)?`,
    correctAnswer,
    distractors,
    parameters: { dataA, dataB },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export const GRADE7_MATH_UNIT8_GENERATORS = {
  'identify-population-vs-sample': generateIdentifyPopulationVsSampleQuestion,
  'sampling-method-bias-analysis': generateSamplingMethodBiasAnalysisQuestion,
  'estimate-population-from-sample-proportion': generateEstimatePopulationFromSampleProportionQuestion,
  'sample-estimate-variation-range': generateSampleEstimateVariationRangeQuestion,
  'sample-size-representativeness': generateSampleSizeRepresentativenessQuestion,
  'generalization-validity-check': generateGeneralizationValidityCheckQuestion,
  'compute-mean-median-range': generateComputeMeanMedianRangeQuestion,
  'mean-vs-median-with-outlier': generateMeanVsMedianWithOutlierQuestion,
  'compute-mean-absolute-deviation': generateComputeMeanAbsoluteDeviationQuestion,
  'visual-overlap-in-mad-units': generateVisualOverlapInMadUnitsQuestion,
  'compare-two-samples-center': generateCompareTwoSamplesCenterQuestion,
  'compare-two-samples-variability': generateCompareTwoSamplesVariabilityQuestion,
} satisfies Record<Grade7MathUnit8ItemType, CurriculumGenerator<Grade7MathUnit8Question>>

export function generateGrade7MathUnit8Question<TItemType extends Grade7MathUnit8ItemType>(
  itemType: TItemType,
  difficulty: Difficulty,
): Extract<Grade7MathUnit8Question, { itemType: TItemType }> {
  const generator = GRADE7_MATH_UNIT8_GENERATORS[itemType] as CurriculumGenerator<
    Extract<Grade7MathUnit8Question, { itemType: TItemType }>
  >
  return generator(difficulty)
}
