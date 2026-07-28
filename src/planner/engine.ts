import type { MissionDay, Profile, SchoolYear } from '../types'
import { isTravelWeek } from '../curriculum/pacing'
import { calculateDailyProgress, elapsedSecondsAt } from './progress'
import { plannerBlockInstanceId } from './resume'
import type {
  DailyPlan,
  DailyPlanBlock,
  PlannerBlock,
  PlannerDateOverride,
  PlannerProgress,
  PlannerWeekday,
} from './types'

export interface DeriveDailyPlanInput {
  templates: PlannerBlock[]
  overrides: PlannerDateOverride[]
  student: Profile
  date: string
  schoolYear: SchoolYear
  missionDay?: MissionDay
  missionBlocks: PlannerBlock[]
  curriculumBlocks: PlannerBlock[]
  storedProgress: Record<string, PlannerProgress>
  /** ISO timestamp supplied by the caller so derivation stays deterministic. */
  now: string
}

const timeMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

const pad = (value: number): string => String(value).padStart(2, '0')
const formatMinutes = (minutes: number): string => {
  const safe = Math.max(0, Math.min(1439, Math.round(minutes)))
  return `${pad(Math.floor(safe / 60))}:${pad(safe % 60)}`
}

export function plannerWeekdayOf(date: string): PlannerWeekday {
  const [year, month, day] = date.split('-').map(Number)
  const js = new Date(year, month - 1, day).getDay()
  return (js === 0 ? 7 : js) as PlannerWeekday
}

export function blockAssignedTo(block: PlannerBlock, profileId: string): boolean {
  return block.assignToAll || block.assignedProfileIds.includes(profileId)
}

function overrideApplies(override: PlannerDateOverride, profileId: string): boolean {
  return !override.profileIds?.length || override.profileIds.includes(profileId)
}

function sourceIdentity(block: PlannerBlock): string {
  if (block.source.kind === 'mission') return `mission:${block.source.missionItemId}`
  if (block.source.kind === 'curriculum') {
    return `curriculum:${block.source.subjectId}:week-${block.source.week}`
  }
  if (block.source.kind === 'romeo-online' && block.source.activityId) {
    return `romeo-online:${block.source.activityId}:${block.id}`
  }
  return `block:${block.id}`
}

function applyDateOverrides(
  blocks: PlannerBlock[],
  overrides: PlannerDateOverride[],
  profileId: string,
  date: string,
): PlannerBlock[] {
  let result = blocks.map((block) => ({ ...block }))
  for (const override of overrides) {
    if (override.date !== date || !overrideApplies(override, profileId)) continue
    if (override.action === 'add' && override.block) {
      result.push({ ...override.block })
      continue
    }
    if (!override.targetBlockId) continue
    if (override.action === 'remove') {
      result = result.filter((block) => block.id !== override.targetBlockId)
      continue
    }
    if (override.action === 'change' && override.changes) {
      result = result.map((block) =>
        block.id === override.targetBlockId
          ? {
              ...block,
              ...override.changes,
              id: block.id,
              source: block.source,
              createdAt: block.createdAt,
              updatedAt: override.updatedAt,
            }
          : block,
      )
    }
  }
  return result
}

function missionStatus(
  block: PlannerBlock,
  missionDay: MissionDay | undefined,
): boolean | undefined {
  const source = block.source
  if (source.kind !== 'mission') return undefined
  return missionDay?.items.find((item) => item.id === source.missionItemId)?.done
}

function progressFor(
  block: PlannerBlock,
  profileId: string,
  date: string,
  instanceId: string,
  stored: PlannerProgress | undefined,
  missionDay: MissionDay | undefined,
  now: string,
): PlannerProgress {
  const base: PlannerProgress =
    stored &&
    stored.profileId === profileId &&
    stored.date === date &&
    stored.blockId === block.id
      ? { ...stored }
      : {
          profileId,
          date,
          blockInstanceId: instanceId,
          blockId: block.id,
          status: 'not-started',
          activeElapsedSeconds: 0,
          updatedAt: `${date}T00:00:00.000`,
        }

  const done = missionStatus(block, missionDay)
  if (done === true) {
    return {
      ...base,
      status: 'completed',
      activeElapsedSeconds: elapsedSecondsAt(base, now),
      activeSince: undefined,
      completedAt: base.completedAt,
    }
  }
  // A mission can be unchecked in its source system; a stale planner mirror
  // must never keep it completed.
  if (done === false && base.status === 'completed') {
    return { ...base, status: 'not-started', completedAt: undefined, activeSince: undefined }
  }
  return base
}

function dedupeBlocks(blocks: PlannerBlock[]): PlannerBlock[] {
  const seen = new Set<string>()
  const result: PlannerBlock[] = []
  for (const block of blocks) {
    const identity = sourceIdentity(block)
    if (seen.has(identity)) continue
    seen.add(identity)
    result.push(block)
  }
  return result
}

/**
 * Pure daily planner derivation. Every output row is newly allocated; source
 * templates, mission days, curriculum rows, overrides, and progress are untouched.
 */
export function deriveDailyPlan(input: DeriveDailyPlanInput): DailyPlan {
  const weekday = plannerWeekdayOf(input.date)
  const recurring = input.templates.filter(
    (block) =>
      block.active &&
      block.weekdays.includes(weekday) &&
      blockAssignedTo(block, input.student.id),
  )
  const generated = [...input.missionBlocks, ...input.curriculumBlocks]
  let candidates = applyDateOverrides(
    [...recurring, ...generated],
    input.overrides,
    input.student.id,
    input.date,
  ).filter(
    (block) =>
      block.active &&
      blockAssignedTo(block, input.student.id) &&
      !(block.source.kind === 'curriculum' && isTravelWeek(input.schoolYear, input.date)),
  )
  candidates = dedupeBlocks(candidates)
  candidates.sort(
    (left, right) =>
      timeMinutes(left.startTime) - timeMinutes(right.startTime) ||
      left.id.localeCompare(right.id),
  )

  const blocks: DailyPlanBlock[] = []
  let cursor = 0
  for (const block of candidates) {
    const instanceId = plannerBlockInstanceId(input.student.id, input.date, block.id)
    const progress = progressFor(
      block,
      input.student.id,
      input.date,
      instanceId,
      input.storedProgress[instanceId],
      input.missionDay,
      input.now,
    )
    const scheduled = timeMinutes(block.startTime)
    const flexibleUnstarted =
      block.scheduleBehavior === 'flexible' && progress.status === 'not-started'
    const effective = flexibleUnstarted ? Math.max(scheduled, cursor) : scheduled
    const ignoredDuration = ['skipped', 'excused', 'moved'].includes(progress.status)
    const actualMinutes = Math.ceil(elapsedSecondsAt(progress, input.now) / 60)
    const duration = ignoredDuration ? 0 : Math.max(block.expectedMinutes, actualMinutes)
    cursor =
      block.scheduleBehavior === 'fixed'
        ? Math.max(cursor, scheduled + duration)
        : Math.max(cursor, effective + duration)

    const generatedBlock =
      block.source.kind === 'mission' || block.source.kind === 'curriculum'
    const autoOnlyMission =
      block.source.kind === 'mission' && block.source.autoOnly
    const mission = block.source.kind === 'mission'
    blocks.push({
      profileId: input.student.id,
      date: input.date,
      instanceId,
      block: { ...block },
      scheduledStartTime: block.startTime,
      effectiveStartTime: formatMinutes(effective),
      progress,
      canManuallyComplete: !autoOnlyMission,
      canSetDisposition: !mission,
      generated: generatedBlock,
    })
  }

  return {
    profileId: input.student.id,
    date: input.date,
    blocks,
    summary: calculateDailyProgress(blocks, input.now),
  }
}
