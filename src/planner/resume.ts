import type { ISODate } from '../types'
import type { DailyPlanBlock, ResumePointer } from './types'

/**
 * Stable across renders and devices as long as profile/date/template identity
 * stays the same. No clock or array position participates in the identifier.
 */
export function plannerBlockInstanceId(
  profileId: string,
  date: ISODate,
  blockId: string,
): string {
  return `planner:${encodeURIComponent(profileId)}:${date}:${encodeURIComponent(blockId)}`
}

export function pointerFromLinkedActivity(
  block: DailyPlanBlock,
  now: string,
): ResumePointer | undefined {
  const linked = block.block.linkedActivity
  if (!linked) return undefined
  return {
    ...(linked.route ? { route: linked.route } : {}),
    activityId: linked.activityId,
    ...(linked.lessonId ? { lessonId: linked.lessonId } : {}),
    ...(linked.stepId ? { stepId: linked.stepId } : {}),
    ...(linked.itemId ? { itemId: linked.itemId } : {}),
    ...(linked.safeEntryData ? { adapterData: linked.safeEntryData } : {}),
    updatedAt: now,
  }
}
