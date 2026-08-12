import { placementForInstant } from '../../../calendarAdapter'
import type {
  CanonicalStudyTaskType,
  StudyCalendarBlockKind,
  StudyCalendarDraft,
  StudyLearnerScope,
  StudyLessonPlan,
  StudyPlanSegment,
} from '../../../types'
import type { PhysicalEducationLesson } from './types'

/**
 * FF-M5 — the Study segment adapter. This is not a new Study Engine: it
 * produces the exact same `StudyLessonPlan` / `StudyCalendarDraft` shapes
 * the accepted Study runtime already understands (see
 * src/study/curriculumAdapter.ts and src/study/calendarAdapter.ts), the way
 * every other host-lesson kind does. It exists as its own function, rather
 * than a new entry in curriculumAdapter.ts's closed HOST_STUDY_MAPPING,
 * because that shared file and its closed `HostStudyLessonKind` union sit
 * outside this module's ownership boundary; every field produced below is
 * one FamilyPilotStudyRuntime.startAssignment's `{ kind: 'calendar-block' }`
 * path already accepts unmodified.
 *
 * Physical Education is completion-only by design (RULES: no invasive
 * movement tracking) and subject 'other' (StudySubject has no PE entry), so
 * familyPilotTutorBridgeAvailable() is false for every PE assignment — no
 * adaptive Tutor Core bridge is ever offered for movement content. See
 * tutorExplanation.ts for the static substitute.
 */

const PHYSICAL_EDUCATION_BLOCK_KIND: StudyCalendarBlockKind = 'physical_education'

const PHASE_TASK_TYPE: Readonly<Record<string, CanonicalStudyTaskType>> = {
  'Welcome and retrieval': 'retrieval-practice',
  'Model or mini-lesson': 'direct-instruction',
  'Guided practice': 'guided-practice',
  'Independent application': 'independent-practice',
  'Exit ticket and next step': 'reflection',
}

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/

function parseMinutesUpperBound(range: string): number {
  const bounded = range.match(/^\D*(\d+)\D+(\d+)\D*$/)
  if (bounded) return Number(bounded[2])
  const single = range.match(/^\D*(\d+)\D*$/)
  if (single) return Number(single[1])
  throw new Error(`Unable to parse estimated minutes "${range}"`)
}

export function adaptPhysicalEducationLessonToStudyPlan(lesson: PhysicalEducationLesson): StudyLessonPlan {
  if (!SAFE_REF.test(lesson.lessonId)) throw new Error('lessonId must be a stable opaque reference.')
  const segments: StudyPlanSegment[] = lesson.lessonFlow.map((phase, index) => {
    const taskType = PHASE_TASK_TYPE[phase.segment]
    if (!taskType) throw new Error(`Unknown Physical Education lesson phase "${phase.segment}"`)
    return Object.freeze({
      segmentRef: `${lesson.lessonId}:segment:${index + 1}`,
      title: phase.segment,
      taskType,
      estimatedMinutes: parseMinutesUpperBound(phase.minutes),
      required: true,
    })
  })
  return Object.freeze({
    lessonRef: lesson.lessonId,
    title: lesson.title,
    subject: 'other',
    skillRefs: [`${lesson.courseId}:unit:${lesson.unitNumber}`],
    segments,
    masteryAuthority: 'completion-only',
    source: 'manuel-academy',
  })
}

/**
 * The `StudyCalendarDraft` for one PE lesson, tagged with the
 * `physical_education` block kind so hosts and guardians never see PE work
 * mislabeled as generic new-instruction seat time. Mirrors
 * calendarDraftForPlan in src/study/calendarAdapter.ts, but that function's
 * blockKind derivation is a closed source/subject switch that has no branch
 * for PE content, so this is a sibling rather than a call-through.
 */
export function physicalEducationCalendarDraft(input: {
  readonly scope: StudyLearnerScope
  readonly plan: StudyLessonPlan
  readonly householdTimeZone: string
  readonly instant: Date
  readonly timerHidden: boolean
}): StudyCalendarDraft {
  const placement = placementForInstant(input.instant, input.householdTimeZone)
  const suffix = input.plan.lessonRef.replace(/[^A-Za-z0-9._:-]/g, '-').slice(-80)
  const learnerSuffix = input.scope.learnerRef.replace(/[^A-Za-z0-9._:-]/g, '-').slice(-32)
  return Object.freeze({
    blockRef: `block:${learnerSuffix}:${placement.intendedLocalDate}:${suffix}`,
    externalItemRef: `host:${placement.intendedLocalDate}:${suffix}`,
    plan: input.plan,
    blockKind: PHYSICAL_EDUCATION_BLOCK_KIND,
    ...placement,
    householdTimeZone: input.householdTimeZone,
    timerVisibility: input.timerHidden ? 'hidden' : 'shown',
  })
}
