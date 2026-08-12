import type { BankItem } from './itemBank.ts'
import type { WorkedSolution } from './types.ts'

/**
 * Builds the reasoning a parent uses to check *this* item.
 *
 * Every Grade 3/4 item type in this pipeline is authored in src/g34 with a
 * real per-item oracle, so `item.solutionSteps` is always populated and this
 * is the path every item takes. The generic fallback below is kept only as a
 * defensive default (matching the shape of the grades 5-12 sibling pipeline,
 * which needs it for generators that don't carry per-item steps); it should
 * never actually run against this pipeline's own item banks.
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
  return {
    steps: [
      `This item was generated with ${formatGiven(item.parameters)}.`,
      `It exercises the ${item.itemType.replace(/-/g, ' ')} method for ${item.standard}. The reference example recorded with this entry — “${item.workedExample.prompt}” — demonstrates that method on different numbers; work this item's quantities through the same steps.`,
      `Carried out on those quantities the result is: ${answer}`,
      `Re-derive this answer from the quantities above before marking the work, and confirm exactly one of the offered options matches.`,
    ],
    answer,
  }
}
