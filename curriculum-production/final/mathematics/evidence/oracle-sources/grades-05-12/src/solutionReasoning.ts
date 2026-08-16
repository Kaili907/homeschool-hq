import type { BankItem } from './itemBank.ts'
import type { WorkedSolution } from './types.ts'

/**
 * Builds the reasoning a parent uses to check *this* item.
 *
 * High-school generators are authored in this directory and emit real per-item
 * steps, so those are used directly. The canonical grade 5-8 generators store
 * one worked example per item type, not per item, so their steps describe a
 * different problem and must never be presented as this item's solution. For
 * those, the reasoning states the item's own generated quantities, points at the
 * reference example for the method, and gives the authoritative answer, with the
 * check the parent should run.
 */

function formatValue(value: unknown): string {
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return `[${value.map(formatValue).join(', ')}]`
  if (value && typeof value === 'object') {
    return `{ ${Object.entries(value as Record<string, unknown>)
      .map(([key, inner]) => `${key}: ${formatValue(inner)}`)
      .join(', ')} }`
  }
  return String(value)
}

export function formatGiven(parameters: Record<string, unknown>): string {
  const entries = Object.entries(parameters)
  if (entries.length === 0) return 'no generated quantities'
  return entries.map(([key, value]) => `${key} = ${formatValue(value)}`).join(', ')
}

export function solutionReasoningFor(item: BankItem, answer: string): WorkedSolution {
  if (item.solutionSteps && item.solutionSteps.length > 0) {
    return { steps: item.solutionSteps, answer }
  }
  // Canonical grade 5-8 generators expose their parameters but not a per-item
  // derivation, so the reasoning states this item's own quantities, names the
  // method with the teaching example that demonstrates it, and is explicit that
  // the answer is asserted from a test-verified generator rather than derived
  // here. A parent re-derives from the quantities; nothing pretends otherwise.
  return {
    steps: [
      `This item was generated with ${formatGiven(item.parameters)}.`,
      `It exercises the ${item.itemType.replace(/-/g, ' ')} method for ${item.standard}. The reference example recorded with this entry — “${item.workedExample.prompt}” — demonstrates that method on different numbers; work this item's quantities through the same steps.`,
      `Carried out on those quantities the result is: ${answer}`,
      `This answer comes from the canonical curriculum generator for this unit, whose arithmetic is checked by its own oracle test suite; it is not derived step by step here. Re-derive it from the quantities above before marking the work, and confirm exactly one of the offered options matches.`,
    ],
    answer,
  }
}
