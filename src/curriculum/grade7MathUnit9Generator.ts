import type { Difficulty } from '../types'
import { fmtFrac, pick, ri } from '../genUtils'
import { makeCurriculumQuestion, type CurriculumGenerator, type CurriculumQuestion, type CurriculumWorkedExample } from './generatorCore'

/** Source coverage: Grade 7 Mathematics Unit 9 "Probability and Simulation" (days 145-162), 7.SP.5-8. */
export const GRADE7_MATH_UNIT9_ITEM_TYPES = ['probability-scale', 'experimental-probability', 'theoretical-probability', 'compound-events', 'sample-spaces', 'simulation-and-model-limitations'] as const
export type Grade7MathUnit9ItemType = typeof GRADE7_MATH_UNIT9_ITEM_TYPES[number]
type Params = { favorable?: number; sampleSize?: number; multiplier?: number }
type Q<T extends Grade7MathUnit9ItemType> = CurriculumQuestion<T, Params>
export type Grade7MathUnit9Question = { [T in Grade7MathUnit9ItemType]: Q<T> }[Grade7MathUnit9ItemType]
type Def = { standard: '7.SP.5' | '7.SP.6' | '7.SP.7' | '7.SP.8'; lessonFocus: string; workedExample: CurriculumWorkedExample }
const example = (prompt: string, answer: string, steps: readonly string[]): CurriculumWorkedExample => ({ prompt, answer, steps })
/**
 * One authored worked example per item type. Each prompt is a concrete instance of
 * that item type's own generated shape and each answer is the answer to that
 * prompt. The two item types built on a sample space walk through the table a
 * student is meant to draw, because the count is what they are being asked to see.
 */
export const GRADE7_MATH_UNIT9_ITEM_DEFINITIONS = {
  'probability-scale': { standard: '7.SP.5', lessonFocus: 'probability scale', workedExample: example('An event has a probability of 9/10. How would you describe how likely the event is to happen?', 'likely', [
    'Probability runs on a scale from 0 to 1: 0 means the event is impossible, 1 means it is certain, and 1/2 means it is equally likely to happen or not happen.',
    'Compare 9/10 with that halfway mark. Rewriting 1/2 as 5/10 makes them easy to line up, and 9/10 is well above 5/10.',
    'Out of 10 equally likely tries this event would be expected about 9 times, leaving 10 - 9 = 1 try where it does not happen. It is close to 1 but not equal to 1, so it is likely rather than certain.',
  ]) },
  'experimental-probability': { standard: '7.SP.6', lessonFocus: 'experimental probability', workedExample: example('A spinner was spun 20 times and landed on blue 8 times. Based on this experiment, what is the experimental probability of landing on blue?', '2/5', [
    'Experimental probability comes from what actually happened, so it is the number of successful trials over the total number of trials.',
    'Blue came up 8 times out of 20 spins, which is the fraction 8/20.',
    'Reduce it: 8 and 20 share the factor 4, and 8 ÷ 4 = 2 over 20 ÷ 4 = 5, so the experimental probability is 2/5. A different set of 20 spins could give a different fraction, which is why this is only an estimate.',
  ]) },
  'theoretical-probability': { standard: '7.SP.7', lessonFocus: 'theoretical probability', workedExample: example('A bag has 3 red, 5 blue, and 7 green marbles. If one marble is drawn at random, what is the theoretical probability of drawing red, P(red)?', '1/5', [
    'Theoretical probability counts what should happen when every marble is equally likely to be drawn, so it needs the favourable count over the total count.',
    'Add every marble to find the total, including the greens: 3 + 5 + 7 = 15 marbles in the bag.',
    '3 of those 15 are red, so P(red) = 3/15. Both numbers divide by 3, and 3 ÷ 3 = 1 over 15 ÷ 3 = 5, so P(red) = 1/5.',
  ]) },
  'compound-events': { standard: '7.SP.8', lessonFocus: 'compound events', workedExample: example('A fair coin is flipped and a spinner with 3 equal sections numbered 1 to 3 is spun. What is the probability of getting heads on the coin and landing on 2 on the spinner?', '1/6', [
    'The coin and the spinner do not affect each other, so list every pairing. A table makes them countable: the rows are heads and tails, and the columns are sections 1, 2 and 3.',
    'That table is 2 rows by 3 columns, so it holds 2 × 3 = 6 equally likely outcomes: H1, H2, H3, T1, T2, T3.',
    'Only one of those six cells, H2, is heads and section 2 together, so the probability is 1/6. Multiplying the separate probabilities gives the same result, since 1/2 of 1/3 is 1/6.',
  ]) },
  'sample-spaces': { standard: '7.SP.8', lessonFocus: 'sample spaces', workedExample: example('A meal is made by choosing one main dish from 3 options and one side dish from 4 options. How many different meals are possible?', '12', [
    'Every main dish can be paired with every side dish, so lay the possibilities out as a table with one row per main dish and one column per side dish.',
    'Each of the 3 main dishes has all 4 side dishes available, so the table is 3 rows of 4 cells: 3 × 4 = 12 cells.',
    'Each cell is one different meal, so 12 meals are possible. Adding would give 3 + 4 = 7, which only counts the items on the menu instead of the pairings.',
  ]) },
  'simulation-and-model-limitations': { standard: '7.SP.7', lessonFocus: 'simulation and model limitations', workedExample: example('A probability model predicts a fair 4-section spinner lands on a chosen section about 40 times in 160 spins. A simulation of 160 spins landed on that section 46 times. How does the simulated count compare to the model\'s prediction?', '6 more than predicted', [
    'The model treats the 4 sections as equally likely, so each should come up about a quarter of the time: 160 ÷ 4 = 40 spins.',
    'Compare the simulated count with that prediction by subtracting: 46 - 40 = 6.',
    'The simulation landed on the section 6 more times than predicted. A gap like this does not mean the model is wrong: a model gives a long-run expectation, and short runs wander around it.',
  ]) },
} as const satisfies Record<Grade7MathUnit9ItemType, Def>
const q = (itemType: Grade7MathUnit9ItemType, difficulty: Difficulty, prompt: string, answer: string, parameters: Params, distractors: string[]) => makeCurriculumQuestion({ itemType, difficulty, prompt, correctAnswer: answer, distractors, distractorMode: 'distinct', parameters, ...GRADE7_MATH_UNIT9_ITEM_DEFINITIONS[itemType] })
const LIKELIHOOD_SCALE = [
  { value: '0', label: 'impossible' },
  { value: '1/10', label: 'unlikely' },
  { value: '1/2', label: 'equally likely to happen or not happen' },
  { value: '9/10', label: 'likely' },
  { value: '1', label: 'certain' },
] as const
const MENU_CONTEXTS = [
  { itemA: 'main dish', itemB: 'side dish', noun: 'meal' },
  { itemA: 'shirt color', itemB: 'shorts color', noun: 'outfit' },
  { itemA: 'topping', itemB: 'crust', noun: 'pizza' },
] as const
export function generateProbabilityScaleQuestion(difficulty: Difficulty) { const item = pick(LIKELIHOOD_SCALE); const others = LIKELIHOOD_SCALE.filter((x) => x.label !== item.label).map((x) => x.label); return q('probability-scale', difficulty, `An event has a probability of ${item.value}. How would you describe how likely the event is to happen?`, item.label, {}, others) }
export function generateExperimentalProbabilityQuestion(difficulty: Difficulty) { const outcomes = ri(2, difficulty + 3) * 10; const success = ri(2, Math.floor(outcomes / 2)); const answer = fmtFrac(success, outcomes); return q('experimental-probability', difficulty, `A spinner was spun ${outcomes} times and landed on blue ${success} times. Based on this experiment, what is the experimental probability of landing on blue?`, answer, { favorable: success, sampleSize: outcomes }, [fmtFrac(success - 1, outcomes), fmtFrac(success + 1, outcomes), fmtFrac(success + 2, outcomes), fmtFrac(Math.max(0, success - 2), outcomes)]) }
export function generateTheoreticalProbabilityQuestion(difficulty: Difficulty) { const red = ri(2, difficulty * 2 + 3); const blue = red + ri(1, 3); const green = red + ri(4, difficulty + 6); const total = red + blue + green; const answer = fmtFrac(red, total); return q('theoretical-probability', difficulty, `A bag has ${red} red, ${blue} blue, and ${green} green marbles. If one marble is drawn at random, what is the theoretical probability of drawing red, P(red)?`, answer, { favorable: red, sampleSize: total }, [fmtFrac(blue, total), fmtFrac(green, total), fmtFrac(blue + green, total), fmtFrac(total - 1, total)]) }
export function generateCompoundEventsQuestion(difficulty: Difficulty) { const sections = pick([3, 4, 5, 6] as const); const coinFace = pick(['heads', 'tails'] as const); const spinnerLabel = ri(1, sections); const d = 2 * sections; const answer = fmtFrac(1, d); return q('compound-events', difficulty, `A fair coin is flipped and a spinner with ${sections} equal sections numbered 1 to ${sections} is spun. What is the probability of getting ${coinFace} on the coin and landing on ${spinnerLabel} on the spinner?`, answer, { multiplier: sections }, [fmtFrac(2, d), fmtFrac(3, d), fmtFrac(4, d), fmtFrac(1, 2)]) }
export function generateSampleSpacesQuestion(difficulty: Difficulty) { const ctx = pick(MENU_CONTEXTS); const a = ri(2, difficulty + 3); const b = ri(2, difficulty + 4); const answer = a * b; return q('sample-spaces', difficulty, `A ${ctx.noun} is made by choosing one ${ctx.itemA} from ${a} options and one ${ctx.itemB} from ${b} options. How many different ${ctx.noun}s are possible?`, String(answer), { favorable: a, sampleSize: b }, [String(a + b), String(answer + 1), String(answer + 2), String(answer + 3)]) }
export function generateSimulationAndModelLimitationsQuestion(difficulty: Difficulty) { const sections = pick([4, 5, 8, 10] as const); const spins = sections * ri(10, difficulty * 10 + 20); const predicted = spins / sections; const gap = ri(1, Math.max(1, Math.floor(predicted / 5))); const direction = pick(['more', 'fewer'] as const); const answer = `${gap} ${direction} than predicted`; return q('simulation-and-model-limitations', difficulty, `A probability model predicts a fair ${sections}-section spinner lands on a chosen section about ${predicted} times in ${spins} spins. A simulation of ${spins} spins landed on that section ${direction === 'more' ? predicted + gap : predicted - gap} times. How does the simulated count compare to the model's prediction?`, answer, { multiplier: sections, sampleSize: spins, favorable: predicted }, [`${gap} ${direction === 'more' ? 'fewer' : 'more'} than predicted`, 'exactly as predicted', `${gap + 1} ${direction} than predicted`, `${Math.max(0, gap - 1)} ${direction} than predicted`]) }
export const GRADE7_MATH_UNIT9_GENERATORS = { 'probability-scale': generateProbabilityScaleQuestion, 'experimental-probability': generateExperimentalProbabilityQuestion, 'theoretical-probability': generateTheoreticalProbabilityQuestion, 'compound-events': generateCompoundEventsQuestion, 'sample-spaces': generateSampleSpacesQuestion, 'simulation-and-model-limitations': generateSimulationAndModelLimitationsQuestion } satisfies Record<Grade7MathUnit9ItemType, CurriculumGenerator<Grade7MathUnit9Question>>
export function generateGrade7MathUnit9Question<T extends Grade7MathUnit9ItemType>(itemType: T, difficulty: Difficulty): Extract<Grade7MathUnit9Question, { itemType: T }> { return GRADE7_MATH_UNIT9_GENERATORS[itemType](difficulty) as Extract<Grade7MathUnit9Question, { itemType: T }> }
