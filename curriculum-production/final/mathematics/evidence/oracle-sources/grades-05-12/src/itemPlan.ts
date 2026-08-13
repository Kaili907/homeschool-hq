import type { MaterialDifficulty } from './types.ts'
import type { SourceLesson } from './lessonSources.ts'
import type { UnitBank } from './itemBank.ts'
import { standardCoveredBy } from './standards.ts'

/**
 * Chooses which item types a lesson exercises.
 *
 * Two constraints shape this. First, the questions must test the lesson's own
 * standards, so item types whose standard appears in the lesson record are used
 * before any others. Second, eighteen lessons drawn from one unit bank must not
 * be the same worksheet eighteen times, so the preferred pool is rotated by the
 * lesson's day in the unit and the sections of one lesson step through the pool
 * rather than repeating a single type.
 */

export interface ItemTypeProbe {
  itemType: string
  standard: string
}

/**
 * An item type's standard is only observable from a generated item, so probe
 * each type once. The caller seeds the shared RNG first, keeping the probe —
 * and therefore the whole selection — reproducible.
 */
export function probeItemStandards(bank: UnitBank): ItemTypeProbe[] {
  return bank.itemTypes.map((itemType) => ({
    itemType,
    standard: bank.generate(itemType, 2).standard,
  }))
}

export function orderedItemTypes(
  probes: readonly ItemTypeProbe[],
  lesson: SourceLesson,
): string[] {
  const onStandard = probes.filter((probe) => standardCoveredBy(probe.standard, lesson.standards))
  const offStandard = probes.filter((probe) => !standardCoveredBy(probe.standard, lesson.standards))
  // A unit bank's item standards are drawn from the same unit as the lesson, so
  // onStandard is normally non-empty; fall back to the whole pool when a lesson
  // record lists only practice standards (MP.*) that no item type carries.
  const preferred = onStandard.length > 0 ? onStandard : probes
  const rotate = <T,>(values: readonly T[], by: number): T[] =>
    values.length === 0 ? [] : values.map((_, index) => values[(index + by) % values.length])

  const offset = Math.max(0, lesson.ref.dayInUnit - 1)
  return [
    ...rotate(preferred, offset % Math.max(1, preferred.length)).map((p) => p.itemType),
    ...rotate(offStandard, offset % Math.max(1, offStandard.length)).map((p) => p.itemType),
  ]
}

/** Walks the ordered pool so consecutive slots in a lesson differ where possible. */
export function planItemTypes(
  ordered: readonly string[],
  slots: readonly MaterialDifficulty[],
  startOffset: number,
): string[] {
  if (ordered.length === 0) throw new Error('Cannot plan items from an empty item-type pool')
  return slots.map((_, index) => ordered[(startOffset + index) % ordered.length])
}
