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
const example = (prompt: string, answer: string): CurriculumWorkedExample => ({ prompt, answer, steps: ['Identify the favorable outcomes and the total possible outcomes.', 'Write the probability as a reduced fraction, or use it to predict or evaluate a count.'] })
export const GRADE7_MATH_UNIT9_ITEM_DEFINITIONS = {
  'probability-scale': { standard: '7.SP.5', lessonFocus: 'probability scale', workedExample: example('A probability of 1 means an event is...', 'certain') },
  'experimental-probability': { standard: '7.SP.6', lessonFocus: 'experimental probability', workedExample: example('A coin was flipped 20 times and landed heads 9 times. What is the experimental probability of heads?', '9/20') },
  'theoretical-probability': { standard: '7.SP.7', lessonFocus: 'theoretical probability', workedExample: example('A bag has 2 red and 3 blue marbles. What is the theoretical probability of drawing red?', '2/5') },
  'compound-events': { standard: '7.SP.8', lessonFocus: 'compound events', workedExample: example('A fair coin is flipped and a 3-section spinner is spun. What is the probability of heads and landing on section 2?', '1/6') },
  'sample-spaces': { standard: '7.SP.8', lessonFocus: 'sample spaces', workedExample: example('A meal has 3 main dish options and 2 side options. How many different meals are possible?', '6') },
  'simulation-and-model-limitations': { standard: '7.SP.7', lessonFocus: 'simulation and model limitations', workedExample: example('A model predicts 25 heads in 100 flips. A simulation of 100 flips gave 29 heads. How does the simulated count compare to the model\'s prediction?', '4 more than predicted') },
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
