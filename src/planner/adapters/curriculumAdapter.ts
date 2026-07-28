import type { Profile, SchoolYear } from '../../types'
import { weekdayOf } from '../../curriculum/pacing'
import { todayForGirl } from '../../curriculum/hubModel'
import type { PlanDoc } from '../../curriculum/parser'
import type { PlannerBlock, PlannerWeekday } from '../types'

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

/**
 * Groups a subject's already-derived daily items into one clearly labelled
 * Manuel Academy block while retaining an item reference for every source row.
 */
export function curriculumBlocksForDay(
  profile: Profile,
  docs: PlanDoc[],
  schoolYear: SchoolYear,
  date: string,
): PlannerBlock[] {
  const weekday = weekdayOf(date)
  if (weekday === 'Sat' || weekday === 'Sun') return []
  const today = todayForGirl(profile, docs, schoolYear, date)
  if (today.travelWeek) return []

  const blocks: PlannerBlock[] = []
  const seen = new Set<string>()
  let cursor = 10 * 60
  for (const subject of today.subjects) {
    if (subject.missing || subject.items.length === 0) continue
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
      description: itemRefs.map((item) => `${item.dadTaught ? 'Parent-led: ' : ''}${item.text}`).join(' · '),
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
        lessonId: `${subject.subject.id}:week-${subject.pointer}`,
        safeEntryData: {
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
  return blocks
}
