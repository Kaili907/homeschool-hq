import type { Profile, SchoolYear } from '../../types'
import { weekdayOf } from '../../curriculum/pacing'
import { todayForGirl } from '../../curriculum/hubModel'
import type { PlanDoc } from '../../curriculum/parser'
import type {
  PlannerAvailabilityNotice,
  PlannerBlock,
  PlannerWeekday,
} from '../types'

const ISO_WEEKDAYS: Record<string, PlannerWeekday> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
}

const pad = (value: number) => String(value).padStart(2, '0')
const clockAt = (minutes: number): string =>
  `${pad(Math.floor(Math.min(minutes, 1439) / 60))}:${pad(Math.min(minutes, 1439) % 60)}`

export interface CurriculumPlanForDay {
  blocks: PlannerBlock[]
  notices: PlannerAvailabilityNotice[]
}

const noticeForMissingSubject = (
  profile: Profile,
  date: string,
  subject: { id: string; label: string },
): PlannerAvailabilityNotice => {
  const missingPlacement = profile.placementDone !== true
  return {
    id: `curriculum-notice:${profile.id}:${date}:${subject.id}:${
      missingPlacement ? 'missing-placement' : 'missing-plan'
    }`,
    profileId: profile.id,
    date,
    reason: missingPlacement ? 'missing-placement' : 'missing-plan',
    title: `${subject.label} is not available yet`,
    message: missingPlacement
      ? 'A parent can finish placement or review the Plans tab before this work is scheduled.'
      : 'No curriculum plan is loaded for this subject yet. A parent can review the Plans tab.',
  }
}

const noticeForMissingWeek = (
  profile: Profile,
  date: string,
  subject: { id: string; label: string },
  week: number,
): PlannerAvailabilityNotice => ({
  id: `curriculum-notice:${profile.id}:${date}:${subject.id}:missing-source:week-${week}`,
  profileId: profile.id,
  date,
  reason: 'missing-source',
  title: `${subject.label} source is unavailable`,
  message: `The curriculum plan does not contain week ${week}. A parent can review the Plans tab.`,
})

const safeRouteForSubject = (
  profile: Profile,
  subjectId: string,
): string | undefined => {
  if (subjectId === 'mindset') return 'mindset'
  if (
    subjectId === 'math' &&
    (profile.grade === '3' || profile.grade === '4' || profile.grade === '6')
  ) {
    return 'math-practice'
  }
  if (
    subjectId === 'reading' &&
    (profile.grade === '3' || profile.grade === '4' || profile.grade === '6')
  ) {
    return 'reading'
  }
  if (
    subjectId === 'typing' &&
    (profile.grade === '3' || profile.grade === '4' || profile.grade === '6')
  ) {
    return 'typing'
  }
  return undefined
}

/**
 * Groups a subject's already-derived daily items into one clearly labelled
 * Manuel Academy block while retaining an item reference for every source row.
 */
export function curriculumPlanForDay(
  profile: Profile,
  docs: PlanDoc[],
  schoolYear: SchoolYear,
  date: string,
): CurriculumPlanForDay {
  const weekday = weekdayOf(date)
  if (weekday === 'Sat' || weekday === 'Sun') {
    return { blocks: [], notices: [] }
  }
  const today = todayForGirl(profile, docs, schoolYear, date)
  if (today.travelWeek) return { blocks: [], notices: [] }

  const blocks: PlannerBlock[] = []
  const notices: PlannerAvailabilityNotice[] = []
  const seen = new Set<string>()
  let cursor = 10 * 60
  for (const subject of today.subjects) {
    if (subject.missing) {
      notices.push(
        noticeForMissingSubject(profile, date, subject.subject),
      )
      continue
    }
    const sourceDoc = docs.find(
      (doc) =>
        doc.subjectId === subject.subject.id &&
        (doc.grades === 'all' || doc.grades.includes(profile.grade)),
    )
    if (!sourceDoc?.weeks[subject.pointer]) {
      notices.push(
        noticeForMissingWeek(
          profile,
          date,
          subject.subject,
          subject.pointer,
        ),
      )
      continue
    }
    // A defined week may legitimately have no item for this weekday.
    if (subject.items.length === 0) continue
    const id = `curriculum:${subject.subject.id}:week-${subject.pointer}`
    if (seen.has(id)) continue
    seen.add(id)
    const itemRefs = subject.items.map((item, index) => ({
      id: `${subject.subject.id}:week-${subject.pointer}:item-${index + 1}`,
      text: item.text,
      dadTaught: item.dadTaught,
    }))
    const requiresParentHelp = itemRefs.some((item) => item.dadTaught)
    const expectedMinutes = Math.max(20, itemRefs.length * 20)
    blocks.push({
      id,
      title: `Manuel Academy · ${subject.subject.label}`,
      studentInstructions: itemRefs
        .map(
          (item) =>
            `${item.dadTaught ? 'Parent-led: ' : ''}${item.text}`,
        )
        .join(' · '),
      category: 'manuel-academy',
      source: {
        kind: 'curriculum',
        subjectId: subject.subject.id,
        subjectLabel: subject.subject.label,
        week: subject.pointer,
        items: itemRefs,
      },
      assignedProfileIds: [profile.id],
      assignToAll: false,
      weekdays: [ISO_WEEKDAYS[weekday]],
      startTime: clockAt(cursor),
      expectedMinutes,
      scheduleBehavior: 'flexible',
      linkedActivity: {
        adapter: 'curriculum',
        activityId: subject.subject.id,
        ...(safeRouteForSubject(profile, subject.subject.id)
          ? { route: safeRouteForSubject(profile, subject.subject.id) }
          : {}),
        lessonId: `${subject.subject.id}:week-${subject.pointer}`,
        safeEntryData: {
          profileId: profile.id,
          subjectId: subject.subject.id,
          week: subject.pointer,
          itemIds: itemRefs.map((item) => item.id),
        },
      },
      requiresParentHelp,
      active: true,
      createdAt: `${date}T00:00:00.000`,
      updatedAt: `${date}T00:00:00.000`,
    })
    cursor += expectedMinutes
  }
  return { blocks, notices }
}

/**
 * Compatibility wrapper for pure callers that only need generated blocks.
 * Daily-plan selectors should use curriculumPlanForDay so notices are retained.
 */
export function curriculumBlocksForDay(
  profile: Profile,
  docs: PlanDoc[],
  schoolYear: SchoolYear,
  date: string,
): PlannerBlock[] {
  return curriculumPlanForDay(profile, docs, schoolYear, date).blocks
}
