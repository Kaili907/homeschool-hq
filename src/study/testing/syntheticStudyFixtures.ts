import { adaptHostLessonToStudyPlan } from '../curriculumAdapter'
import { calendarDraftForPlan } from '../calendarAdapter'
import { syntheticGrade5StudyContext } from '../demonstrations'
import type { StudyCalendarEntry, StudyLearnerScope } from '../types'
import type { StudyPortBundle } from '../ports'

export const SYNTHETIC_NOW = new Date('2026-08-01T13:00:00.000Z')

/**
 * A frozen Math R1 skill id, for a block that must be ELIGIBLE for the
 * production Tutor.
 *
 * STUDY-A1-TUTOR-CONTENT-ELIGIBILITY-CONTRACT. The default `skillRefs` below is
 * a Study-namespace reference, and that is faithful to the real host: every
 * reference `HOST_STUDY_MAPPING` produces is Study-namespace, and the frozen
 * content deliberately declares none of them (subject-registry.ts calls naming
 * that mapping a curriculum decision). Until that mapping exists, NO host block
 * routes to reviewed Tutor content — which is exactly why the production route
 * is dark, and why the production selector refuses rather than teaching the
 * subject default.
 *
 * So a test that needs a genuinely accepted production Tutor turn has to say so
 * by supplying content that actually routes. It is sequence 02's first skill id,
 * and the block is a multiplication block, so the two agree about what is being
 * taught.
 */
export const REVIEWED_TUTOR_MATH_SKILL_REF = 'math-skill-md-equal-groups-v1'

export async function createSyntheticMathBlock(
  ports: StudyPortBundle,
  options: {
    readonly learnerRef?: string
    readonly suffix?: string
    readonly skillRefs?: readonly string[]
  } = {},
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
    skillRefs: [...(options.skillRefs ?? ['synthetic:grade5:math:multiplication'])],
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

/**
 * STUDY-A1-PRODUCTION-SAFE-CONTAINER — a block whose mastery authority is
 * `completion-only`, which is the half of the host surface no mounted test had
 * ever driven to completion.
 *
 * `parent-created` is not a synthetic category invented for this fixture: it is
 * one of the two kinds `adaptHostLessonToStudyPlan` maps to `completion-only`
 * (curriculumAdapter.ts), so this is the shipped shape of a parent's own
 * activity, not a shape only a test can produce. On that path the container asks
 * no Tutor anything and records no mastery decision — and still completes a
 * segment and writes a session row, which is why what that row may carry needs
 * a witness of its own.
 */
export async function createSyntheticParentCreatedBlock(
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
    lessonRef: `synthetic:grade5:parent-created:${suffix}`,
    title: 'Synthetic parent-created activity',
    kind: 'parent-created',
    skillRefs: ['synthetic:grade5:parent-created:activity'],
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
