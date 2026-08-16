import type { BankItem } from './itemBank.ts'
import type { CommonError } from './types.ts'

/**
 * Common-error guidance for the answer key.
 *
 * Every Grade 3/4 item type in this pipeline authors its own commonErrors,
 * because the unit files know what the specific misconception behind each
 * distractor is (see src/g34/*.ts). The generic fallback below is kept only
 * as a defensive default and should never actually run against this
 * pipeline's own item banks.
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
