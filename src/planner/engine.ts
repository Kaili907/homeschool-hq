import type { MissionDay, Profile, SchoolYear } from '../types'
import { isTravelWeek } from '../curriculum/pacing'
import { calculateDailyProgress, elapsedSecondsAt } from './progress'
import {
  blockFromOccurrence,
  formatDayMinute,
  progressNeedsHistoricalOccurrence,
} from './occurrence'
import { plannerBlockInstanceId } from './resume'
import {
  PLANNER_VERSION,
  type DailyPlan,
  type DailyPlanBlock,
  type PlannerAvailabilityNotice,
  type PlannerBlock,
  type PlannerDateOverride,
  type PlannerPlacement,
  type PlannerProgress,
  type PlannerWeekday,
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
  /** Family-local YYYY-MM-DD. Mission mutation eligibility uses this, never UTC. */
  currentLocalDate?: string
  notices?: PlannerAvailabilityNotice[]
}

interface PlanCandidate {
  block: PlannerBlock
  /** Current adapter/template row used for permissions and linked navigation. */
  authorityBlock: PlannerBlock
  origin?: BlockOrigin
  instanceId: string
  progress: PlannerProgress
  preferredStartMinute: number
  durationMinutes: number
  generated: boolean
  sourceAvailable: boolean
  pinned: boolean
  placement?: PlannerPlacement
  /** Derived floor used when a saved placement can only continue as overflow. */
  overflowFloorMinute?: number
}

type BlockOrigin =
  | 'template'
  | 'date-override'
  | 'mission-adapter'
  | 'curriculum-adapter'

interface SourcedBlock {
  block: PlannerBlock
  origin: BlockOrigin
}

interface Interval {
  start: number
  end: number
  instanceId: string
  kind: 'fixed' | 'pinned' | 'flexible'
}

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/

export const timeMinutes = (time: string): number | undefined => {
  if (!TIME_RE.test(time)) return undefined
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export { formatDayMinute } from './occurrence'

export function plannerWeekdayOf(date: string): PlannerWeekday {
  const [year, month, day] = date.split('-').map(Number)
  const js = new Date(year, month - 1, day).getDay()
  return (js === 0 ? 7 : js) as PlannerWeekday
}

export function blockAssignedTo(
  block: PlannerBlock,
  profileId: string,
): boolean {
  return block.assignToAll || block.assignedProfileIds.includes(profileId)
}

function overrideApplies(
  override: PlannerDateOverride,
  profileId: string,
): boolean {
  return !override.profileIds?.length || override.profileIds.includes(profileId)
}

export function plannerSourceIdentity(block: PlannerBlock): string {
  if (block.source.kind === 'mission') {
    return `mission:${encodeURIComponent(block.source.missionItemId)}`
  }
  if (block.source.kind === 'curriculum') {
    const itemIdentity = [...block.source.items]
      .map((item) => item.id)
      .sort()
      .map(encodeURIComponent)
      .join(',')
    return `curriculum:${encodeURIComponent(block.source.subjectId)}:week-${block.source.week}:items-${itemIdentity}`
  }
  if (
    block.source.kind === 'romeo-online' &&
    block.source.activityId
  ) {
    return `romeo-online:${encodeURIComponent(block.source.activityId)}`
  }
  return `manual:${encodeURIComponent(block.id)}`
}

function generatedSource(block: PlannerBlock): boolean {
  return (
    block.source.kind === 'mission' || block.source.kind === 'curriculum'
  )
}

const adapterOrigin = (origin: BlockOrigin): boolean =>
  origin === 'mission-adapter' || origin === 'curriculum-adapter'

/**
 * Overrides are deterministic regardless caller array order. Changes compose in
 * `(updatedAt,id)` order; any remove wins for that target/date. An addition is a
 * date occurrence and therefore does not need ordinary weekday recurrence.
 */
function applyDateOverrides(
  blocks: SourcedBlock[],
  overrides: PlannerDateOverride[],
  profileId: string,
  date: string,
): SourcedBlock[] {
  const result = new Map(
    blocks.map(({ block, origin }) => [
      block.id,
      { block: { ...block }, origin } satisfies SourcedBlock,
    ]),
  )
  const removed = new Set<string>()
  const matching = overrides
    .filter(
      (override) =>
        override.date === date && overrideApplies(override, profileId),
    )
    .sort(
      (left, right) =>
        left.updatedAt.localeCompare(right.updatedAt) ||
        left.id.localeCompare(right.id),
    )

  for (const override of matching) {
    if (override.action === 'remove' && override.targetBlockId) {
      removed.add(override.targetBlockId)
      continue
    }
    if (override.action === 'add' && override.block) {
      const existing = result.get(override.block.id)
      // A persisted date addition cannot replace an adapter-owned row merely by
      // reusing its ID. The adapter remains the source of system metadata.
      if (!existing || !adapterOrigin(existing.origin)) {
        result.set(override.block.id, {
          block: { ...override.block },
          origin: 'date-override',
        })
      }
      continue
    }
    if (
      override.action === 'change' &&
      override.targetBlockId &&
      override.changes
    ) {
      const sourced = result.get(override.targetBlockId)
      if (!sourced) continue
      const { block } = sourced
      const changed: PlannerBlock = {
        ...block,
        ...override.changes,
        id: block.id,
        source: block.source,
        createdAt: block.createdAt,
        updatedAt: override.updatedAt,
      }
      // Route/link metadata for a generated system row is adapter-owned. Date
      // overrides may adjust its schedule/display fields but cannot impersonate
      // another system destination.
      if (adapterOrigin(sourced.origin)) {
        if (block.linkedActivity) {
          changed.linkedActivity = block.linkedActivity
        } else {
          delete changed.linkedActivity
        }
      }
      result.set(block.id, {
        block: changed,
        origin: sourced.origin,
      })
    }
  }
  for (const blockId of removed) result.delete(blockId)
  return [...result.values()]
}

function missionStatus(
  block: PlannerBlock,
  missionDay: MissionDay | undefined,
): boolean | undefined {
  const source = block.source
  if (source.kind !== 'mission') return undefined
  return missionDay?.items.find(
    (item) => item.id === source.missionItemId,
  )?.done
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
    stored.blockId === block.id &&
    stored.blockInstanceId === instanceId
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

  if (block.source.kind !== 'mission') return base

  const done = missionStatus(block, missionDay)
  if (done === true) {
    return {
      ...base,
      completionAuthority: 'mission',
      status: 'completed',
      activeElapsedSeconds: elapsedSecondsAt(base, now),
      activeSince: undefined,
      // MissionDay does not expose a completion timestamp. Never fabricate one.
      completedAt: undefined,
      terminalAt: undefined,
    }
  }

  // Profile.missions is the only completion authority. A source-unchecked item
  // can retain timing/pause data, but no planner terminal status.
  if (
    done === false &&
    (base.status === 'completed' ||
      base.status === 'excused' ||
      base.status === 'moved' ||
      base.status === 'skipped')
  ) {
    return {
      ...base,
      completionAuthority: 'mission',
      status: 'not-started',
      completedAt: undefined,
      terminalAt: undefined,
      parentVerification: undefined,
      completionNote: undefined,
      activeSince: undefined,
    }
  }
  return { ...base, completionAuthority: 'mission' }
}

function dedupeBlocks(blocks: SourcedBlock[]): SourcedBlock[] {
  const byIdentity = new Map<string, SourcedBlock>()
  for (const sourced of blocks) {
    const identity = plannerSourceIdentity(sourced.block)
    const existing = byIdentity.get(identity)
    if (
      !existing ||
      (adapterOrigin(sourced.origin) && !adapterOrigin(existing.origin))
    ) {
      byIdentity.set(identity, sourced)
    }
  }
  return [...byIdentity.values()]
}

function meaningfulDuration(
  block: PlannerBlock,
  progress: PlannerProgress,
  now: string,
): number {
  if (
    !Number.isFinite(block.expectedMinutes) ||
    block.expectedMinutes <= 0
  ) {
    return 0
  }
  if (
    progress.status === 'skipped' ||
    progress.status === 'excused' ||
    progress.status === 'moved'
  ) {
    return Math.max(1, Math.round(block.expectedMinutes))
  }
  return Math.max(
    1,
    Math.round(block.expectedMinutes),
    Math.ceil(elapsedSecondsAt(progress, now) / 60),
  )
}

const statusPinsPlacement = (progress: PlannerProgress): boolean =>
  progressNeedsHistoricalOccurrence(progress)

function intervalsOverlap(
  left: Pick<Interval, 'start' | 'end'>,
  right: Pick<Interval, 'start' | 'end'>,
): boolean {
  return left.start < right.end && right.start < left.end
}

function sortedIntervals(intervals: Interval[]): Interval[] {
  return [...intervals].sort(
    (left, right) =>
      left.start - right.start ||
      left.end - right.end ||
      left.instanceId.localeCompare(right.instanceId),
  )
}

function earliestAvailableStart(
  preferred: number,
  duration: number,
  intervals: Interval[],
): number {
  let candidate = Math.max(0, preferred)
  for (const interval of sortedIntervals(intervals)) {
    if (interval.end <= candidate) continue
    if (candidate + duration <= interval.start) return candidate
    if (candidate < interval.end && candidate + duration > interval.start) {
      candidate = interval.end
    }
  }
  return candidate
}

function scheduledPlacement(
  startMinute: number,
  durationMinutes: number,
): PlannerPlacement {
  const startTime = formatDayMinute(startMinute)
  if (!startTime) {
    return {
      kind: 'overflow',
      order: 1,
      earliestStartMinute: Math.max(1440, startMinute),
      durationMinutes,
      reason: 'past-day-boundary',
    }
  }
  const endMinute = startMinute + durationMinutes
  return {
    kind: 'scheduled',
    startMinute,
    endMinute,
    startTime,
    ...(endMinute > 1440 ? { crossesMidnight: true } : {}),
  }
}

function placementInterval(
  candidate: PlanCandidate,
  placement: PlannerPlacement,
): Interval | undefined {
  if (placement.kind !== 'scheduled') return undefined
  if (
    candidate.progress.status === 'skipped' ||
    candidate.progress.status === 'excused' ||
    candidate.progress.status === 'moved'
  ) {
    return undefined
  }
  return {
    start: placement.startMinute,
    end: Math.max(
      placement.endMinute,
      placement.startMinute + candidate.durationMinutes,
    ),
    instanceId: candidate.instanceId,
    kind:
      candidate.block.scheduleBehavior === 'fixed'
        ? 'fixed'
        : candidate.pinned
          ? 'pinned'
          : 'flexible',
  }
}

const pinnedStatusPriority: Record<PlannerProgress['status'], number> = {
  paused: 0,
  'in-progress': 1,
  completed: 2,
  'not-started': 3,
  skipped: 4,
  excused: 5,
  moved: 6,
}

function parsedPriorityTimestamp(values: Array<string | undefined>): number {
  for (const value of values) {
    if (!value) continue
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return Number.MAX_SAFE_INTEGER
}

/**
 * A newly started block atomically pauses the former active block at the same
 * instant. The paused row wins that tie so the later execution is the row that
 * shifts. Otherwise the earliest current execution segment keeps its placement.
 */
function pinnedExecutionPriority(candidate: PlanCandidate): number {
  const { progress } = candidate
  if (progress.status === 'in-progress') {
    return parsedPriorityTimestamp([
      progress.activeSince,
      progress.startedAt,
      progress.occurrence?.capturedAt,
      progress.updatedAt,
    ])
  }
  if (progress.status === 'paused') {
    return parsedPriorityTimestamp([
      progress.lastPausedAt,
      progress.startedAt,
      progress.occurrence?.capturedAt,
      progress.updatedAt,
    ])
  }
  if (progress.status === 'not-started') {
    return parsedPriorityTimestamp([
      progress.reopenedAt,
      progress.occurrence?.capturedAt,
      progress.updatedAt,
    ])
  }
  return parsedPriorityTimestamp([
    progress.startedAt,
    progress.completedAt,
    progress.terminalAt,
    progress.occurrence?.capturedAt,
    progress.updatedAt,
  ])
}

function placeCandidates(candidates: PlanCandidate[]): void {
  const intervals: Interval[] = []
  const fixedCandidates = candidates.filter(
    (candidate) =>
      candidate.block.scheduleBehavior === 'fixed' &&
      candidate.durationMinutes > 0,
  )

  // First restore immutable saved placement facts and establish fixed events.
  for (const candidate of candidates) {
    if (candidate.durationMinutes <= 0) {
      candidate.placement = {
        kind: 'unavailable',
        reason: 'invalid-duration',
        message: 'Expected duration must be greater than zero.',
      }
      continue
    }
    const saved =
      candidate.pinned && candidate.progress.occurrence
        ? candidate.progress.occurrence.placement
        : undefined
    if (saved) {
      candidate.placement =
        saved.kind === 'scheduled' &&
        candidate.progress.status !== 'skipped' &&
        candidate.progress.status !== 'excused' &&
        candidate.progress.status !== 'moved'
          ? {
              ...saved,
              endMinute: Math.max(
                saved.endMinute,
                saved.startMinute + candidate.durationMinutes,
              ),
              ...(saved.startMinute + candidate.durationMinutes > 1440
                ? { crossesMidnight: true }
                : {}),
            }
          : { ...saved }
    } else if (candidate.block.scheduleBehavior === 'fixed') {
      candidate.placement = scheduledPlacement(
        candidate.preferredStartMinute,
        candidate.durationMinutes,
      )
    }
  }
  for (const candidate of fixedCandidates) {
    if (!candidate.placement) continue
    const interval = placementInterval(candidate, candidate.placement)
    if (interval) intervals.push(interval)
  }

  // Fixed conflicts are facts, not an invitation to silently move either event.
  for (const candidate of fixedCandidates) {
    if (candidate.placement?.kind !== 'scheduled') continue
    const own = placementInterval(candidate, candidate.placement)
    if (!own) continue
    if (
      intervals.some(
        (other) =>
          other.kind === 'fixed' &&
          other.instanceId !== candidate.instanceId &&
          intervalsOverlap(own, other),
      )
    ) {
      candidate.placement = {
        ...candidate.placement,
        conflict: 'fixed-overlap',
      }
    }
  }

  /**
   * Resolve saved flexible executions serially. Snapshot data itself remains
   * untouched; this is the derived effective placement for the current plan.
   * Completed and actively accruing executions are factual and reserve their
   * saved starts first. Paused/reopened work can then shift to the first free
   * interval. Any unavoidable factual overlap receives an explicit marker.
   */
  const pinnedFlexible = candidates
    .filter(
      (candidate) =>
        candidate.pinned &&
        candidate.block.scheduleBehavior === 'flexible' &&
        candidate.placement?.kind === 'scheduled' &&
        candidate.progress.status !== 'skipped' &&
        candidate.progress.status !== 'excused' &&
        candidate.progress.status !== 'moved',
    )
    .sort(
      (left, right) =>
        Number(
          left.progress.status !== 'completed' &&
            left.progress.status !== 'in-progress',
        ) -
          Number(
            right.progress.status !== 'completed' &&
              right.progress.status !== 'in-progress',
          ) ||
        Number(left.progress.status !== 'completed') -
          Number(right.progress.status !== 'completed') ||
        pinnedExecutionPriority(left) - pinnedExecutionPriority(right) ||
        pinnedStatusPriority[left.progress.status] -
          pinnedStatusPriority[right.progress.status] ||
        (left.placement?.kind === 'scheduled'
          ? left.placement.startMinute
          : Number.MAX_SAFE_INTEGER) -
          (right.placement?.kind === 'scheduled'
            ? right.placement.startMinute
            : Number.MAX_SAFE_INTEGER) ||
        left.instanceId.localeCompare(right.instanceId),
    )

  for (const candidate of pinnedFlexible) {
    const savedPlacement = candidate.placement
    if (savedPlacement?.kind !== 'scheduled') continue
    const savedStart = savedPlacement.startMinute
    const savedEnd = Math.max(
      savedPlacement.endMinute,
      savedStart + candidate.durationMinutes,
    )
    const savedInterval = {
      start: savedStart,
      end: savedEnd,
    }
    const conflicts = intervals.some((interval) =>
      intervalsOverlap(savedInterval, interval),
    )

    if (!conflicts && savedEnd <= 1440) {
      candidate.placement = {
        ...savedPlacement,
        endMinute: savedEnd,
        ...(savedEnd > 1440 ? { crossesMidnight: true } : {}),
      }
      const interval = placementInterval(candidate, candidate.placement)
      if (interval) intervals.push(interval)
      continue
    }

    if (
      candidate.progress.status === 'completed' ||
      candidate.progress.status === 'in-progress'
    ) {
      candidate.placement = {
        ...savedPlacement,
        endMinute: savedEnd,
        ...(savedEnd > 1440 ? { crossesMidnight: true } : {}),
        conflict: 'historical-overlap',
      }
      const interval = placementInterval(candidate, candidate.placement)
      if (interval) intervals.push(interval)
      continue
    }

    const shiftedStart = earliestAvailableStart(
      savedStart,
      candidate.durationMinutes,
      intervals,
    )
    if (shiftedStart + candidate.durationMinutes <= 1440) {
      const shifted = scheduledPlacement(
        shiftedStart,
        candidate.durationMinutes,
      )
      candidate.placement =
        shifted.kind === 'scheduled'
          ? { ...shifted, conflict: 'historical-overlap' }
          : shifted
      const interval = placementInterval(candidate, candidate.placement)
      if (interval) intervals.push(interval)
      continue
    }

    // Let the ordinary overflow pass assign a deterministic order after all
    // already-saved overflow rows. The occurrence snapshot remains unchanged.
    candidate.overflowFloorMinute = shiftedStart
    candidate.placement = undefined
  }

  const usedOverflowOrders = new Set<number>()
  let overflowCursor = 1440
  const pinnedOverflow = candidates
    .filter(
      (
        candidate,
      ): candidate is PlanCandidate & {
        placement: Extract<PlannerPlacement, { kind: 'overflow' }>
      } => candidate.placement?.kind === 'overflow',
    )
    .sort(
      (left, right) =>
        left.placement.order - right.placement.order ||
        left.placement.earliestStartMinute -
          right.placement.earliestStartMinute ||
        left.instanceId.localeCompare(right.instanceId),
    )
  for (const candidate of pinnedOverflow) {
    let order = Math.max(1, candidate.placement.order)
    while (usedOverflowOrders.has(order)) order += 1
    usedOverflowOrders.add(order)
    const earliestStartMinute = Math.max(
      1440,
      candidate.placement.earliestStartMinute,
      overflowCursor,
    )
    candidate.placement = {
      ...candidate.placement,
      order,
      earliestStartMinute,
      durationMinutes: candidate.durationMinutes,
    }
    overflowCursor = earliestStartMinute + candidate.durationMinutes
  }

  const flexible = candidates
    .filter(
      (candidate) =>
        candidate.block.scheduleBehavior === 'flexible' &&
        !candidate.placement,
    )
    .sort(
      (left, right) =>
        left.preferredStartMinute - right.preferredStartMinute ||
        left.block.id.localeCompare(right.block.id),
    )
  for (const candidate of flexible) {
    const start = earliestAvailableStart(
      Math.max(
        candidate.preferredStartMinute,
        candidate.overflowFloorMinute ?? 0,
      ),
      candidate.durationMinutes,
      intervals,
    )
    if (start + candidate.durationMinutes > 1440) {
      let order = 1
      while (usedOverflowOrders.has(order)) order += 1
      usedOverflowOrders.add(order)
      const earliestStartMinute = Math.max(start, overflowCursor, 1440)
      candidate.placement = {
        kind: 'overflow',
        order,
        earliestStartMinute,
        durationMinutes: candidate.durationMinutes,
        reason:
          start >= 1440 ? 'past-day-boundary' : 'no-available-interval',
      }
      overflowCursor = earliestStartMinute + candidate.durationMinutes
      continue
    }
    candidate.placement = scheduledPlacement(
      start,
      candidate.durationMinutes,
    )
    const interval = placementInterval(candidate, candidate.placement)
    if (interval) intervals.push(interval)
  }
}

function candidateSortValue(candidate: PlanCandidate): [number, number, string] {
  const placement = candidate.placement
  if (placement?.kind === 'scheduled') {
    return [0, placement.startMinute, candidate.block.id]
  }
  if (placement?.kind === 'overflow') {
    return [1, placement.order, candidate.block.id]
  }
  return [2, candidate.preferredStartMinute, candidate.block.id]
}

function compareCandidates(left: PlanCandidate, right: PlanCandidate): number {
  const a = candidateSortValue(left)
  const b = candidateSortValue(right)
  return a[0] - b[0] || a[1] - b[1] || a[2].localeCompare(b[2])
}

function sourceAvailableFor(
  block: PlannerBlock,
  missionDay: MissionDay | undefined,
  origin: BlockOrigin | undefined,
  currentBlockIds: Set<string>,
): boolean {
  if (block.source.kind === 'mission') {
    return (
      origin === 'mission-adapter' &&
      currentBlockIds.has(block.id) &&
      missionStatus(block, missionDay) !== undefined
    )
  }
  if (block.source.kind === 'curriculum') {
    return origin === 'curriculum-adapter' && currentBlockIds.has(block.id)
  }
  return currentBlockIds.has(block.id)
}

/**
 * Occurrence snapshots retain immutable display/history facts, while current
 * adapter metadata remains authoritative for source permissions and navigation.
 */
function withAuthoritativeAdapterMetadata(
  displayBlock: PlannerBlock,
  authorityBlock: PlannerBlock,
  origin: BlockOrigin | undefined,
): PlannerBlock {
  if (!origin || !adapterOrigin(origin)) return displayBlock
  const merged: PlannerBlock = {
    ...displayBlock,
    category: authorityBlock.category,
    source: authorityBlock.source,
    requiresParentHelp: authorityBlock.requiresParentHelp,
  }
  if (authorityBlock.linkedActivity) {
    merged.linkedActivity = authorityBlock.linkedActivity
  } else {
    delete merged.linkedActivity
  }
  return merged
}

/**
 * Pure daily planner derivation. Source templates, adapters, overrides, and
 * stored progress remain untouched.
 */
export function deriveDailyPlan(input: DeriveDailyPlanInput): DailyPlan {
  const weekday = plannerWeekdayOf(input.date)
  const recurring = input.templates.filter(
    (block) =>
      block.active &&
      block.weekdays.includes(weekday) &&
      blockAssignedTo(block, input.student.id),
  )
  const sourced: SourcedBlock[] = [
    ...recurring.map((block) => ({
      block,
      origin: 'template' as const,
    })),
    ...input.missionBlocks.map((block) => ({
      block,
      origin: 'mission-adapter' as const,
    })),
    ...input.curriculumBlocks.map((block) => ({
      block,
      origin: 'curriculum-adapter' as const,
    })),
  ]
  let blocks = applyDateOverrides(
    sourced,
    input.overrides,
    input.student.id,
    input.date,
  ).filter(
    ({ block }) =>
      block.active &&
      blockAssignedTo(block, input.student.id) &&
      !(
        block.source.kind === 'curriculum' &&
        isTravelWeek(input.schoolYear, input.date)
      ),
  )
  blocks = dedupeBlocks(blocks)
  const currentBlockIds = new Set(blocks.map(({ block }) => block.id))

  const candidateByInstance = new Map<string, PlanCandidate>()
  for (const { block: sourceBlock, origin } of blocks) {
    const instanceId = plannerBlockInstanceId(
      input.student.id,
      input.date,
      sourceBlock.id,
    )
    const progress = progressFor(
      sourceBlock,
      input.student.id,
      input.date,
      instanceId,
      input.storedProgress[instanceId],
      input.missionDay,
      input.now,
    )
    const preferredStartMinute = timeMinutes(sourceBlock.startTime)
    const snapshotWins =
      progress.occurrence && statusPinsPlacement(progress)
        ? progress.occurrence
        : undefined
    const block = snapshotWins
      ? blockFromOccurrence(snapshotWins)
      : { ...sourceBlock }
    candidateByInstance.set(instanceId, {
      block,
      authorityBlock: sourceBlock,
      origin,
      instanceId,
      progress,
      preferredStartMinute:
        snapshotWins?.preferredStartMinute ??
        preferredStartMinute ??
        0,
      durationMinutes: meaningfulDuration(block, progress, input.now),
      generated: adapterOrigin(origin),
      sourceAvailable: sourceAvailableFor(
        sourceBlock,
        input.missionDay,
        origin,
        currentBlockIds,
      ),
      pinned: Boolean(snapshotWins),
    })
  }

  // Snapshot-backed execution history survives removal, deactivation, travel
  // suppression, and later template edits.
  for (const progress of Object.values(input.storedProgress)) {
    if (
      progress.profileId !== input.student.id ||
      progress.date !== input.date ||
      !progress.occurrence ||
      !progressNeedsHistoricalOccurrence(progress) ||
      candidateByInstance.has(progress.blockInstanceId)
    ) {
      continue
    }
    const occurrence = progress.occurrence
    const block = blockFromOccurrence(occurrence)
    candidateByInstance.set(progress.blockInstanceId, {
      block,
      authorityBlock: block,
      instanceId: progress.blockInstanceId,
      progress: { ...progress },
      preferredStartMinute: occurrence.preferredStartMinute,
      durationMinutes: meaningfulDuration(block, progress, input.now),
      generated: generatedSource(block),
      sourceAvailable: sourceAvailableFor(
        block,
        input.missionDay,
        undefined,
        currentBlockIds,
      ),
      pinned: true,
    })
  }

  const candidates = [...candidateByInstance.values()]
  placeCandidates(candidates)
  candidates.sort(compareCandidates)

  const notices = [...(input.notices ?? [])]
  const dailyBlocks: DailyPlanBlock[] = candidates.map((candidate) => {
    const block = withAuthoritativeAdapterMetadata(
      candidate.block,
      candidate.authorityBlock,
      candidate.origin,
    )
    let placement =
      candidate.placement ??
      ({
        kind: 'unavailable',
        reason: 'invalid-duration',
        message: 'This activity has no valid schedule duration.',
      } satisfies PlannerPlacement)
    if (!candidate.sourceAvailable && placement.kind === 'unavailable') {
      placement = {
        kind: 'unavailable',
        reason: 'missing-source',
        message: 'The linked source activity is no longer available.',
      }
    }
    if (!candidate.sourceAvailable) {
      const noticeId = `missing-source:${candidate.instanceId}`
      if (!notices.some((notice) => notice.id === noticeId)) {
        notices.push({
          id: noticeId,
          profileId: input.student.id,
          date: input.date,
          reason: 'missing-source',
          title: block.title,
          message: 'The linked source activity is no longer available.',
        })
      }
    }
    const mission = block.source.kind === 'mission'
    const autoOnlyMission =
      mission && block.source.kind === 'mission'
        ? block.source.autoOnly
        : false
    const today = input.currentLocalDate ?? input.date
    const actionablePlacement = placement.kind !== 'unavailable'
    const canStart = candidate.sourceAvailable && actionablePlacement
    return {
      profileId: input.student.id,
      date: input.date,
      instanceId: candidate.instanceId,
      block: { ...block },
      scheduledStartTime: block.startTime,
      preferredStartMinute: candidate.preferredStartMinute,
      placement,
      ...(placement.kind === 'scheduled'
        ? { effectiveStartTime: placement.startTime }
        : {}),
      progress: candidate.progress,
      canManuallyComplete:
        candidate.sourceAvailable &&
        actionablePlacement &&
        !autoOnlyMission &&
        (!mission || input.date === today),
      canSetDisposition: !mission && candidate.sourceAvailable,
      canStart,
      ...(!candidate.sourceAvailable
        ? {
            unavailableReason:
              'The linked source activity is no longer available.',
          }
        : placement.kind === 'unavailable'
          ? { unavailableReason: placement.message }
          : {}),
      generated: candidate.generated,
    }
  })

  return {
    profileId: input.student.id,
    date: input.date,
    blocks: dailyBlocks,
    notices,
    compatibility: { kind: 'supported', version: PLANNER_VERSION },
    summary: calculateDailyProgress(dailyBlocks, input.now),
  }
}
