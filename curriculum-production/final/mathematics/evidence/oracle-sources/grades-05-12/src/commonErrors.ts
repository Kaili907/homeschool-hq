import type { BankItem } from './itemBank.ts'
import type { CommonError } from './types.ts'

/**
 * Common-error guidance for the answer key.
 *
 * High-school generators author their own, because they know what the specific
 * misconception behind each distractor is. For the canonical grade 5-8 banks the
 * distractors are the misconceptions — each was chosen by the unit author to
 * match a real error — so the guidance names the actual wrong value the learner
 * would have produced and points at the worked-example step that rules it out.
 */
export function commonErrorsFor(item: BankItem): CommonError[] {
  if (item.commonErrors && item.commonErrors.length > 0) {
    return [...item.commonErrors]
  }
  const correct = item.choices[item.answerIndex]
  const distractors = item.choices.filter((choice) => choice !== correct)
  return distractors.slice(0, 3).map((distractor) => ({
    observed: `Answered “${distractor}” instead of “${correct}”.`,
    likelyCause:
      'This is one of the item’s designed distractors: the unit author chose it to match a plausible wrong move on this item type, so it usually indicates a method error rather than a careless slip.',
    remediation: `Ask the learner to rework this item from its given quantities and say each step aloud. Then ask which single step would have to change for “${distractor}” to be the answer, and check that step against the reference example's method.`,
  }))
}

export function remediationGuidanceFor(item: readonly BankItem[]): string[] {
  const byType = new Map<string, BankItem>()
  for (const entry of item) if (!byType.has(entry.itemType)) byType.set(entry.itemType, entry)
  return [...byType.values()].map(
    (entry) =>
      `${entry.itemType} (${entry.standard}): if the learner misses these, reteach with the worked example “${entry.workedExample.prompt}” and require the reasoning for each step before another attempt.`,
  )
}
