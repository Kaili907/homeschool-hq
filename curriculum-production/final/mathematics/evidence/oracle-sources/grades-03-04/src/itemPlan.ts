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
  // Grade 3/4 lessons cite very few standards each (about 1.5 on average,
  // often just one content code), far narrower than a unit's full item-type
  // spread. Mixing in off-standard types once the on-standard pool runs out
  // (as the grades 5-12 sibling pipeline's wider-per-lesson data can afford)
  // would routinely put a Unit 3 item on a lesson that only claims Unit 3's
  // Unit 1 standard, failing item-standard-in-lesson. So here the pool is
  // on-standard only, repeating (via modulo in planItemTypes) to fill a
  // section rather than ever spilling into a standard the lesson doesn't
  // claim. Fall back to the whole pool only when a lesson record lists just
  // practice standards (MP.*) that no item type in this unit carries.
  const preferred = onStandard.length > 0 ? onStandard : probes
  const rotate = <T,>(values: readonly T[], by: number): T[] =>
    values.length === 0 ? [] : values.map((_, index) => values[(index + by) % values.length])

  const offset = Math.max(0, lesson.ref.dayInUnit - 1)
  return rotate(preferred, offset % Math.max(1, preferred.length)).map((p) => p.itemType)
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
