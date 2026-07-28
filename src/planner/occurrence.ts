import type {
  DailyPlanBlock,
  PlannerBlock,
  PlannerOccurrenceSnapshot,
  PlannerPlacement,
  PlannerProgress,
} from './types'

const pad = (value: number): string => String(value).padStart(2, '0')

/** Only integer minutes in one local calendar day have a wall-clock label. */
export function formatDayMinute(minutes: number): string | undefined {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= 1440) {
    return undefined
  }
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
}

const parsePreferredMinute = (time: string): number => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time)
  if (!match) return 0
  return Number(match[1]) * 60 + Number(match[2])
}

const validDuration = (value: number): number =>
  Number.isFinite(value) && value > 0 ? Math.max(1, Math.round(value)) : 1

/**
 * Capture the exact row that was validated for an action. Callers must retain an
 * existing snapshot rather than replacing it: historical display facts are
 * append-only.
 */
export function snapshotForDailyPlanBlock(
  row: DailyPlanBlock,
  capturedAt: string,
): PlannerOccurrenceSnapshot {
  return {
    provenance: 'captured',
    blockInstanceId: row.instanceId,
    blockId: row.block.id,
    profileId: row.profileId,
    date: row.date,
    title: row.block.title,
    studentInstructions: row.block.studentInstructions,
    ...(row.block.parentNotes !== undefined
      ? { parentNotes: row.block.parentNotes }
      : {}),
    category: row.block.category,
    source: row.block.source,
    preferredStartTime: row.scheduledStartTime,
    preferredStartMinute: row.preferredStartMinute,
    placement: row.placement,
    expectedMinutes: row.block.expectedMinutes,
    scheduleBehavior: row.block.scheduleBehavior,
    ...(row.block.linkedActivity
      ? { linkedActivity: row.block.linkedActivity }
      : {}),
    requiresParentHelp: row.block.requiresParentHelp,
    ...(row.block.location !== undefined ? { location: row.block.location } : {}),
    capturedAt,
  }
}

/**
 * Best-effort v1/template snapshot. Old rows created before occurrence snapshots
 * cannot reveal a formerly shifted start, so the preferred wall time is retained
 * honestly instead of inventing a shift.
 */
export function snapshotForLegacyProgress(
  block: PlannerBlock,
  progress: PlannerProgress,
  capturedAt: string,
): PlannerOccurrenceSnapshot {
  const preferredStartMinute = parsePreferredMinute(block.startTime)
  const expectedMinutes = validDuration(block.expectedMinutes)
  const placement: PlannerPlacement = {
    kind: 'scheduled',
    startMinute: preferredStartMinute,
    endMinute: preferredStartMinute + expectedMinutes,
    startTime: block.startTime,
    ...(preferredStartMinute + expectedMinutes > 1440
      ? { crossesMidnight: true }
      : {}),
  }
  return {
    provenance: 'legacy-template',
    blockInstanceId: progress.blockInstanceId,
    blockId: block.id,
    profileId: progress.profileId,
    date: progress.date,
    title: block.title,
    studentInstructions: block.studentInstructions,
    ...(block.parentNotes !== undefined ? { parentNotes: block.parentNotes } : {}),
    category: block.category,
    source: block.source,
    preferredStartTime: block.startTime,
    preferredStartMinute,
    placement,
    expectedMinutes,
    scheduleBehavior: block.scheduleBehavior,
    ...(block.linkedActivity ? { linkedActivity: block.linkedActivity } : {}),
    requiresParentHelp: block.requiresParentHelp,
    ...(block.location !== undefined ? { location: block.location } : {}),
    capturedAt,
  }
}

export function archivedSnapshotForProgress(
  progress: PlannerProgress,
  capturedAt: string,
): PlannerOccurrenceSnapshot {
  const missionOwned =
    progress.completionAuthority === 'mission' ||
    progress.blockId.startsWith('mission:')
  const missionItemId = progress.blockId.startsWith('mission:')
    ? progress.blockId.slice('mission:'.length)
    : progress.blockId
  return {
    provenance: 'normalized-archive',
    blockInstanceId: progress.blockInstanceId,
    blockId: progress.blockId,
    profileId: progress.profileId,
    date: progress.date,
    title: missionOwned ? 'Archived mission activity' : 'Archived activity',
    studentInstructions:
      'This activity was recorded by an older planner version. Its original schedule details are no longer available.',
    category: missionOwned ? 'existing-mission' : 'custom',
    source: missionOwned
      ? { kind: 'mission', missionItemId, autoOnly: false }
      : { kind: 'manual' },
    preferredStartTime: '00:00',
    preferredStartMinute: 0,
    placement: {
      kind: 'unavailable',
      reason: 'missing-source',
      message: 'Original schedule details are unavailable.',
    },
    expectedMinutes: 1,
    scheduleBehavior: 'flexible',
    requiresParentHelp: false,
    capturedAt,
  }
}

export function blockFromOccurrence(
  occurrence: PlannerOccurrenceSnapshot,
): PlannerBlock {
  return {
    id: occurrence.blockId,
    title: occurrence.title,
    studentInstructions: occurrence.studentInstructions,
    ...(occurrence.parentNotes !== undefined
      ? { parentNotes: occurrence.parentNotes }
      : {}),
    category: occurrence.category,
    source: occurrence.source,
    assignedProfileIds: [occurrence.profileId],
    assignToAll: false,
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    startTime: occurrence.preferredStartTime,
    expectedMinutes: occurrence.expectedMinutes,
    scheduleBehavior: occurrence.scheduleBehavior,
    ...(occurrence.linkedActivity
      ? { linkedActivity: occurrence.linkedActivity }
      : {}),
    requiresParentHelp: occurrence.requiresParentHelp,
    ...(occurrence.location !== undefined
      ? { location: occurrence.location }
      : {}),
    active: false,
    createdAt: occurrence.capturedAt,
    updatedAt: occurrence.capturedAt,
  }
}

export function retainOccurrence(
  progress: PlannerProgress,
  next: PlannerOccurrenceSnapshot,
): PlannerProgress {
  return progress.occurrence ? progress : { ...progress, occurrence: next }
}

export function progressNeedsHistoricalOccurrence(
  progress: PlannerProgress,
): boolean {
  return (
    progress.reopenedAt !== undefined ||
    progress.status === 'in-progress' ||
    progress.status === 'paused' ||
    progress.status === 'completed' ||
    progress.status === 'skipped' ||
    progress.status === 'excused' ||
    progress.status === 'moved'
  )
}
