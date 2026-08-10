import { adaptHostLessonToStudyPlan } from './curriculumAdapter'
import type { StudyCalendarDraft, StudyCalendarEntry, StudyLearnerScope, StudyLessonPlan } from './types'
import type { StudyCalendarPort } from './ports'

export function placementForInstant(instant: Date, householdTimeZone: string): {
  readonly scheduledLocalStart: string
  readonly scheduledStart: string
  readonly intendedLocalDate: string
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: householdTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)
  const part = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((candidate) => candidate.type === type)?.value
    if (!value) throw new Error(`Unable to resolve ${type} in household time zone.`)
    return value
  }
  const intendedLocalDate = `${part('year')}-${part('month')}-${part('day')}`
  return {
    scheduledLocalStart: `${intendedLocalDate}T${part('hour')}:${part('minute')}`,
    scheduledStart: instant.toISOString(),
    intendedLocalDate,
  }
}

export function calendarDraftForPlan(input: {
  readonly scope: StudyLearnerScope
  readonly plan: StudyLessonPlan
  readonly householdTimeZone: string
  readonly instant: Date
  readonly timerHidden: boolean
}): StudyCalendarDraft {
  const placement = placementForInstant(input.instant, input.householdTimeZone)
  const suffix = input.plan.lessonRef.replace(/[^A-Za-z0-9._:-]/g, '-').slice(-80)
  const learnerSuffix = input.scope.learnerRef.replace(/[^A-Za-z0-9._:-]/g, '-').slice(-32)
  const mapping = input.plan.source === 'parent'
    ? 'parent_created_activity'
    : input.plan.source === 'romeo-virtual-academy'
      ? 'romeo_virtual_academy_activity'
      : input.plan.subject === 'reading'
        ? 'reading'
        : input.plan.subject === 'writing'
          ? 'writing'
          : 'new_instruction'
  return {
    blockRef: `block:${learnerSuffix}:${placement.intendedLocalDate}:${suffix}`,
    externalItemRef: `host:${placement.intendedLocalDate}:${suffix}`,
    plan: input.plan,
    blockKind: mapping,
    ...placement,
    householdTimeZone: input.householdTimeZone,
    timerVisibility: input.timerHidden ? 'hidden' : 'shown',
  }
}

/** Seeds only the selected learner's in-memory local preview. It never writes AppState or Supabase. */
export async function ensureLocalDevelopmentStudyDay(input: {
  readonly scope: StudyLearnerScope
  readonly grade: number
  readonly householdTimeZone: string
  readonly calendar: Pick<StudyCalendarPort, 'list' | 'create'>
  readonly timerHidden: boolean
  readonly now?: Date
}): Promise<readonly StudyCalendarEntry[]> {
  const existing = await input.calendar.list(input.scope)
  const now = input.now ?? new Date()
  const today = placementForInstant(now, input.householdTimeZone).intendedLocalDate
  if (existing.some((entry) => entry.intendedLocalDate === today)) return existing
  const gradeRef = `grade-${input.grade}`
  const plans = [
    adaptHostLessonToStudyPlan({
      lessonRef: `${gradeRef}:daily-math:${today}`,
      title: `Grade ${input.grade} math study block`,
      kind: 'math',
      skillRefs: [`${gradeRef}:math:current`],
    }),
    adaptHostLessonToStudyPlan({
      lessonRef: `${gradeRef}:daily-reading:${today}`,
      title: `Grade ${input.grade} reading study block`,
      kind: 'reading',
      skillRefs: [`${gradeRef}:reading:current`],
    }),
  ]
  const created: StudyCalendarEntry[] = []
  for (const [index, plan] of plans.entries()) {
    const instant = new Date(now.getTime() + index * 35 * 60_000)
    created.push(await input.calendar.create(input.scope, calendarDraftForPlan({
      scope: input.scope,
      plan,
      householdTimeZone: input.householdTimeZone,
      instant,
      timerHidden: input.timerHidden,
    })))
  }
  return created
}
