/**
 * Shared rubric spine for judgment items.
 *
 * The four performance levels for a dimension are deliberately common across
 * the course: a rubric a household can apply consistently across 288 lessons
 * has to mean the same thing in October as it does in April. What is authored
 * per lesson is everything that makes the rubric usable on *this* task — the
 * acceptable-answer criteria, the evidence the response must cite, and the
 * look-fors — and those are checked for lesson-specificity by
 * `tests/antiTemplate.test.ts`.
 */
import type { DimensionId } from './types.ts'

export interface RubricLevel {
  readonly label: 'Not yet' | 'Approaching' | 'Meets' | 'Exceeds'
  readonly descriptor: string
}

export interface RubricDimension {
  readonly dimension: string
  readonly levels: readonly RubricLevel[]
}

const D = (
  dimension: string,
  notYet: string,
  approaching: string,
  meets: string,
  exceeds: string,
): RubricDimension => ({
  dimension,
  levels: [
    { label: 'Not yet', descriptor: notYet },
    { label: 'Approaching', descriptor: approaching },
    { label: 'Meets', descriptor: meets },
    { label: 'Exceeds', descriptor: exceeds },
  ],
})

export const DIMENSIONS: Readonly<Record<DimensionId, RubricDimension>> = {
  'computation-accuracy': D(
    'Accuracy of the computation',
    'The figures are absent, or wrong in a way that changes the conclusion.',
    'The method is right but at least one figure is wrong, so the conclusion is off.',
    'Every figure is correct and each is traceable to a stated scenario value.',
    'Every figure is correct and the response also checks one of them a second way.',
  ),
  'reasoning-from-figures': D(
    'Reasoning from the figures',
    'A conclusion is stated with no figures behind it.',
    'Figures are quoted but the step from figure to conclusion is missing.',
    'The response shows which figures drive the conclusion and how.',
    'The response also says how large a change in a figure would flip the conclusion.',
  ),
  'assumption-identification': D(
    'Identifying the assumption',
    'No assumption is named.',
    'An assumption is named but it is not one the conclusion actually depends on.',
    'A load-bearing assumption is named and its effect on the conclusion is stated.',
    'A load-bearing assumption is named, tested against the scenario, and bounded.',
  ),
  'tradeoff-defense': D(
    'Defending the tradeoff',
    'A choice is asserted with no cost acknowledged.',
    'A choice is defended but what it gives up is not named.',
    'The choice is defended and what it costs or forecloses is named specifically.',
    'The choice is defended, its cost is named, and the strongest case against it is answered.',
  ),
  'evidence-use': D(
    'Use of evidence from the scenario',
    'No scenario detail is cited.',
    'Scenario detail is cited but not the detail the claim needs.',
    'Every claim points to the specific scenario figure, term, or document line behind it.',
    'Evidence is cited and the response notes where the scenario is silent.',
  ),
  'error-diagnosis': D(
    'Diagnosing the error',
    'The error is not located.',
    'The response says the work is wrong but not where or why.',
    'The response locates the first wrong step and states the misconception behind it.',
    'The response locates the error, names the misconception, and gives a check that would have caught it.',
  ),
  transfer: D(
    'Transfer to the new case',
    'The method from the earlier case is restated without being applied.',
    'The method is applied but a difference in the new case is ignored.',
    'The method is applied and adjusted for what is different in the new case.',
    'The method is applied, adjusted, and the limit of the transfer is stated.',
  ),
  'criteria-application': D(
    'Applying the stated criteria',
    'The criteria are not used.',
    'Some criteria are used and others are dropped without saying why.',
    'Every stated criterion is applied and the result of each is reported.',
    'Every criterion is applied and the response says which one decided the outcome.',
  ),
  'communication-of-uncertainty': D(
    'Communicating uncertainty',
    'The conclusion is stated as certain when the scenario does not support that.',
    'Uncertainty is mentioned in general terms only.',
    'The response says what is not known and how it limits the conclusion.',
    'The response says what is not known, how it limits the conclusion, and what would resolve it.',
  ),
  'plan-coherence': D(
    'Coherence of the plan',
    'The parts of the plan contradict each other or do not add up.',
    'The plan adds up but one part is not connected to the rest.',
    'The plan adds up and each part is consistent with the others and with the constraint.',
    'The plan adds up, is internally consistent, and states what would break it first.',
  ),
}
