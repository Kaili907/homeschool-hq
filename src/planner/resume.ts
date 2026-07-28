import type { CourseTrack, ISODate, Profile } from '../types'
import { defaultCoursesFor } from '../hs/hsCatalog'
import type {
  DailyPlanBlock,
  LinkedPlannerActivity,
  PlannerDestination,
  PlannerNavigationResolution,
  ResumePointer,
} from './types'

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
    adapter: linked.adapter,
    blockId: block.block.id,
    ...(linked.route ? { route: linked.route } : {}),
    activityId: linked.activityId,
    ...(linked.lessonId ? { lessonId: linked.lessonId } : {}),
    ...(linked.stepId ? { stepId: linked.stepId } : {}),
    ...(linked.itemId ? { itemId: linked.itemId } : {}),
    ...(linked.safeEntryData ? { adapterData: linked.safeEntryData } : {}),
    updatedAt: now,
  }
}

const normalizeIdentifier = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '')

const coursesForNavigation = (profile: Profile): CourseTrack[] =>
  profile.courses ??
  (profile.grade === '10' || profile.grade === '12'
    ? defaultCoursesFor(profile.grade)
    : [])

const SUBJECT_COURSE_ALIASES: Record<string, readonly string[]> = {
  math: ['math', 'geometry', 'algebra'],
  english: ['english', 'languagearts'],
  'personal-finance': ['personalfinance', 'finance'],
  'ai-literacy': ['ailiteracy', 'artificialintelligence'],
  mindset: ['mindset', 'competitorsmind', 'competitormind'],
}

/**
 * Resolve a curriculum subject only to a course that really belongs to this
 * profile. A missing match falls back to curriculum instructions; it never
 * guesses a sibling's configured course.
 */
export function highSchoolCourseIdForSubject(
  profile: Profile,
  subjectId: string,
  subjectLabel = '',
): string | undefined {
  if (profile.grade !== '10' && profile.grade !== '12') return undefined
  const courses = coursesForNavigation(profile)
  const normalizedId = normalizeIdentifier(subjectId)
  const normalizedLabel = normalizeIdentifier(subjectLabel)
  const exact = courses.find(
    (course) =>
      normalizeIdentifier(course.id) === normalizedId ||
      (normalizedLabel.length > 0 &&
        normalizeIdentifier(course.name) === normalizedLabel),
  )
  if (exact) return exact.id

  const aliases = SUBJECT_COURSE_ALIASES[subjectId] ?? [
    normalizedId,
    normalizedLabel,
  ]
  const match = courses.find((course) => {
    const candidate = `${normalizeIdentifier(course.id)}${normalizeIdentifier(course.name)}`
    return aliases.some((alias) => alias.length > 0 && candidate.includes(alias))
  })
  return match?.id
}

const unavailable = (
  code: Extract<PlannerDestination, { kind: 'unavailable' }>['code'],
  message: string,
  source: PlannerNavigationResolution['source'] = 'safe-fallback',
): PlannerNavigationResolution => ({
  destination: { kind: 'unavailable', code, message },
  source,
  granularity: 'none',
})

const available = (
  destination: Exclude<PlannerDestination, { kind: 'unavailable' }>,
  source: PlannerNavigationResolution['source'],
  granularity: PlannerNavigationResolution['granularity'],
): PlannerNavigationResolution => ({ destination, source, granularity })

function destinationForActivity(
  activityId: string,
  profile: Profile,
  block: DailyPlanBlock,
  source: PlannerNavigationResolution['source'],
): PlannerNavigationResolution | undefined {
  if (
    activityId === 'math' &&
    block.block.source.kind === 'curriculum' &&
    ['3', '4', '6'].includes(profile.grade)
  ) {
    return available({ kind: 'math-practice' }, source, 'activity')
  }
  if (activityId === 'math-practice') {
    return ['3', '4', '6'].includes(profile.grade)
      ? available({ kind: 'math-practice' }, source, 'activity')
      : undefined
  }
  if (activityId === 'typing') {
    return ['3', '4', '6'].includes(profile.grade)
      ? available({ kind: 'typing' }, source, 'activity')
      : undefined
  }
  if (activityId === 'reading') {
    return ['3', '4', '6'].includes(profile.grade)
      ? available({ kind: 'reading' }, source, 'activity')
      : undefined
  }
  if (activityId === 'mindset') {
    return available({ kind: 'mindset' }, source, 'activity')
  }

  const blockSource = block.block.source
  if (blockSource.kind !== 'curriculum') return undefined
  if (activityId !== blockSource.subjectId) return undefined

  const courseId = highSchoolCourseIdForSubject(
    profile,
    blockSource.subjectId,
    blockSource.subjectLabel,
  )
  if (courseId) {
    return available(
      { kind: 'high-school-course', courseId },
      source,
      'course',
    )
  }
  if (blockSource.items.length > 0) {
    return available(
      { kind: 'curriculum-instructions', instanceId: block.instanceId },
      source,
      'instructions',
    )
  }
  return undefined
}

function destinationForRoute(
  route: string,
  profile: Profile,
  block: DailyPlanBlock,
  source: PlannerNavigationResolution['source'],
): PlannerNavigationResolution | undefined {
  const normalized = route.replace(/^\/+/, '')
  const blockSource = block.block.source
  const linkedActivityId = block.block.linkedActivity?.activityId
  const compatibleDirectRoute =
    blockSource.kind !== 'curriculum'
      ? !linkedActivityId || linkedActivityId === normalized
      : (blockSource.subjectId === 'math' && normalized === 'math-practice') ||
        (blockSource.subjectId === 'reading' && normalized === 'reading') ||
        (blockSource.subjectId === 'typing' && normalized === 'typing') ||
        (blockSource.subjectId === 'mindset' && normalized === 'mindset')
  const direct = destinationForActivity(normalized, profile, block, source)
  if (direct && compatibleDirectRoute) return direct

  if (normalized.startsWith('course:')) {
    const courseId = normalized.slice('course:'.length)
    const sourceBlock = blockSource
    if (
      sourceBlock.kind === 'curriculum' &&
      coursesForNavigation(profile).some((course) => course.id === courseId) &&
      highSchoolCourseIdForSubject(
        profile,
        sourceBlock.subjectId,
        sourceBlock.subjectLabel,
      ) === courseId
    ) {
      return available(
        { kind: 'high-school-course', courseId },
        source,
        'course',
      )
    }
  }
  if (
    normalized === 'curriculum-instructions' &&
    block.block.source.kind === 'curriculum' &&
    block.block.source.items.length > 0
  ) {
    return available(
      { kind: 'curriculum-instructions', instanceId: block.instanceId },
      source,
      'instructions',
    )
  }
  return undefined
}

function pointerMatchesBlock(
  pointer: ResumePointer,
  block: DailyPlanBlock,
  profile: Profile,
): boolean {
  if (block.profileId !== profile.id) return false
  if (pointer.blockId && pointer.blockId !== block.block.id) return false
  const linked = block.block.linkedActivity
  const source = block.block.source
  const expectedAdapter =
    linked?.adapter ??
    (source.kind === 'mission'
      ? 'mission'
      : source.kind === 'curriculum'
        ? 'curriculum'
        : source.kind === 'romeo-online'
          ? 'romeo-online'
          : undefined)
  if (
    pointer.adapter &&
    (!expectedAdapter || pointer.adapter !== expectedAdapter)
  ) {
    return false
  }
  const expectedActivity =
    linked?.activityId ??
    (source.kind === 'curriculum'
      ? source.subjectId
      : source.kind === 'romeo-online'
        ? source.activityId
        : undefined)
  if ((pointer.route || pointer.activityId) && !expectedActivity) return false
  if (
    pointer.activityId &&
    expectedActivity &&
    pointer.activityId !== expectedActivity
  ) {
    return false
  }
  const pointerProfileId = pointer.adapterData?.profileId
  if (
    typeof pointerProfileId === 'string' &&
    pointerProfileId !== profile.id
  ) {
    return false
  }
  if (block.block.source.kind === 'curriculum') {
    const pointerSubject = pointer.adapterData?.subjectId
    if (
      typeof pointerSubject === 'string' &&
      pointerSubject !== block.block.source.subjectId
    ) {
      return false
    }
  }
  return true
}

function resolvePointer(
  pointer: ResumePointer,
  block: DailyPlanBlock,
  profile: Profile,
): PlannerNavigationResolution | undefined {
  if (!pointerMatchesBlock(pointer, block, profile)) return undefined
  if (pointer.route) {
    const routed = destinationForRoute(
      pointer.route,
      profile,
      block,
      'resume-pointer',
    )
    if (routed) return routed
  }
  if (pointer.activityId) {
    return destinationForActivity(
      pointer.activityId,
      profile,
      block,
      'resume-pointer',
    )
  }
  return undefined
}

function resolveLinked(
  linked: LinkedPlannerActivity,
  block: DailyPlanBlock,
  profile: Profile,
): PlannerNavigationResolution | undefined {
  if (linked.route) {
    const routed = destinationForRoute(
      linked.route,
      profile,
      block,
      'linked-activity',
    )
    if (routed) return routed
  }
  return destinationForActivity(
    linked.activityId,
    profile,
    block,
    'linked-activity',
  )
}

/**
 * Resolve navigation without trusting persisted route strings. Stored pointers
 * have priority only when they are bound to this profile, block, adapter, and
 * source; invalid pointers fall through to the safest supported entry point.
 */
export function resolvePlannerNavigation(
  block: DailyPlanBlock,
  activeProfile: Profile,
): PlannerNavigationResolution {
  if (block.profileId !== activeProfile.id) {
    return unavailable(
      'profile-mismatch',
      'This activity belongs to a different student.',
    )
  }
  if (block.unavailableReason || block.placement.kind === 'unavailable') {
    return unavailable(
      'missing-source',
      block.unavailableReason ??
        (block.placement.kind === 'unavailable'
          ? block.placement.message
          : 'This activity is unavailable.'),
    )
  }

  const pointer = block.progress.resumePointer
  if (pointer) {
    const resumed = resolvePointer(pointer, block, activeProfile)
    if (resumed) return resumed
  }

  const linked = block.block.linkedActivity
  if (linked) {
    const linkedResult = resolveLinked(linked, block, activeProfile)
    if (linkedResult) return linkedResult
  }

  const source = block.block.source
  if (source.kind === 'curriculum') {
    const fallback = destinationForActivity(
      source.subjectId,
      activeProfile,
      block,
      'safe-fallback',
    )
    return (
      fallback ??
      unavailable(
        'no-safe-entry',
        'This curriculum activity has no dependable place to open yet.',
      )
    )
  }

  // Manual, Romeo Online, and manually eligible mission tasks may be completed
  // with offline instructions. Starting them deliberately remains in My Day.
  if (
    source.kind === 'manual' ||
    source.kind === 'romeo-online' ||
    (source.kind === 'mission' && !source.autoOnly)
  ) {
    return available({ kind: 'manual-activity' }, 'safe-fallback', 'activity')
  }

  return unavailable(
    'no-safe-entry',
    'The linked activity does not expose a dependable entry point.',
  )
}
