import { adaptHostLessonToStudyPlan } from '../curriculumAdapter'
import { calendarDraftForPlan } from '../calendarAdapter'
import { syntheticGrade5StudyContext } from '../demonstrations'
import type { StudyCalendarEntry, StudyLearnerScope } from '../types'
import type { StudyPortBundle } from '../ports'

export const SYNTHETIC_NOW = new Date('2026-08-01T13:00:00.000Z')

export async function createSyntheticMathBlock(
  ports: StudyPortBundle,
  options: { readonly learnerRef?: string; readonly suffix?: string } = {},
): Promise<{ readonly entry: StudyCalendarEntry; readonly scope: StudyLearnerScope }> {
  const context = syntheticGrade5StudyContext('math')
  const scope = {
    householdRef: context.householdRef,
    learnerRef: options.learnerRef ?? context.learnerRef,
  }
  const suffix = options.suffix ?? 'main'
  const plan = adaptHostLessonToStudyPlan({
    lessonRef: `synthetic:grade5:math:${suffix}`,
    title: 'Synthetic Grade 5 math',
    kind: 'math',
    skillRefs: ['synthetic:grade5:math:multiplication'],
  })
  const draft = calendarDraftForPlan({
    scope,
    plan,
    householdTimeZone: context.householdTimeZone,
    instant: SYNTHETIC_NOW,
    timerHidden: false,
  })
  return { entry: await ports.calendar.create(scope, draft), scope }
}
