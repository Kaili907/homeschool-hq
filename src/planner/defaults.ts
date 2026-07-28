import type { AppState } from '../types'
import {
  archivedSnapshotForProgress,
  formatDayMinute,
  progressNeedsHistoricalOccurrence,
  snapshotForLegacyProgress,
} from './occurrence'
import { plannerBlockInstanceId } from './resume'
import {
  PLANNER_VERSION,
  type LinkedPlannerActivity,
  type ParentVerification,
  type PlannerActivityCategory,
  type PlannerActivitySource,
  type PlannerBlock,
  type PlannerBlockChanges,
  type PlannerBlockStatus,
  type PlannerDateOverride,
  type PlannerJsonObject,
  type PlannerJsonValue,
  type PlannerOccurrenceSnapshot,
  type PlannerPersistedState,
  type PlannerPlacement,
  type PlannerProgress,
  type PlannerState,
  type PlannerWeekday,
  type ResumePointer,
  type UnsupportedPlannerState,
} from './types'

export { PLANNER_VERSION } from './types'

export const ACTIVITY_CATEGORY_LABELS: Record<PlannerActivityCategory, string> = {
  'romeo-online': 'Romeo Online',
  'manuel-academy': 'Manuel Academy',
  'existing-mission': 'Existing Mission',
  wrestling: 'Wrestling',
  'jiu-jitsu': 'Jiu-jitsu',
  'weight-training': 'Weight Training',
  'other-pe': 'Other PE',
  reading: 'Reading',
  meal: 'Meal',
  break: 'Break',
  appointment: 'Appointment',
  'family-responsibility': 'Family Responsibility',
  custom: 'Custom',
}

/** Ordinary manual creation can never impersonate adapter-owned generated work. */
export const MANUAL_ACTIVITY_CATEGORIES = [
  'romeo-online',
  'wrestling',
  'jiu-jitsu',
  'weight-training',
  'other-pe',
  'reading',
  'meal',
  'break',
  'appointment',
  'family-responsibility',
  'custom',
] as const satisfies readonly PlannerActivityCategory[]

export type ManualPlannerActivityCategory =
  (typeof MANUAL_ACTIVITY_CATEGORIES)[number]

export const PLANNER_STATUS_LABELS: Record<PlannerBlockStatus, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  paused: 'Paused',
  completed: 'Completed',
  skipped: 'Skipped',
  excused: 'Excused',
  moved: 'Moved',
}

export const ALL_PLANNER_WEEKDAYS: PlannerWeekday[] = [1, 2, 3, 4, 5, 6, 7]
export const SCHOOL_WEEKDAYS: PlannerWeekday[] = [1, 2, 3, 4, 5]

export function defaultPlannerState(): PlannerState {
  return { version: PLANNER_VERSION, blocks: [], overrides: [], progress: {} }
}

export type PlannerStateReadResult =
  | { kind: 'supported'; state: PlannerState; migrated: boolean }
  | {
      kind: 'unsupported-newer'
      version: number
      raw: UnsupportedPlannerState
    }

const CATEGORIES = new Set(Object.keys(ACTIVITY_CATEGORY_LABELS))
const MANUAL_CATEGORIES = new Set<string>(MANUAL_ACTIVITY_CATEGORIES)
const STATUSES = new Set(Object.keys(PLANNER_STATUS_LABELS))
const SOURCE_KINDS = new Set(['manual', 'mission', 'curriculum', 'romeo-online'])
const ADAPTERS = new Set(['mission', 'curriculum', 'romeo-online', 'route'])
const AUTO_KINDS = new Set(['math', 'typing', 'reading', 'mindset'])
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/

const recordOf = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []

const weekdays = (value: unknown): PlannerWeekday[] => {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value.filter(
        (day): day is PlannerWeekday =>
          Number.isInteger(day) && Number(day) >= 1 && Number(day) <= 7,
      ),
    ),
  ]
}

function jsonValue(value: unknown, depth = 0): PlannerJsonValue | undefined {
  if (depth > 20) return undefined
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (Array.isArray(value)) {
    const items: PlannerJsonValue[] = []
    for (const item of value) {
      const safe = jsonValue(item, depth + 1)
      if (safe === undefined) return undefined
      items.push(safe)
    }
    return items
  }
  const record = recordOf(value)
  if (!record) return undefined
  const safe: PlannerJsonObject = {}
  for (const [key, item] of Object.entries(record)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
      continue
    }
    const normalized = jsonValue(item, depth + 1)
    if (normalized !== undefined) safe[key] = normalized
  }
  return safe
}

function safeObject(value: unknown): PlannerJsonObject | null {
  const safe = jsonValue(value)
  return safe && !Array.isArray(safe) && typeof safe === 'object' ? safe : null
}

function extensions(
  value: Record<string, unknown>,
  known: readonly string[],
): PlannerJsonObject {
  const result: PlannerJsonObject = {}
  const knownKeys = new Set(known)
  for (const [key, item] of Object.entries(value)) {
    if (
      knownKeys.has(key) ||
      key === '__proto__' ||
      key === 'prototype' ||
      key === 'constructor'
    ) {
      continue
    }
    const safe = jsonValue(item)
    if (safe !== undefined) result[key] = safe
  }
  return result
}

function normalizeSource(value: unknown): PlannerActivitySource | null {
  const source = recordOf(value)
  if (
    !source ||
    typeof source.kind !== 'string' ||
    !SOURCE_KINDS.has(source.kind)
  ) {
    return null
  }
  if (source.kind === 'manual') {
    return {
      ...extensions(source, ['kind']),
      kind: 'manual',
    } as PlannerActivitySource
  }
  if (source.kind === 'romeo-online') {
    return {
      ...extensions(source, ['kind', 'activityId']),
      kind: 'romeo-online',
      ...(typeof source.activityId === 'string'
        ? { activityId: source.activityId }
        : {}),
    } as PlannerActivitySource
  }
  if (source.kind === 'mission') {
    if (
      typeof source.missionItemId !== 'string' ||
      typeof source.autoOnly !== 'boolean'
    ) {
      return null
    }
    return {
      ...extensions(source, [
        'kind',
        'missionItemId',
        'autoOnly',
        'autoKind',
      ]),
      kind: 'mission',
      missionItemId: source.missionItemId,
      autoOnly: source.autoOnly,
      ...(typeof source.autoKind === 'string' &&
      AUTO_KINDS.has(source.autoKind)
        ? {
            autoKind: source.autoKind as
              | 'math'
              | 'typing'
              | 'reading'
              | 'mindset',
          }
        : {}),
    } as PlannerActivitySource
  }
  if (
    typeof source.subjectId !== 'string' ||
    typeof source.subjectLabel !== 'string' ||
    !Number.isInteger(source.week) ||
    !Array.isArray(source.items)
  ) {
    return null
  }
  const items = source.items.flatMap((item) => {
    const row = recordOf(item)
    return row &&
      typeof row.id === 'string' &&
      typeof row.text === 'string' &&
      typeof row.dadTaught === 'boolean'
      ? [
          {
            ...extensions(row, ['id', 'text', 'dadTaught']),
            id: row.id,
            text: row.text,
            dadTaught: row.dadTaught,
          },
        ]
      : []
  })
  return {
    ...extensions(source, [
      'kind',
      'subjectId',
      'subjectLabel',
      'week',
      'items',
    ]),
    kind: 'curriculum',
    subjectId: source.subjectId,
    subjectLabel: source.subjectLabel,
    week: source.week as number,
    items,
  } as PlannerActivitySource
}

function normalizeLinkedActivity(
  value: unknown,
): LinkedPlannerActivity | undefined {
  const linked = recordOf(value)
  if (
    !linked ||
    typeof linked.adapter !== 'string' ||
    !ADAPTERS.has(linked.adapter) ||
    typeof linked.activityId !== 'string'
  ) {
    return undefined
  }
  const safeData = safeObject(linked.safeEntryData)
  return {
    ...extensions(linked, [
      'adapter',
      'activityId',
      'route',
      'lessonId',
      'stepId',
      'itemId',
      'safeEntryData',
    ]),
    adapter: linked.adapter as LinkedPlannerActivity['adapter'],
    activityId: linked.activityId,
    ...(typeof linked.route === 'string' ? { route: linked.route } : {}),
    ...(typeof linked.lessonId === 'string'
      ? { lessonId: linked.lessonId }
      : {}),
    ...(typeof linked.stepId === 'string' ? { stepId: linked.stepId } : {}),
    ...(typeof linked.itemId === 'string' ? { itemId: linked.itemId } : {}),
    ...(safeData ? { safeEntryData: safeData } : {}),
  } as LinkedPlannerActivity
}

function normalizeCategory(
  value: unknown,
  source: PlannerActivitySource,
): PlannerActivityCategory | null {
  if (source.kind === 'mission') return 'existing-mission'
  if (source.kind === 'curriculum') return 'manuel-academy'
  if (source.kind === 'romeo-online') return 'romeo-online'
  if (typeof value !== 'string' || !CATEGORIES.has(value)) return null
  return MANUAL_CATEGORIES.has(value)
    ? (value as PlannerActivityCategory)
    : 'custom'
}

export function normalizePlannerBlock(value: unknown): PlannerBlock | null {
  const block = recordOf(value)
  const source = block ? normalizeSource(block.source) : null
  const category = source ? normalizeCategory(block?.category, source) : null
  if (
    !block ||
    !source ||
    !category ||
    typeof block.id !== 'string' ||
    !block.id ||
    typeof block.title !== 'string' ||
    typeof block.startTime !== 'string' ||
    !TIME_RE.test(block.startTime) ||
    typeof block.expectedMinutes !== 'number' ||
    !Number.isFinite(block.expectedMinutes) ||
    block.expectedMinutes <= 0 ||
    (block.scheduleBehavior !== 'flexible' &&
      block.scheduleBehavior !== 'fixed') ||
    typeof block.requiresParentHelp !== 'boolean' ||
    typeof block.active !== 'boolean' ||
    typeof block.createdAt !== 'string' ||
    typeof block.updatedAt !== 'string'
  ) {
    return null
  }
  const days = weekdays(block.weekdays)
  if (days.length === 0) return null
  const studentInstructions =
    typeof block.studentInstructions === 'string'
      ? block.studentInstructions
      : typeof block.description === 'string'
        ? block.description
        : ''
  const parentNotes =
    typeof block.parentNotes === 'string'
      ? block.parentNotes
      : typeof block.notes === 'string'
        ? block.notes
        : undefined
  const linked = normalizeLinkedActivity(block.linkedActivity)
  return {
    ...extensions(block, [
      'id',
      'title',
      'studentInstructions',
      'parentNotes',
      'description',
      'notes',
      'category',
      'source',
      'assignedProfileIds',
      'assignToAll',
      'weekdays',
      'startTime',
      'expectedMinutes',
      'scheduleBehavior',
      'linkedActivity',
      'requiresParentHelp',
      'location',
      'active',
      'createdAt',
      'updatedAt',
    ]),
    id: block.id,
    title: block.title,
    studentInstructions,
    ...(parentNotes !== undefined ? { parentNotes } : {}),
    category,
    source,
    assignedProfileIds: [...new Set(strings(block.assignedProfileIds))],
    assignToAll: block.assignToAll === true,
    weekdays: days,
    startTime: block.startTime,
    expectedMinutes: Math.max(1, Math.round(block.expectedMinutes)),
    scheduleBehavior: block.scheduleBehavior,
    ...(linked ? { linkedActivity: linked } : {}),
    requiresParentHelp: block.requiresParentHelp,
    ...(typeof block.location === 'string'
      ? { location: block.location }
      : {}),
    active: block.active,
    createdAt: block.createdAt,
    updatedAt: block.updatedAt,
  } as PlannerBlock
}

function normalizeChanges(value: unknown): PlannerBlockChanges | undefined {
  const changes = recordOf(value)
  if (!changes) return undefined
  const normalized: PlannerBlockChanges = {
    ...extensions(changes, [
      'title',
      'studentInstructions',
      'parentNotes',
      'description',
      'notes',
      'category',
      'assignedProfileIds',
      'assignToAll',
      'weekdays',
      'startTime',
      'expectedMinutes',
      'scheduleBehavior',
      'linkedActivity',
      'requiresParentHelp',
      'location',
      'active',
    ]),
  }
  if (typeof changes.title === 'string') normalized.title = changes.title
  if (typeof changes.studentInstructions === 'string') {
    normalized.studentInstructions = changes.studentInstructions
  } else if (typeof changes.description === 'string') {
    normalized.studentInstructions = changes.description
  }
  if (typeof changes.parentNotes === 'string') {
    normalized.parentNotes = changes.parentNotes
  } else if (typeof changes.notes === 'string') {
    normalized.parentNotes = changes.notes
  }
  if (
    typeof changes.category === 'string' &&
    MANUAL_CATEGORIES.has(changes.category)
  ) {
    normalized.category = changes.category as PlannerActivityCategory
  }
  if (Array.isArray(changes.assignedProfileIds)) {
    normalized.assignedProfileIds = [
      ...new Set(strings(changes.assignedProfileIds)),
    ]
  }
  if (typeof changes.assignToAll === 'boolean') {
    normalized.assignToAll = changes.assignToAll
  }
  const days = weekdays(changes.weekdays)
  if (days.length > 0) normalized.weekdays = days
  if (
    typeof changes.startTime === 'string' &&
    TIME_RE.test(changes.startTime)
  ) {
    normalized.startTime = changes.startTime
  }
  if (
    typeof changes.expectedMinutes === 'number' &&
    Number.isFinite(changes.expectedMinutes) &&
    changes.expectedMinutes > 0
  ) {
    normalized.expectedMinutes = Math.round(changes.expectedMinutes)
  }
  if (
    changes.scheduleBehavior === 'flexible' ||
    changes.scheduleBehavior === 'fixed'
  ) {
    normalized.scheduleBehavior = changes.scheduleBehavior
  }
  const linked = normalizeLinkedActivity(changes.linkedActivity)
  if (linked) normalized.linkedActivity = linked
  if (typeof changes.requiresParentHelp === 'boolean') {
    normalized.requiresParentHelp = changes.requiresParentHelp
  }
  if (typeof changes.location === 'string') {
    normalized.location = changes.location
  }
  if (typeof changes.active === 'boolean') normalized.active = changes.active
  return normalized
}

function normalizeOverride(value: unknown): PlannerDateOverride | null {
  const override = recordOf(value)
  if (
    !override ||
    typeof override.id !== 'string' ||
    typeof override.date !== 'string' ||
    !ISO_DATE_RE.test(override.date) ||
    (override.action !== 'add' &&
      override.action !== 'remove' &&
      override.action !== 'change') ||
    typeof override.createdAt !== 'string' ||
    typeof override.updatedAt !== 'string'
  ) {
    return null
  }
  const block = normalizePlannerBlock(override.block)
  if (override.action === 'add' && !block) return null
  if (
    override.action !== 'add' &&
    typeof override.targetBlockId !== 'string'
  ) {
    return null
  }
  const changes = normalizeChanges(override.changes)
  return {
    ...extensions(override, [
      'id',
      'date',
      'action',
      'profileIds',
      'targetBlockId',
      'block',
      'changes',
      'createdAt',
      'updatedAt',
    ]),
    id: override.id,
    date: override.date,
    action: override.action,
    ...(Array.isArray(override.profileIds)
      ? { profileIds: [...new Set(strings(override.profileIds))] }
      : {}),
    ...(typeof override.targetBlockId === 'string'
      ? { targetBlockId: override.targetBlockId }
      : {}),
    ...(block ? { block } : {}),
    ...(changes ? { changes } : {}),
    createdAt: override.createdAt,
    updatedAt: override.updatedAt,
  } as PlannerDateOverride
}

function normalizeResumePointer(value: unknown): ResumePointer | undefined {
  const pointer = recordOf(value)
  if (!pointer || typeof pointer.updatedAt !== 'string') return undefined
  const data = safeObject(pointer.adapterData)
  return {
    ...extensions(pointer, [
      'adapter',
      'blockId',
      'route',
      'activityId',
      'lessonId',
      'stepId',
      'questionId',
      'itemId',
      'adapterData',
      'updatedAt',
    ]),
    ...(typeof pointer.adapter === 'string' && ADAPTERS.has(pointer.adapter)
      ? { adapter: pointer.adapter as LinkedPlannerActivity['adapter'] }
      : {}),
    ...(typeof pointer.blockId === 'string'
      ? { blockId: pointer.blockId }
      : {}),
    ...(typeof pointer.route === 'string' ? { route: pointer.route } : {}),
    ...(typeof pointer.activityId === 'string'
      ? { activityId: pointer.activityId }
      : {}),
    ...(typeof pointer.lessonId === 'string'
      ? { lessonId: pointer.lessonId }
      : {}),
    ...(typeof pointer.stepId === 'string'
      ? { stepId: pointer.stepId }
      : {}),
    ...(typeof pointer.questionId === 'string'
      ? { questionId: pointer.questionId }
      : {}),
    ...(typeof pointer.itemId === 'string'
      ? { itemId: pointer.itemId }
      : {}),
    ...(data ? { adapterData: data } : {}),
    updatedAt: pointer.updatedAt,
  } as ResumePointer
}

function normalizeVerification(
  value: unknown,
): ParentVerification | undefined {
  const verification = recordOf(value)
  if (!verification || typeof verification.verified !== 'boolean') {
    return undefined
  }
  return {
    ...extensions(verification, [
      'verified',
      'verifiedAt',
      'verifiedBy',
    ]),
    verified: verification.verified,
    ...(typeof verification.verifiedAt === 'string'
      ? { verifiedAt: verification.verifiedAt }
      : {}),
    ...(typeof verification.verifiedBy === 'string'
      ? { verifiedBy: verification.verifiedBy }
      : {}),
  } as ParentVerification
}

function normalizePlacement(value: unknown): PlannerPlacement | undefined {
  const placement = recordOf(value)
  if (!placement || typeof placement.kind !== 'string') return undefined
  if (
    placement.kind === 'scheduled' &&
    typeof placement.startMinute === 'number' &&
    Number.isInteger(placement.startMinute) &&
    placement.startMinute >= 0 &&
    placement.startMinute < 1440 &&
    typeof placement.endMinute === 'number' &&
    Number.isInteger(placement.endMinute) &&
    placement.endMinute > placement.startMinute &&
    typeof placement.startTime === 'string' &&
    placement.startTime === formatDayMinute(placement.startMinute)
  ) {
    const conflict =
      placement.conflict === 'fixed-overlap' ||
      placement.conflict === 'historical-overlap'
        ? placement.conflict
        : undefined
    return {
      ...extensions(placement, [
        'kind',
        'startMinute',
        'endMinute',
        'startTime',
        'crossesMidnight',
        'conflict',
      ]),
      kind: 'scheduled',
      startMinute: placement.startMinute,
      endMinute: placement.endMinute,
      startTime: placement.startTime,
      ...(placement.endMinute > 1440
        ? { crossesMidnight: true }
        : {}),
      ...(conflict ? { conflict } : {}),
    } as PlannerPlacement
  }
  if (
    placement.kind === 'overflow' &&
    typeof placement.order === 'number' &&
    Number.isFinite(placement.order) &&
    typeof placement.earliestStartMinute === 'number' &&
    Number.isFinite(placement.earliestStartMinute) &&
    typeof placement.durationMinutes === 'number' &&
    Number.isFinite(placement.durationMinutes) &&
    placement.durationMinutes > 0 &&
    (placement.reason === 'past-day-boundary' ||
      placement.reason === 'no-available-interval')
  ) {
    return {
      ...extensions(placement, [
        'kind',
        'order',
        'earliestStartMinute',
        'durationMinutes',
        'reason',
      ]),
      kind: 'overflow',
      order: Math.max(1, Math.round(placement.order)),
      earliestStartMinute: Math.max(
        1440,
        Math.round(placement.earliestStartMinute),
      ),
      durationMinutes: Math.max(1, Math.round(placement.durationMinutes)),
      reason: placement.reason,
    } as PlannerPlacement
  }
  if (
    placement.kind === 'unavailable' &&
    (placement.reason === 'invalid-duration' ||
      placement.reason === 'missing-source') &&
    typeof placement.message === 'string'
  ) {
    return {
      ...extensions(placement, ['kind', 'reason', 'message']),
      kind: 'unavailable',
      reason: placement.reason,
      message: placement.message,
    } as PlannerPlacement
  }
  return undefined
}

function normalizeOccurrence(
  value: unknown,
): PlannerOccurrenceSnapshot | undefined {
  const occurrence = recordOf(value)
  if (!occurrence) return undefined
  const source = normalizeSource(occurrence.source)
  const category = source
    ? normalizeCategory(occurrence.category, source)
    : null
  const placement = normalizePlacement(occurrence.placement)
  if (
    !source ||
    !category ||
    !placement ||
    typeof occurrence.blockInstanceId !== 'string' ||
    typeof occurrence.blockId !== 'string' ||
    typeof occurrence.profileId !== 'string' ||
    typeof occurrence.date !== 'string' ||
    !ISO_DATE_RE.test(occurrence.date) ||
    typeof occurrence.title !== 'string' ||
    typeof occurrence.preferredStartTime !== 'string' ||
    !TIME_RE.test(occurrence.preferredStartTime) ||
    typeof occurrence.expectedMinutes !== 'number' ||
    !Number.isFinite(occurrence.expectedMinutes) ||
    occurrence.expectedMinutes <= 0 ||
    (occurrence.scheduleBehavior !== 'flexible' &&
      occurrence.scheduleBehavior !== 'fixed') ||
    typeof occurrence.requiresParentHelp !== 'boolean' ||
    typeof occurrence.capturedAt !== 'string'
  ) {
    return undefined
  }
  const linked = normalizeLinkedActivity(occurrence.linkedActivity)
  const studentInstructions =
    typeof occurrence.studentInstructions === 'string'
      ? occurrence.studentInstructions
      : typeof occurrence.description === 'string'
        ? occurrence.description
        : ''
  const parentNotes =
    typeof occurrence.parentNotes === 'string'
      ? occurrence.parentNotes
      : typeof occurrence.notes === 'string'
        ? occurrence.notes
        : undefined
  const provenance =
    occurrence.provenance === 'captured' ||
    occurrence.provenance === 'legacy-template' ||
    occurrence.provenance === 'normalized-archive'
      ? occurrence.provenance
      : undefined
  const [preferredHour, preferredMinute] = occurrence.preferredStartTime
    .split(':')
    .map(Number)
  const preferredStartMinute = preferredHour * 60 + preferredMinute
  return {
    ...extensions(occurrence, [
      'provenance',
      'blockInstanceId',
      'blockId',
      'profileId',
      'date',
      'title',
      'studentInstructions',
      'parentNotes',
      'description',
      'notes',
      'category',
      'source',
      'preferredStartTime',
      'preferredStartMinute',
      'placement',
      'expectedMinutes',
      'scheduleBehavior',
      'linkedActivity',
      'requiresParentHelp',
      'location',
      'capturedAt',
    ]),
    ...(provenance ? { provenance } : {}),
    blockInstanceId: occurrence.blockInstanceId,
    blockId: occurrence.blockId,
    profileId: occurrence.profileId,
    date: occurrence.date,
    title: occurrence.title,
    studentInstructions,
    ...(parentNotes !== undefined ? { parentNotes } : {}),
    category,
    source,
    preferredStartTime: occurrence.preferredStartTime,
    preferredStartMinute,
    placement,
    expectedMinutes: Math.max(1, Math.round(occurrence.expectedMinutes)),
    scheduleBehavior: occurrence.scheduleBehavior,
    ...(linked ? { linkedActivity: linked } : {}),
    requiresParentHelp: occurrence.requiresParentHelp,
    ...(typeof occurrence.location === 'string'
      ? { location: occurrence.location }
      : {}),
    capturedAt: occurrence.capturedAt,
  } as PlannerOccurrenceSnapshot
}

export function normalizePlannerProgress(
  value: unknown,
  _legacy = false,
): PlannerProgress | null {
  const progress = recordOf(value)
  if (
    !progress ||
    typeof progress.profileId !== 'string' ||
    typeof progress.date !== 'string' ||
    !ISO_DATE_RE.test(progress.date) ||
    typeof progress.blockInstanceId !== 'string' ||
    typeof progress.blockId !== 'string' ||
    typeof progress.status !== 'string' ||
    !STATUSES.has(progress.status) ||
    typeof progress.activeElapsedSeconds !== 'number' ||
    !Number.isFinite(progress.activeElapsedSeconds) ||
    progress.activeElapsedSeconds < 0 ||
    typeof progress.updatedAt !== 'string'
  ) {
    return null
  }
  const normalizedOccurrence = normalizeOccurrence(progress.occurrence)
  const occurrence =
    normalizedOccurrence &&
    normalizedOccurrence.profileId === progress.profileId &&
    normalizedOccurrence.date === progress.date &&
    normalizedOccurrence.blockId === progress.blockId &&
    normalizedOccurrence.blockInstanceId === progress.blockInstanceId
      ? normalizedOccurrence
      : undefined
  const missionOwned =
    progress.completionAuthority === 'mission' ||
    occurrence?.source.kind === 'mission' ||
    progress.blockId.startsWith('mission:')
  const rawStatus = progress.status as PlannerBlockStatus
  const hasUsefulMissionTiming =
    progress.activeElapsedSeconds > 0 ||
    typeof progress.startedAt === 'string' ||
    typeof progress.lastPausedAt === 'string'
  const status =
    missionOwned &&
    (rawStatus === 'completed' ||
      rawStatus === 'excused' ||
      rawStatus === 'moved' ||
      rawStatus === 'skipped')
      ? hasUsefulMissionTiming
        ? 'paused'
        : 'not-started'
      : rawStatus
  const verification = normalizeVerification(progress.parentVerification)
  const pointer = normalizeResumePointer(progress.resumePointer)
  return {
    ...extensions(progress, [
      'profileId',
      'date',
      'blockInstanceId',
      'blockId',
      'status',
      'completionAuthority',
      'startedAt',
      'activeSince',
      'lastPausedAt',
      'completedAt',
      'terminalAt',
      'reopenedAt',
      'activeElapsedSeconds',
      'parentVerification',
      'resumePointer',
      'completionNote',
      'occurrence',
      'updatedAt',
    ]),
    profileId: progress.profileId,
    date: progress.date,
    blockInstanceId: progress.blockInstanceId,
    blockId: progress.blockId,
    status,
    ...(missionOwned
      ? { completionAuthority: 'mission' as const }
      : progress.completionAuthority === 'planner'
        ? { completionAuthority: 'planner' as const }
        : {}),
    ...(typeof progress.startedAt === 'string'
      ? { startedAt: progress.startedAt }
      : {}),
    ...(typeof progress.activeSince === 'string' && status === 'in-progress'
      ? { activeSince: progress.activeSince }
      : {}),
    ...(typeof progress.lastPausedAt === 'string'
      ? { lastPausedAt: progress.lastPausedAt }
      : {}),
    ...(!missionOwned && typeof progress.completedAt === 'string'
      ? { completedAt: progress.completedAt }
      : {}),
    ...(!missionOwned && typeof progress.terminalAt === 'string'
      ? { terminalAt: progress.terminalAt }
      : {}),
    ...(typeof progress.reopenedAt === 'string'
      ? { reopenedAt: progress.reopenedAt }
      : {}),
    activeElapsedSeconds: Math.max(
      0,
      Math.round(progress.activeElapsedSeconds),
    ),
    ...(!missionOwned && verification
      ? { parentVerification: verification }
      : {}),
    ...(pointer ? { resumePointer: pointer } : {}),
    ...(!missionOwned && typeof progress.completionNote === 'string'
      ? { completionNote: progress.completionNote }
      : {}),
    ...(occurrence ? { occurrence } : {}),
    updatedAt: progress.updatedAt,
  } as PlannerProgress
}

function normalizeSupportedPlannerState(
  state: Record<string, unknown>,
  legacy: boolean,
): PlannerState {
  const blocks = Array.isArray(state.blocks)
    ? state.blocks.flatMap((block) => {
        const normalized = normalizePlannerBlock(block)
        return normalized ? [normalized] : []
      })
    : []
  const overrides = Array.isArray(state.overrides)
    ? state.overrides.flatMap((override) => {
        const normalized = normalizeOverride(override)
        return normalized ? [normalized] : []
      })
    : []
  const byId = new Map(blocks.map((block) => [block.id, block]))
  const progress: Record<string, PlannerProgress> = {}
  const rawProgress = recordOf(state.progress)
  if (rawProgress) {
    for (const [key, value] of Object.entries(rawProgress)) {
      const normalized = normalizePlannerProgress(value, legacy)
      if (!normalized) continue
      if (
        key !== normalized.blockInstanceId ||
        normalized.blockInstanceId !==
          plannerBlockInstanceId(
            normalized.profileId,
            normalized.date,
            normalized.blockId,
          )
      ) {
        continue
      }
      let row = normalized
      if (!row.occurrence && progressNeedsHistoricalOccurrence(row)) {
        const rawRow = recordOf(value)
        const rejectedOccurrence =
          rawRow !== null && rawRow.occurrence !== undefined
        const block = byId.get(row.blockId)
        row = {
          ...row,
          occurrence: !rejectedOccurrence && block
            ? snapshotForLegacyProgress(block, row, row.updatedAt)
            : archivedSnapshotForProgress(row, row.updatedAt),
        }
      }
      progress[key] = row
    }
  }
  return {
    ...extensions(state, ['version', 'blocks', 'overrides', 'progress']),
    version: PLANNER_VERSION,
    blocks,
    overrides,
    progress,
  } as PlannerState
}

/**
 * Version-aware planner reader. Future versions are returned as opaque data and
 * must remain read-only; callers may never substitute defaults for that branch.
 */
export function readPlannerState(value: unknown): PlannerStateReadResult {
  if (value === undefined || value === null) {
    return { kind: 'supported', state: defaultPlannerState(), migrated: false }
  }
  const state = recordOf(value)
  if (!state) {
    return { kind: 'supported', state: defaultPlannerState(), migrated: true }
  }
  const version =
    typeof state.version === 'number' && Number.isInteger(state.version)
      ? state.version
      : undefined
  if (version !== undefined && version > PLANNER_VERSION) {
    const raw = safeObject(state)
    if (raw) {
      return {
        kind: 'unsupported-newer',
        version,
        raw: raw as UnsupportedPlannerState,
      }
    }
  }
  const legacy = version === 1 || version === undefined
  return {
    kind: 'supported',
    state: normalizeSupportedPlannerState(state, legacy),
    migrated: legacy || version !== PLANNER_VERSION,
  }
}

/**
 * Compatibility helper retained for pure fixtures. Mutation and hydration paths
 * must use readPlannerState so a future payload is never replaced by defaults.
 */
export function normalizePlannerState(value: unknown): PlannerState {
  const read = readPlannerState(value)
  return read.kind === 'supported' ? read.state : defaultPlannerState()
}

/** Runtime hydration leaves unsupported future planner payloads untouched. */
export function withPlannerDefaults(state: AppState): AppState {
  const read = readPlannerState(state.planner)
  if (read.kind === 'unsupported-newer') return state
  return { ...state, planner: read.state }
}

export interface ManualPlannerBlockInput {
  title: string
  studentInstructions?: string
  parentNotes?: string
  /** Legacy caller alias; normalized into studentInstructions. */
  description?: string
  /** Legacy caller alias; normalized conservatively into parentNotes. */
  notes?: string
  category: PlannerActivityCategory
  assignedProfileIds: string[]
  assignToAll?: boolean
  weekdays: PlannerWeekday[]
  startTime: string
  expectedMinutes: number
  scheduleBehavior: 'flexible' | 'fixed'
  linkedActivity?: LinkedPlannerActivity
  requiresParentHelp?: boolean
  location?: string
}

const safeManualCategory = (
  category: PlannerActivityCategory,
): PlannerActivityCategory =>
  MANUAL_CATEGORIES.has(category) ? category : 'custom'

export function createManualPlannerBlock(
  input: ManualPlannerBlockInput,
  now: string,
  id: string,
): PlannerBlock {
  const category = safeManualCategory(input.category)
  const explicitlyLinkedRomeo =
    category === 'romeo-online' &&
    input.linkedActivity?.adapter === 'romeo-online' &&
    Boolean(input.linkedActivity.activityId.trim())
  const source: PlannerActivitySource =
    explicitlyLinkedRomeo
      ? {
          kind: 'romeo-online',
          activityId: input.linkedActivity!.activityId,
        }
      : { kind: 'manual' }
  const studentInstructions =
    input.studentInstructions ?? input.description ?? ''
  const parentNotes = input.parentNotes ?? input.notes
  return {
    id,
    title: input.title.trim(),
    studentInstructions: studentInstructions.trim(),
    ...(parentNotes?.trim() ? { parentNotes: parentNotes.trim() } : {}),
    category,
    source,
    assignedProfileIds: [...new Set(input.assignedProfileIds)],
    assignToAll: input.assignToAll === true,
    weekdays: [...new Set(input.weekdays)].sort((a, b) => a - b),
    startTime: input.startTime,
    expectedMinutes: Math.max(1, Math.round(input.expectedMinutes)),
    scheduleBehavior: input.scheduleBehavior,
    ...(input.linkedActivity ? { linkedActivity: input.linkedActivity } : {}),
    requiresParentHelp: input.requiresParentHelp === true,
    ...(input.location?.trim() ? { location: input.location.trim() } : {}),
    active: true,
    createdAt: now,
    updatedAt: now,
  }
}

function snapshotMeaningfulProgress(
  planner: PlannerState,
  block: PlannerBlock,
  capturedAt: string,
): PlannerState {
  let changed = false
  const progress = { ...planner.progress }
  for (const [key, row] of Object.entries(progress)) {
    if (
      row.blockId !== block.id ||
      row.occurrence ||
      !progressNeedsHistoricalOccurrence(row)
    ) {
      continue
    }
    progress[key] = {
      ...row,
      occurrence: snapshotForLegacyProgress(block, row, capturedAt),
    }
    changed = true
  }
  return changed ? { ...planner, progress } : planner
}

/**
 * Apply submitted manual fields to the latest stored template. Removed/unknown
 * IDs and generated system rows are safe no-ops.
 */
export function updateManualPlannerBlock(
  planner: PlannerState,
  blockId: string,
  input: ManualPlannerBlockInput,
  now: string,
): PlannerState {
  const current = planner.blocks.find((block) => block.id === blockId)
  if (
    !current ||
    (current.source.kind !== 'manual' &&
      current.source.kind !== 'romeo-online')
  ) {
    return planner
  }
  const withHistory = snapshotMeaningfulProgress(planner, current, now)
  const submitted = createManualPlannerBlock(input, now, current.id)
  const category =
    current.source.kind === 'romeo-online'
      ? 'romeo-online'
      : submitted.category
  const currentWithoutClearedFields = { ...current }
  delete currentWithoutClearedFields.parentNotes
  delete currentWithoutClearedFields.location
  const updated: PlannerBlock = {
    ...currentWithoutClearedFields,
    ...submitted,
    category,
    id: current.id,
    source: current.source,
    createdAt: current.createdAt,
    active: current.active,
    updatedAt: now,
  }
  return {
    ...withHistory,
    blocks: withHistory.blocks.map((block) =>
      block.id === current.id ? updated : block,
    ),
  }
}

export function addManualPlannerBlock(
  planner: PlannerState,
  input: ManualPlannerBlockInput,
  now: string,
  id: string,
): PlannerState {
  if (planner.blocks.some((block) => block.id === id)) return planner
  return {
    ...planner,
    blocks: [...planner.blocks, createManualPlannerBlock(input, now, id)],
  }
}

export function togglePlannerBlockActive(
  planner: PlannerState,
  blockId: string,
  now: string,
): PlannerState {
  const current = planner.blocks.find((block) => block.id === blockId)
  if (
    !current ||
    (current.source.kind !== 'manual' &&
      current.source.kind !== 'romeo-online')
  ) {
    return planner
  }
  const withHistory = snapshotMeaningfulProgress(planner, current, now)
  return {
    ...withHistory,
    blocks: withHistory.blocks.map((block) =>
      block.id === blockId
        ? { ...block, active: !block.active, updatedAt: now }
        : block,
    ),
  }
}

/** Removing a template leaves snapshot-backed execution history intact. */
export function removePlannerBlock(
  planner: PlannerState,
  blockId: string,
  now = new Date().toISOString(),
): PlannerState {
  const current = planner.blocks.find((block) => block.id === blockId)
  if (
    !current ||
    (current.source.kind !== 'manual' &&
      current.source.kind !== 'romeo-online')
  ) {
    return planner
  }
  const withHistory = snapshotMeaningfulProgress(planner, current, now)
  return {
    ...withHistory,
    blocks: withHistory.blocks.filter((block) => block.id !== blockId),
  }
}

/**
 * Legacy helper retained while callers move to identifier-based commands.
 * Existing IDs are updated from the latest row rather than blindly replaced.
 */
export function replacePlannerBlock(
  planner: PlannerState,
  block: PlannerBlock,
): PlannerState {
  const current = planner.blocks.find((item) => item.id === block.id)
  if (!current) return { ...planner, blocks: [...planner.blocks, block] }
  if (
    current.source.kind !== 'manual' &&
    current.source.kind !== 'romeo-online'
  ) {
    return planner
  }
  return {
    ...planner,
    blocks: planner.blocks.map((item) =>
      item.id === current.id
        ? {
            ...current,
            ...block,
            id: current.id,
            source: current.source,
            createdAt: current.createdAt,
            active: current.active,
          }
        : item,
    ),
  }
}

interface SanitizedManualBlockPatch {
  changes: PlannerBlockChanges
  clearParentNotes: boolean
  clearLocation: boolean
}

const owns = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key)

/**
 * Patch commands may come from a stale editor or, eventually, another device.
 * Accept only contract fields with valid values so a narrow delta cannot replace
 * unrelated fields from the latest stored template.
 */
function sanitizeManualBlockPatch(
  submitted: PlannerBlockChanges,
): SanitizedManualBlockPatch {
  const changes: PlannerBlockChanges = {}
  if (typeof submitted.title === 'string' && submitted.title.trim()) {
    changes.title = submitted.title.trim()
  }
  if (typeof submitted.studentInstructions === 'string') {
    changes.studentInstructions = submitted.studentInstructions.trim()
  }
  const clearParentNotes =
    owns(submitted, 'parentNotes') &&
    typeof submitted.parentNotes === 'string' &&
    submitted.parentNotes.trim() === ''
  if (
    typeof submitted.parentNotes === 'string' &&
    submitted.parentNotes.trim()
  ) {
    changes.parentNotes = submitted.parentNotes.trim()
  }
  if (
    typeof submitted.category === 'string' &&
    CATEGORIES.has(submitted.category)
  ) {
    changes.category = safeManualCategory(submitted.category)
  }
  if (Array.isArray(submitted.assignedProfileIds)) {
    changes.assignedProfileIds = [
      ...new Set(strings(submitted.assignedProfileIds)),
    ]
  }
  if (typeof submitted.assignToAll === 'boolean') {
    changes.assignToAll = submitted.assignToAll
  }
  const days = weekdays(submitted.weekdays)
  if (days.length > 0) {
    changes.weekdays = days.sort((left, right) => left - right)
  }
  if (
    typeof submitted.startTime === 'string' &&
    TIME_RE.test(submitted.startTime)
  ) {
    changes.startTime = submitted.startTime
  }
  if (
    typeof submitted.expectedMinutes === 'number' &&
    Number.isFinite(submitted.expectedMinutes) &&
    submitted.expectedMinutes > 0
  ) {
    changes.expectedMinutes = Math.max(
      1,
      Math.round(submitted.expectedMinutes),
    )
  }
  if (
    submitted.scheduleBehavior === 'fixed' ||
    submitted.scheduleBehavior === 'flexible'
  ) {
    changes.scheduleBehavior = submitted.scheduleBehavior
  }
  const linked = normalizeLinkedActivity(submitted.linkedActivity)
  if (linked) changes.linkedActivity = linked
  if (typeof submitted.requiresParentHelp === 'boolean') {
    changes.requiresParentHelp = submitted.requiresParentHelp
  }
  const clearLocation =
    owns(submitted, 'location') &&
    typeof submitted.location === 'string' &&
    submitted.location.trim() === ''
  if (typeof submitted.location === 'string' && submitted.location.trim()) {
    changes.location = submitted.location.trim()
  }
  if (typeof submitted.active === 'boolean') {
    changes.active = submitted.active
  }
  return { changes, clearParentNotes, clearLocation }
}

function patchCurrentManualBlock(
  block: PlannerBlock,
  patch: SanitizedManualBlockPatch,
  category: PlannerActivityCategory,
  now: string,
): PlannerBlock {
  const latest = { ...block }
  if (patch.clearParentNotes) delete latest.parentNotes
  if (patch.clearLocation) delete latest.location
  const updated: PlannerBlock = {
    ...latest,
    ...patch.changes,
    category,
    id: block.id,
    source: block.source,
    createdAt: block.createdAt,
    updatedAt: now,
  }
  if (!updated.assignToAll && updated.assignedProfileIds.length === 0) {
    updated.assignToAll = block.assignToAll
    updated.assignedProfileIds = [...block.assignedProfileIds]
  }
  return updated
}

export function patchPlannerBlock(
  planner: PlannerState,
  blockId: string,
  changes: PlannerBlockChanges,
  now: string,
): PlannerState {
  const current = planner.blocks.find((block) => block.id === blockId)
  if (
    !current ||
    (current.source.kind !== 'manual' &&
      current.source.kind !== 'romeo-online')
  ) {
    return planner
  }
  const withHistory = snapshotMeaningfulProgress(planner, current, now)
  const sanitized = sanitizeManualBlockPatch(changes)
  const category =
    current.source.kind === 'romeo-online'
      ? 'romeo-online'
      : sanitized.changes.category === undefined
      ? current.category
      : safeManualCategory(sanitized.changes.category)
  return {
    ...withHistory,
    blocks: withHistory.blocks.map((block) =>
      block.id === blockId
        ? patchCurrentManualBlock(block, sanitized, category, now)
        : block,
    ),
  }
}

/** Type-level documentation that AppState stores either current or opaque data. */
export const plannerPayload = (
  planner: PlannerPersistedState,
): PlannerPersistedState => planner
