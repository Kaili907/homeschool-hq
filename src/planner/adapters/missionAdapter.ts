import type { AppState, MissionDay, Profile } from '../../types'
import { buildMissionDay, templateFor, weekdayOf } from '../../missions'
import {
  patchPlannerState,
  settleMissionPlannerTiming,
  type PlannerProgressTarget,
} from '../progress'
import { plannerBlockInstanceId } from '../resume'
import type {
  DailyPlanBlock,
  PlannerBlock,
  PlannerWeekday,
} from '../types'

const pad = (value: number) => String(value).padStart(2, '0')

const clockAt = (minutes: number): string =>
  `${pad(Math.floor(Math.min(minutes, 23 * 60 + 59) / 60))}:${pad(
    Math.min(minutes, 23 * 60 + 59) % 60,
  )}`

function expectedMinutes(label: string): number {
  const match = label.match(/(\d+)\s*(?:minutes?|min)\b/i)
  return match ? Math.max(5, Number(match[1])) : 20
}

function linkedActivityFor(item: MissionDay['items'][number]) {
  if (!item.auto) return undefined
  const autoKind = item.autoKind ?? 'math'
  const activityId =
    autoKind === 'math'
      ? 'math-practice'
      : autoKind === 'typing'
        ? 'typing'
        : autoKind === 'reading'
          ? 'reading'
          : 'mindset'
  return {
    adapter: 'mission' as const,
    activityId,
    safeEntryData: { missionItemId: item.id },
  }
}

/**
 * Reads an existing MissionDay when one has been created. For a future weekday,
 * it derives the same template day without persisting a second mission record.
 */
export function missionDayForPlanner(profile: Profile, date: string): MissionDay | undefined {
  const existing = profile.missions[date]
  if (existing) return existing
  const weekday = weekdayOf(date)
  if (weekday < 1 || weekday > 5) return undefined
  return buildMissionDay(templateFor(profile), date)
}

export function missionBlocksForDay(
  profile: Profile,
  date: string,
  missionDay: MissionDay | undefined = missionDayForPlanner(profile, date),
): PlannerBlock[] {
  if (!missionDay) return []
  const weekday = weekdayOf(date) as PlannerWeekday
  let cursor = 8 * 60
  const blocks: PlannerBlock[] = []
  const seen = new Set<string>()
  for (const item of missionDay.items) {
    const id = `mission:${item.id}`
    if (seen.has(id)) continue
    seen.add(id)
    const duration = expectedMinutes(item.label)
    const autoKind = item.auto ? item.autoKind ?? 'math' : undefined
    blocks.push({
      id,
      title: item.label,
      studentInstructions: item.auto
        ? 'Completion is controlled by the linked mission activity.'
        : 'Existing daily mission item.',
      category: 'existing-mission',
      source: {
        kind: 'mission',
        missionItemId: item.id,
        autoOnly: item.auto === true,
        ...(autoKind ? { autoKind } : {}),
      },
      assignedProfileIds: [profile.id],
      assignToAll: false,
      weekdays: [weekday],
      startTime: clockAt(cursor),
      expectedMinutes: duration,
      scheduleBehavior: 'flexible',
      ...(linkedActivityFor(item) ? { linkedActivity: linkedActivityFor(item) } : {}),
      requiresParentHelp: /\bdad\b/i.test(item.label),
      active: true,
      createdAt: `${date}T00:00:00.000`,
      updatedAt: `${date}T00:00:00.000`,
    })
    cursor += duration
  }
  return blocks
}

export function isAutoOnlyMissionBlock(block: PlannerBlock | DailyPlanBlock): boolean {
  const source = 'block' in block ? block.block.source : block.source
  return source.kind === 'mission' && source.autoOnly
}

/**
 * Mission completion still comes exclusively from Profile.missions. This merely
 * settles a planner timer that was already running so active time cannot keep
 * growing after the source activity completes. The persisted timing row remains
 * paused/non-authoritative; it never receives completed status or completedAt.
 */
export function reconcileMissionTimers(
  state: AppState,
  profileId: string,
  date: string,
  now: string,
): AppState {
  const profile = state.profiles[profileId]
  const day = profile?.missions[date]
  if (!profile || !day?.items.some((item) => item.done)) return state
  return patchPlannerState(state, (initial) => {
    let planner = initial
    for (const item of day.items) {
      if (!item.done) continue
      const blockId = `mission:${item.id}`
      const instanceId = plannerBlockInstanceId(profileId, date, blockId)
      const row = planner.progress[instanceId]
      if (!row || (row.status !== 'in-progress' && row.status !== 'paused')) continue
      if (row.status === 'paused') {
        if (row.completionAuthority === 'mission') continue
        planner = {
          ...planner,
          progress: {
            ...planner.progress,
            [instanceId]: {
              ...row,
              completionAuthority: 'mission',
            },
          },
        }
        continue
      }
      const target: PlannerProgressTarget = {
        profileId,
        date,
        blockInstanceId: instanceId,
        blockId,
      }
      planner = settleMissionPlannerTiming(planner, target, now)
    }
    return planner
  })
}
