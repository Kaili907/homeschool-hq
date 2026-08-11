import type { AutoKind, MissionDay, MissionItem } from '../../../types'
import { isDayComplete } from '../../../missions'

export type LegacyMissionAction = 'toggle' | 'launch' | 'none'

export type LegacyMissionLaunchCapabilities =
  | ReadonlySet<AutoKind>
  | readonly AutoKind[]

/**
 * Presentation-only metadata for one existing mission item. `item` is the
 * authoritative object from Profile.missions; this adapter never clones or
 * mutates mission state.
 */
export interface LegacyMissionDisplayItem {
  readonly item: MissionItem
  readonly autoKind: AutoKind | null
  readonly action: LegacyMissionAction
  readonly upNextEligible: boolean
}

export interface LegacyMissionData {
  readonly items: readonly LegacyMissionDisplayItem[]
  readonly completedCount: number
  readonly allComplete: boolean
  readonly upNext: LegacyMissionDisplayItem | null
}

/** A bare legacy `auto: true` item is the existing math auto-complete kind. */
export function resolveLegacyMissionAutoKind(item: MissionItem): AutoKind | null {
  return item.auto ? item.autoKind ?? 'math' : null
}

function canLaunch(
  capabilities: LegacyMissionLaunchCapabilities,
  kind: AutoKind,
): boolean {
  return 'has' in capabilities
    ? capabilities.has(kind)
    : capabilities.includes(kind)
}

/**
 * Derive dashboard presentation from the legacy mission source of truth.
 * Manual rows retain their established toggle action. Auto-managed rows may
 * launch only an already-wired activity, and completion never becomes Up Next.
 */
export function buildLegacyMissionData(
  day: MissionDay | undefined,
  launchableAutoKinds: LegacyMissionLaunchCapabilities = [],
): LegacyMissionData {
  const missionItems = day?.items ?? []
  const items = missionItems.map((item): LegacyMissionDisplayItem => {
    const autoKind = resolveLegacyMissionAutoKind(item)
    const action: LegacyMissionAction = autoKind === null
      ? 'toggle'
      : canLaunch(launchableAutoKinds, autoKind)
        ? 'launch'
        : 'none'

    return {
      item,
      autoKind,
      action,
      upNextEligible: !item.done && action !== 'none',
    }
  })
  const completedCount = missionItems.filter((item) => item.done).length

  return {
    items,
    completedCount,
    allComplete: isDayComplete(day),
    upNext: items.find((item) => item.upNextEligible) ?? null,
  }
}
