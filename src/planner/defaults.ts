import type { AppState } from '../types'
import type {
  LinkedPlannerActivity,
  ParentVerification,
  PlannerActivityCategory,
  PlannerActivitySource,
  PlannerBlock,
  PlannerBlockChanges,
  PlannerBlockStatus,
  PlannerDateOverride,
  PlannerJsonValue,
  PlannerProgress,
  PlannerState,
  PlannerWeekday,
  ResumePointer,
} from './types'

export const PLANNER_VERSION = 1 as const

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

const CATEGORIES = new Set(Object.keys(ACTIVITY_CATEGORY_LABELS))
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
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

const weekdays = (value: unknown): PlannerWeekday[] => {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((day): day is PlannerWeekday => Number.isInteger(day) && day >= 1 && day <= 7))]
}

function jsonValue(value: unknown, depth = 0): PlannerJsonValue | undefined {
  if (depth > 12) return undefined
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
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
  const safe: Record<string, PlannerJsonValue> = {}
  for (const [key, item] of Object.entries(record)) {
    const normalized = jsonValue(item, depth + 1)
    if (normalized === undefined) return undefined
    safe[key] = normalized
  }
  return safe
}

function normalizeSource(value: unknown): PlannerActivitySource | null {
  const source = recordOf(value)
  if (!source || typeof source.kind !== 'string' || !SOURCE_KINDS.has(source.kind)) return null
  if (source.kind === 'manual') return { kind: 'manual' }
  if (source.kind === 'romeo-online') {
    return {
      kind: 'romeo-online',
      ...(typeof source.activityId === 'string' ? { activityId: source.activityId } : {}),
    }
  }
  if (source.kind === 'mission') {
    if (typeof source.missionItemId !== 'string' || typeof source.autoOnly !== 'boolean') return null
    return {
      kind: 'mission',
      missionItemId: source.missionItemId,
      autoOnly: source.autoOnly,
      ...(typeof source.autoKind === 'string' && AUTO_KINDS.has(source.autoKind)
        ? { autoKind: source.autoKind as 'math' | 'typing' | 'reading' | 'mindset' }
        : {}),
    }
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
      ? [{ id: row.id, text: row.text, dadTaught: row.dadTaught }]
      : []
  })
  return {
    kind: 'curriculum',
    subjectId: source.subjectId,
    subjectLabel: source.subjectLabel,
    week: source.week as number,
    items,
  }
}

function normalizeLinkedActivity(value: unknown): LinkedPlannerActivity | undefined {
  const linked = recordOf(value)
  if (
    !linked ||
    typeof linked.adapter !== 'string' ||
    !ADAPTERS.has(linked.adapter) ||
    typeof linked.activityId !== 'string'
  ) {
    return undefined
  }
  const safeData = jsonValue(linked.safeEntryData)
  return {
    adapter: linked.adapter as LinkedPlannerActivity['adapter'],
    activityId: linked.activityId,
    ...(typeof linked.route === 'string' ? { route: linked.route } : {}),
    ...(typeof linked.lessonId === 'string' ? { lessonId: linked.lessonId } : {}),
    ...(typeof linked.stepId === 'string' ? { stepId: linked.stepId } : {}),
    ...(typeof linked.itemId === 'string' ? { itemId: linked.itemId } : {}),
    ...(safeData && !Array.isArray(safeData) && typeof safeData === 'object'
      ? { safeEntryData: safeData }
      : {}),
  }
}

export function normalizePlannerBlock(value: unknown): PlannerBlock | null {
  const block = recordOf(value)
  const source = block ? normalizeSource(block.source) : null
  if (
    !block ||
    !source ||
    typeof block.id !== 'string' ||
    !block.id ||
    typeof block.title !== 'string' ||
    typeof block.description !== 'string' ||
    typeof block.category !== 'string' ||
    !CATEGORIES.has(block.category) ||
    typeof block.startTime !== 'string' ||
    !TIME_RE.test(block.startTime) ||
    typeof block.expectedMinutes !== 'number' ||
    !Number.isFinite(block.expectedMinutes) ||
    block.expectedMinutes <= 0 ||
    (block.scheduleBehavior !== 'flexible' && block.scheduleBehavior !== 'fixed') ||
    typeof block.requiresParentHelp !== 'boolean' ||
    typeof block.active !== 'boolean' ||
    typeof block.createdAt !== 'string' ||
    typeof block.updatedAt !== 'string'
  ) {
    return null
  }
  const days = weekdays(block.weekdays)
  if (days.length === 0) return null
  return {
    id: block.id,
    title: block.title,
    description: block.description,
    category: block.category as PlannerActivityCategory,
    source,
    assignedProfileIds: [...new Set(strings(block.assignedProfileIds))],
    assignToAll: block.assignToAll === true,
    weekdays: days,
    startTime: block.startTime,
    expectedMinutes: Math.max(1, Math.round(block.expectedMinutes)),
    scheduleBehavior: block.scheduleBehavior,
    ...(normalizeLinkedActivity(block.linkedActivity)
      ? { linkedActivity: normalizeLinkedActivity(block.linkedActivity) }
      : {}),
    requiresParentHelp: block.requiresParentHelp,
    ...(typeof block.location === 'string' ? { location: block.location } : {}),
    ...(typeof block.notes === 'string' ? { notes: block.notes } : {}),
    active: block.active,
    createdAt: block.createdAt,
    updatedAt: block.updatedAt,
  }
}

function normalizeChanges(value: unknown): PlannerBlockChanges | undefined {
  const changes = recordOf(value)
  if (!changes) return undefined
  const normalized: PlannerBlockChanges = {}
  if (typeof changes.title === 'string') normalized.title = changes.title
  if (typeof changes.description === 'string') normalized.description = changes.description
  if (typeof changes.category === 'string' && CATEGORIES.has(changes.category)) {
    normalized.category = changes.category as PlannerActivityCategory
  }
  if (Array.isArray(changes.assignedProfileIds)) {
    normalized.assignedProfileIds = [...new Set(strings(changes.assignedProfileIds))]
  }
  if (typeof changes.assignToAll === 'boolean') normalized.assignToAll = changes.assignToAll
  if (weekdays(changes.weekdays).length > 0) normalized.weekdays = weekdays(changes.weekdays)
  if (typeof changes.startTime === 'string' && TIME_RE.test(changes.startTime)) {
    normalized.startTime = changes.startTime
  }
  if (
    typeof changes.expectedMinutes === 'number' &&
    Number.isFinite(changes.expectedMinutes) &&
    changes.expectedMinutes > 0
  ) {
    normalized.expectedMinutes = Math.round(changes.expectedMinutes)
  }
  if (changes.scheduleBehavior === 'flexible' || changes.scheduleBehavior === 'fixed') {
    normalized.scheduleBehavior = changes.scheduleBehavior
  }
  const linked = normalizeLinkedActivity(changes.linkedActivity)
  if (linked) normalized.linkedActivity = linked
  if (typeof changes.requiresParentHelp === 'boolean') {
    normalized.requiresParentHelp = changes.requiresParentHelp
  }
  if (typeof changes.location === 'string') normalized.location = changes.location
  if (typeof changes.notes === 'string') normalized.notes = changes.notes
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
    (override.action !== 'add' && override.action !== 'remove' && override.action !== 'change') ||
    typeof override.createdAt !== 'string' ||
    typeof override.updatedAt !== 'string'
  ) {
    return null
  }
  const block = normalizePlannerBlock(override.block)
  if (override.action === 'add' && !block) return null
  if (override.action !== 'add' && typeof override.targetBlockId !== 'string') return null
  return {
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
    ...(normalizeChanges(override.changes) ? { changes: normalizeChanges(override.changes) } : {}),
    createdAt: override.createdAt,
    updatedAt: override.updatedAt,
  }
}

function normalizeResumePointer(value: unknown): ResumePointer | undefined {
  const pointer = recordOf(value)
  if (!pointer || typeof pointer.updatedAt !== 'string') return undefined
  const data = jsonValue(pointer.adapterData)
  return {
    ...(typeof pointer.route === 'string' ? { route: pointer.route } : {}),
    ...(typeof pointer.activityId === 'string' ? { activityId: pointer.activityId } : {}),
    ...(typeof pointer.lessonId === 'string' ? { lessonId: pointer.lessonId } : {}),
    ...(typeof pointer.stepId === 'string' ? { stepId: pointer.stepId } : {}),
    ...(typeof pointer.questionId === 'string' ? { questionId: pointer.questionId } : {}),
    ...(typeof pointer.itemId === 'string' ? { itemId: pointer.itemId } : {}),
    ...(data && !Array.isArray(data) && typeof data === 'object' ? { adapterData: data } : {}),
    updatedAt: pointer.updatedAt,
  }
}

function normalizeVerification(value: unknown): ParentVerification | undefined {
  const verification = recordOf(value)
  if (!verification || typeof verification.verified !== 'boolean') return undefined
  return {
    verified: verification.verified,
    ...(typeof verification.verifiedAt === 'string'
      ? { verifiedAt: verification.verifiedAt }
      : {}),
    ...(typeof verification.verifiedBy === 'string'
      ? { verifiedBy: verification.verifiedBy }
      : {}),
  }
}

export function normalizePlannerProgress(value: unknown): PlannerProgress | null {
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
  return {
    profileId: progress.profileId,
    date: progress.date,
    blockInstanceId: progress.blockInstanceId,
    blockId: progress.blockId,
    status: progress.status as PlannerBlockStatus,
    ...(typeof progress.startedAt === 'string' ? { startedAt: progress.startedAt } : {}),
    ...(typeof progress.activeSince === 'string' && progress.status === 'in-progress'
      ? { activeSince: progress.activeSince }
      : {}),
    ...(typeof progress.lastPausedAt === 'string'
      ? { lastPausedAt: progress.lastPausedAt }
      : {}),
    ...(typeof progress.completedAt === 'string' ? { completedAt: progress.completedAt } : {}),
    activeElapsedSeconds: Math.max(0, Math.round(progress.activeElapsedSeconds)),
    ...(normalizeVerification(progress.parentVerification)
      ? { parentVerification: normalizeVerification(progress.parentVerification) }
      : {}),
    ...(normalizeResumePointer(progress.resumePointer)
      ? { resumePointer: normalizeResumePointer(progress.resumePointer) }
      : {}),
    ...(typeof progress.completionNote === 'string'
      ? { completionNote: progress.completionNote }
      : {}),
    updatedAt: progress.updatedAt,
  }
}

export function normalizePlannerState(value: unknown): PlannerState {
  const state = recordOf(value)
  if (!state) return defaultPlannerState()
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
  const progress: Record<string, PlannerProgress> = {}
  const rawProgress = recordOf(state.progress)
  if (rawProgress) {
    for (const [key, value] of Object.entries(rawProgress)) {
      const normalized = normalizePlannerProgress(value)
      if (normalized) progress[key] = normalized
    }
  }
  return { version: PLANNER_VERSION, blocks, overrides, progress }
}

/** Runtime hydration keeps AppState schema 2 while materializing planner defaults. */
export function withPlannerDefaults(state: AppState): AppState {
  return { ...state, planner: normalizePlannerState(state.planner) }
}

export interface ManualPlannerBlockInput {
  title: string
  description?: string
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
  notes?: string
}

export function createManualPlannerBlock(
  input: ManualPlannerBlockInput,
  now: string,
  id: string,
): PlannerBlock {
  const source: PlannerActivitySource =
    input.category === 'romeo-online'
      ? { kind: 'romeo-online', activityId: input.linkedActivity?.activityId }
      : { kind: 'manual' }
  return {
    id,
    title: input.title.trim(),
    description: input.description?.trim() ?? '',
    category: input.category,
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
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    active: true,
    createdAt: now,
    updatedAt: now,
  }
}

export function replacePlannerBlock(
  planner: PlannerState,
  block: PlannerBlock,
): PlannerState {
  const exists = planner.blocks.some((item) => item.id === block.id)
  return {
    ...planner,
    blocks: exists
      ? planner.blocks.map((item) => (item.id === block.id ? block : item))
      : [...planner.blocks, block],
  }
}

export function patchPlannerBlock(
  planner: PlannerState,
  blockId: string,
  changes: PlannerBlockChanges,
  now: string,
): PlannerState {
  return {
    ...planner,
    blocks: planner.blocks.map((block) =>
      block.id === blockId && block.source.kind !== 'mission' && block.source.kind !== 'curriculum'
        ? { ...block, ...changes, id: block.id, source: block.source, createdAt: block.createdAt, updatedAt: now }
        : block,
    ),
  }
}

/** Removing a template deliberately leaves per-date progress history intact. */
export function removePlannerBlock(planner: PlannerState, blockId: string): PlannerState {
  return { ...planner, blocks: planner.blocks.filter((block) => block.id !== blockId) }
}
