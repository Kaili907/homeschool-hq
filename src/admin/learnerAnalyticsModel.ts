import { getStat, statusOf } from '../appState'
import { courseProgress, masteryOf } from '../academy/academyState'
import { ACADEMY_SUBJECT_LABELS, type AcademyCatalog } from '../academy/contentTypes'
import { workingLevelFor } from '../academy/workingLevel'
import { getState as getAssessmentState } from '../assessment/attempts'
import { TEST_BY_ID } from '../assessment/banks'
import { getAttendance, hasAttendance, yearToDateTotals } from '../attendance/attendance'
import { isDayComplete } from '../missions'
import { SKILL_BY_ID, skillsForGrade, type SkillId } from '../skills'
import type {
  StudyCalendarEntry,
  StudyParentSettings,
  StudyReviewRecommendation,
} from '../study/types'
import {
  ACADEMY_SUBJECTS,
  type AcademySubject,
  type Grade,
  type ISODate,
  type Profile,
} from '../types'
import type { AdminCapability } from './contracts'
import {
  ADMIN_EXPANDED_RELEASE,
  type AdminReleaseCourse,
  type AdminReleaseReadModel,
} from './releaseDataModel'

export const LEARNERS_READ_CAPABILITY = 'learners:read' as const
export const ADMIN_LEARNER_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

export function isAdminLearnerReference(value: unknown): value is string {
  return typeof value === 'string' && ADMIN_LEARNER_REFERENCE.test(value)
}

export const ADMIN_WORKING_GRADE_CHOICES = [
  '3', '4', '5', '7', '8', '9', '10', '11', '12',
] as const
export type AdminWorkingGrade = (typeof ADMIN_WORKING_GRADE_CHOICES)[number]
export type AdminDisplayedWorkingGrade = Grade | AdminWorkingGrade

export function isAdminWorkingGrade(value: string): value is AdminWorkingGrade {
  return ADMIN_WORKING_GRADE_CHOICES.some((grade) => grade === value)
}
export const LEARNER_ANALYTICS_LIMITS = Object.freeze({
  learners: 250,
  courses: 32,
  assessments: 32,
  recentEvidence: 12,
  studyCalendar: 30,
  studyReviews: 30,
  masterySnapshots: 30,
  needsDad: 32,
  attendanceDays: 10,
})

/**
 * The only field names permitted to cross the Admin learner wire boundary.
 * Projection objects are built explicitly below; the server validates this
 * allowlist again immediately before serialization.
 */
export const LEARNER_OPERATIONS_ALLOWED_FIELDS: ReadonlySet<string> = new Set([
  'observedAt', 'learners', 'details', 'detail',
  'learnerRef', 'displayName', 'nominalGrade', 'workingLevels', 'curriculum',
  'todayCompletion', 'attendance', 'mastery', 'study', 'openReviewCount', 'needsDadCount',
  'status', 'value', 'reason', 'subject', 'subjectLabel', 'level', 'source',
  'releaseVersion', 'grade', 'enrolledAt', 'enrolledCourseCount', 'matchedCourseCount',
  'completed', 'total', 'percent', 'complete', 'recordedToday', 'instructionalDaysYtd',
  'instructionalHoursYtd', 'mastered', 'developing', 'notStarted', 'scheduled',
  'resumeNeeded', 'active', 'pendingReviews',
  'courses', 'mathMastery', 'manualMasterySnapshots', 'recentEvidence', 'assessments',
  'interventions', 'futureIntegrations', 'availability',
  'courseRef', 'title', 'workingLevel', 'reteach', 'skillRef', 'skillName', 'attempts',
  'correct', 'lastSeen', 'at', 'kind', 'summary', 'assessmentRef', 'attemptCount',
  'score', 'masteryOutcome', 'requiresAdultScoring', 'retakeStatus',
  'calendar', 'workBlock', 'blockRef', 'intendedLocalDate', 'state',
  'requiredWorkCompletionPercent', 'estimatedRemainingMinutes', 'maximumWorkMinutes',
  'breakMinutes', 'timerHidden', 'accommodations', 'recentDays', 'date', 'hours',
  'needsDad', 'adultReviews', 'localAdultReviewRequests', 'academyReteachCount',
  'since', 'supportSignal', 'reviewRef', 'dueDate', 'reasonCodes',
  'operationalTelemetry', 'aiCost', 'overview', 'progress', 'operationalStatus',
])

export function hasOnlyLearnerOperationsFields(value: unknown, parentKey = '', depth = 0): boolean {
  if (depth > 16) return false
  if (value === null || typeof value !== 'object') return true
  if (Array.isArray(value)) return value.every((item) => hasOnlyLearnerOperationsFields(item, parentKey, depth + 1))
  return Object.entries(value).every(([key, child]) => {
    const allowed = parentKey === 'details' ? isAdminLearnerReference(key) : LEARNER_OPERATIONS_ALLOWED_FIELDS.has(key)
    return allowed && hasOnlyLearnerOperationsFields(child, key, depth + 1)
  })
}

const SAFE_LABEL_LENGTH = 120

function safeLabel(value: string, fallback: string): string {
  const normalized = value
    .replace(/[\u0000-\u001f\u007f]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
  return (normalized || fallback).slice(0, SAFE_LABEL_LENGTH)
}

export type LearnerEvidenceUnavailableReason =
  | 'not-recorded'
  | 'catalog-not-integrated'
  | 'catalog-partially-integrated'
  | 'study-not-integrated'
  | 'future-integration'
  | 'not-configured'
  | 'not-applicable'

export type LearnerOperationalAvailability =
  | 'available'
  | 'partial'
  | 'unavailable'
  | 'not-configured'
  | 'not-applicable'

export type LearnerEvidenceValue<T> =
  | { readonly status: 'available'; readonly value: T }
  | { readonly status: 'partial'; readonly value: T; readonly reason: LearnerEvidenceUnavailableReason }
  | { readonly status: 'unavailable'; readonly reason: LearnerEvidenceUnavailableReason }
  | { readonly status: 'not-configured'; readonly reason: LearnerEvidenceUnavailableReason }
  | { readonly status: 'not-applicable'; readonly reason: LearnerEvidenceUnavailableReason }

export type CurriculumEnrollmentEvidence =
  | { readonly status: 'not-configured' }
  | {
      readonly status: 'available' | 'partial'
      readonly releaseVersion: string
      readonly grade: Grade
      readonly enrolledAt: string
      readonly enrolledCourseCount: number
      readonly matchedCourseCount: number
    }

export interface StudyLearnerEvidence {
  readonly calendar: readonly StudyCalendarEntry[]
  readonly reviews: readonly StudyReviewRecommendation[]
  readonly settings: StudyParentSettings | null
}

export type StudyLearnerEvidenceState =
  | { readonly status: 'available'; readonly evidence: StudyLearnerEvidence }
  | { readonly status: 'unavailable' }

export interface WorkingLevelEvidence {
  readonly subject: AcademySubject
  readonly subjectLabel: string
  readonly level: AdminDisplayedWorkingGrade
  readonly source: 'explicit' | 'nominal-grade'
}

export interface CompletionEvidence {
  readonly completed: number
  readonly total: number
  readonly percent: number
  readonly complete: boolean
}

export interface MasterySummary {
  readonly mastered: number
  readonly developing: number
  readonly notStarted: number
  readonly total: number
}

export interface StudySummary {
  readonly scheduled: number
  readonly completed: number
  readonly resumeNeeded: number
  readonly active: number
  readonly pendingReviews: number
}

export interface LearnerListItem {
  readonly learnerRef: string
  readonly displayName: string
  readonly nominalGrade: Grade
  readonly workingLevels: readonly WorkingLevelEvidence[]
  readonly curriculum: CurriculumEnrollmentEvidence
  readonly todayCompletion: LearnerEvidenceValue<CompletionEvidence>
  readonly attendance: {
    readonly recordedToday: boolean
    readonly instructionalDaysYtd: number
    readonly instructionalHoursYtd: number
  }
  readonly mastery: LearnerEvidenceValue<MasterySummary>
  readonly study: LearnerEvidenceValue<StudySummary>
  readonly openReviewCount: number
  readonly needsDadCount: number
}

export interface CourseEvidence {
  readonly courseRef: string
  readonly title: string
  readonly subject: string
  readonly workingLevel: AdminDisplayedWorkingGrade | null
  readonly completed: number
  readonly total: number
  readonly mastered: number | null
  readonly reteach: number | null
  readonly source: 'academy' | 'manual-course'
}

export interface MathMasteryEvidence {
  readonly skillRef: SkillId
  readonly skillName: string
  readonly attempts: number
  readonly correct: number
  readonly mastery: number
  readonly status: 'mastered' | 'developing' | 'not-started'
  readonly lastSeen: ISODate | null
}

export interface AssessmentEvidence {
  readonly assessmentRef: string
  readonly title: string
  readonly source: 'fixed-assessment' | 'academy'
  readonly status: 'assigned' | 'in-progress' | 'completed' | 'not-started'
  readonly attemptCount: number
  readonly score: { readonly correct: number; readonly of: number } | null
  readonly masteryOutcome: 'secure' | 'developing' | 'not-yet' | null
  readonly percent: number | null
  readonly requiresAdultScoring: boolean
  readonly retakeStatus: 'ready' | 'locked' | 'not-applicable' | 'unavailable'
}

export interface RecentLearningEvidence {
  readonly at: string
  readonly kind: 'academy-lesson' | 'assessment' | 'mission-day' | 'reading' | 'typing' | 'mastery-snapshot' | 'study'
  readonly title: string
  readonly summary: string
}

export interface NeedsDadEvidence {
  readonly skillRef: SkillId
  readonly skillName: string
  readonly since: ISODate
  readonly supportSignal: 'repeated-walkthroughs' | 'tutor-review'
}

export interface ReviewEvidence {
  readonly reviewRef: string
  readonly dueDate: string
  readonly status: StudyReviewRecommendation['status']
  readonly reasonCodes: readonly string[]
}

export interface LearnerDetail {
  readonly learnerRef: string
  readonly displayName: string
  readonly nominalGrade: Grade
  readonly workingLevels: readonly WorkingLevelEvidence[]
  readonly curriculum: CurriculumEnrollmentEvidence
  readonly courses: LearnerEvidenceValue<readonly CourseEvidence[]>
  readonly mathMastery: readonly MathMasteryEvidence[]
  readonly manualMasterySnapshots: readonly {
    at: string
    subject: string
    level: number
  }[]
  readonly recentEvidence: readonly RecentLearningEvidence[]
  readonly assessments: readonly AssessmentEvidence[]
  readonly study: LearnerEvidenceValue<{
    readonly summary: StudySummary
    readonly calendar: readonly Pick<StudyCalendarEntry, 'blockRef' | 'title' | 'subject' | 'intendedLocalDate' | 'state' | 'requiredWorkCompletionPercent' | 'estimatedRemainingMinutes'>[]
    readonly workBlock: {
      readonly maximumWorkMinutes: number
      readonly breakMinutes: number
      readonly timerHidden: boolean
      readonly accommodations: number
    } | null
  }>
  readonly attendance: {
    readonly instructionalDaysYtd: number
    readonly instructionalHoursYtd: number
    readonly recordedToday: boolean
    readonly recentDays: readonly { readonly date: ISODate; readonly hours: number }[]
  }
  readonly interventions: {
    readonly needsDad: readonly NeedsDadEvidence[]
    readonly adultReviews: readonly ReviewEvidence[]
    readonly localAdultReviewRequests: number
    readonly academyReteachCount: number
  }
  readonly futureIntegrations: {
    readonly operationalTelemetry: LearnerEvidenceValue<never>
    readonly aiCost: LearnerEvidenceValue<never>
  }
  readonly availability: {
    readonly overview: LearnerOperationalAvailability
    readonly curriculum: LearnerOperationalAvailability
    readonly progress: LearnerOperationalAvailability
    readonly assessments: LearnerOperationalAvailability
    readonly study: LearnerOperationalAvailability
    readonly operationalStatus: LearnerOperationalAvailability
  }
}

export interface LearnerAnalyticsSnapshot {
  readonly observedAt: string
  readonly learners: readonly LearnerListItem[]
  readonly details: Readonly<Record<string, LearnerDetail>>
}

export interface BuildLearnerAnalyticsInput {
  readonly profiles: readonly Profile[]
  readonly today: ISODate
  readonly observedAt: string
  readonly academyCatalogs?: readonly AcademyCatalog[]
  readonly release?: AdminReleaseReadModel
  readonly studyByProfile?: Readonly<Record<string, StudyLearnerEvidenceState>>
}

interface CatalogIndex {
  readonly courseById: ReadonlyMap<string, AcademyCatalog['courses'][number]>
  readonly gradeByCourseId: ReadonlyMap<string, AcademyCatalog['grade']>
  readonly releaseCourseById: ReadonlyMap<string, AdminReleaseCourse>
  readonly lessonLabelById: ReadonlyMap<string, string>
  readonly assessmentLabelById: ReadonlyMap<string, string>
  readonly releaseVersions: ReadonlySet<string>
}

function releaseCourseKey(releaseVersion: string, courseId: string): string {
  return `${releaseVersion}\u0000${courseId}`
}

function indexCatalogs(catalogs: readonly AcademyCatalog[], release: AdminReleaseReadModel): CatalogIndex {
  const courseById = new Map<string, AcademyCatalog['courses'][number]>()
  const gradeByCourseId = new Map<string, AcademyCatalog['grade']>()
  const releaseCourseById = new Map<string, AdminReleaseCourse>()
  const lessonLabelById = new Map<string, string>()
  const assessmentLabelById = new Map<string, string>()
  const releaseVersions = new Set<string>()
  for (const catalog of catalogs) {
    releaseVersions.add(catalog.releaseVersion)
    for (const course of catalog.courses) {
      const key = releaseCourseKey(catalog.releaseVersion, course.courseId)
      courseById.set(key, course)
      gradeByCourseId.set(key, catalog.grade)
      const subject = ACADEMY_SUBJECT_LABELS[course.subject] ?? course.subject
      for (const unit of course.units) {
        for (const lessonId of unit.lessonIds) {
          lessonLabelById.set(lessonId, `${subject}: ${unit.title}`)
        }
        if (unit.hasAssessment) {
          const assessmentId = `${course.courseId}-u${String(unit.unitNumber).padStart(2, '0')}-assessment`
          assessmentLabelById.set(assessmentId, `${subject}: ${unit.title}`)
        }
      }
    }
  }
  releaseVersions.add(release.releaseVersion)
  for (const course of release.courses) {
    releaseCourseById.set(releaseCourseKey(release.releaseVersion, course.courseRef), course)
  }
  return { courseById, gradeByCourseId, releaseCourseById, lessonLabelById, assessmentLabelById, releaseVersions }
}

function curriculumEnrollment(profile: Profile, index: CatalogIndex): CurriculumEnrollmentEvidence {
  if (!profile.academy) return { status: 'not-configured' }
  const releaseAvailable = index.releaseVersions.has(profile.academy.releaseVersion)
  const matchedCourseCount = releaseAvailable
    ? profile.academy.courseIds.filter((courseId) => {
        const key = releaseCourseKey(profile.academy!.releaseVersion, courseId)
        return index.courseById.has(key) || index.releaseCourseById.has(key)
      }).length
    : 0
  const completeCatalogMatch = profile.academy.courseIds.length > 0
    && matchedCourseCount === profile.academy.courseIds.length
    && releaseAvailable
  return {
    status: completeCatalogMatch ? 'available' : 'partial',
    releaseVersion: safeLabel(profile.academy.releaseVersion, 'Unavailable'),
    grade: profile.academy.grade,
    enrolledAt: profile.academy.enrolledAt,
    enrolledCourseCount: profile.academy.courseIds.length,
    matchedCourseCount,
  }
}

function workingLevels(profile: Profile): WorkingLevelEvidence[] {
  return ACADEMY_SUBJECTS.map((subject) => ({
    subject,
    subjectLabel: ACADEMY_SUBJECT_LABELS[subject] ?? subject,
    level: workingLevelFor(profile, subject),
    source: profile.workingLevels?.[subject] === undefined ? 'nominal-grade' : 'explicit',
  }))
}

function todayCompletion(profile: Profile, today: ISODate): LearnerEvidenceValue<CompletionEvidence> {
  const day = profile.missions[today]
  if (!day) return { status: 'not-configured', reason: 'not-recorded' }
  const completed = day.items.filter((item) => item.done).length
  const total = day.items.length
  return {
    status: 'available',
    value: {
      completed,
      total,
      percent: total === 0 ? 0 : Math.round((completed / total) * 100),
      complete: isDayComplete(day),
    },
  }
}

function masterySummary(profile: Profile, index: CatalogIndex): LearnerEvidenceValue<MasterySummary> {
  const mathSkills = skillsForGrade(profile.grade)
  const states = mathSkills.map((skill) => statusOf(profile.skills[skill.id]))
  const academyLessonIds = (profile.academy?.courseIds ?? []).flatMap((courseId) =>
    index.courseById.get(releaseCourseKey(profile.academy!.releaseVersion, courseId))?.units.flatMap((unit) => unit.lessonIds) ?? [],
  )
  const academyStates = academyLessonIds.map((lessonId) => masteryOf(profile.academy?.lessons[lessonId]))
  if (states.length === 0 && academyStates.length === 0) {
    return { status: 'unavailable', reason: 'catalog-not-integrated' }
  }
  const all = [...states, ...academyStates]
  return {
    status: 'available',
    value: {
      mastered: all.filter((state) => state === 'mastered').length,
      developing: all.filter((state) => state === 'developing').length,
      notStarted: all.filter((state) => state === 'not-started').length,
      total: all.length,
    },
  }
}

function studySummary(evidence: StudyLearnerEvidence): StudySummary {
  const calendar = evidence.calendar.slice(0, LEARNER_ANALYTICS_LIMITS.studyCalendar)
  const reviews = evidence.reviews.slice(0, LEARNER_ANALYTICS_LIMITS.studyReviews)
  return {
    scheduled: calendar.filter((entry) => entry.state === 'scheduled').length,
    completed: calendar.filter((entry) => entry.state === 'completed').length,
    resumeNeeded: calendar.filter((entry) => entry.state === 'paused').length,
    active: calendar.filter((entry) => entry.state === 'active').length,
    pendingReviews: reviews.filter((review) => review.status === 'pending-parent').length,
  }
}

function coursesFor(profile: Profile, catalogs: readonly AcademyCatalog[], index: CatalogIndex): LearnerEvidenceValue<readonly CourseEvidence[]> {
  const courses: CourseEvidence[] = (profile.courses ?? []).slice(0, LEARNER_ANALYTICS_LIMITS.courses).map((course) => ({
    courseRef: course.id,
    title: safeLabel(course.name, 'Course'),
    subject: safeLabel(course.name, 'Course'),
    workingLevel: null,
    completed: course.units.filter((unit) => unit.done).length,
    total: course.units.length,
    mastered: null,
    reteach: null,
    source: 'manual-course',
  }))

  const enrolled = profile.academy?.courseIds ?? []
  const releaseVersion = profile.academy?.releaseVersion ?? ''
  const releaseAvailable = profile.academy
    ? index.releaseVersions.has(profile.academy.releaseVersion)
    : true
  const knownCourses = releaseAvailable
    ? enrolled.map((courseId) => index.courseById.get(releaseCourseKey(releaseVersion, courseId))).filter((course): course is AcademyCatalog['courses'][number] => !!course)
    : []
  const knownCourseIds = new Set(knownCourses.map((course) => course.courseId))
  const releaseCourses = releaseAvailable
    ? enrolled
        .filter((courseId) => !knownCourseIds.has(courseId))
        .map((courseId) => index.releaseCourseById.get(releaseCourseKey(releaseVersion, courseId)))
        .filter((course): course is AdminReleaseCourse => !!course)
    : []
  if (knownCourses.length > 0) {
    const catalog: AcademyCatalog = {
      releaseVersion,
      grade: index.gradeByCourseId.get(releaseCourseKey(releaseVersion, knownCourses[0].courseId)) ?? catalogs[0]?.grade ?? '5',
      courses: knownCourses,
    }
    const progress = courseProgress(profile, catalog)
    for (const course of knownCourses) {
      const summary = progress.find((item) => item.courseId === course.courseId)!
      const level = index.gradeByCourseId.get(releaseCourseKey(releaseVersion, course.courseId)) ?? workingLevelFor(profile, course.subject as AcademySubject)
      const subjectLabel = ACADEMY_SUBJECT_LABELS[course.subject] ?? safeLabel(course.subject, 'Academy course')
      courses.push({
        courseRef: course.courseId,
        title: `Grade ${level} ${subjectLabel}`,
        subject: course.subject,
        workingLevel: level,
        completed: summary.completed,
        total: summary.total,
        mastered: summary.mastered,
        reteach: summary.reteach,
        source: 'academy',
      })
    }
  }

  for (const course of releaseCourses) {
    const lessonStates = Object.entries(profile.academy?.lessons ?? {})
      .filter(([lessonRef, state]) => state.releaseVersion === releaseVersion && lessonRef.startsWith(`${course.courseRef}-`))
      .map(([, state]) => masteryOf(state))
    courses.push({
      courseRef: course.courseRef,
      title: course.title,
      subject: course.subject,
      workingLevel: String(course.grade) as AdminDisplayedWorkingGrade,
      completed: lessonStates.filter((state) => state === 'mastered').length,
      total: course.lessonCount,
      mastered: lessonStates.filter((state) => state === 'mastered').length,
      reteach: lessonStates.filter((state) => state === 'developing').length,
      source: 'academy',
    })
  }

  if (enrolled.length > knownCourses.length + releaseCourses.length) {
    return { status: 'partial', value: courses.slice(0, LEARNER_ANALYTICS_LIMITS.courses), reason: 'catalog-partially-integrated' }
  }
  if (courses.length === 0) return { status: 'not-configured', reason: 'not-configured' }
  return { status: 'available', value: courses.slice(0, LEARNER_ANALYTICS_LIMITS.courses) }
}

function fixedAssessments(profile: Profile): AssessmentEvidence[] {
  const state = getAssessmentState(profile.assessments)
  const assignedRecords = state.assigned.slice(-LEARNER_ANALYTICS_LIMITS.assessments)
  const attemptRecords = state.attempts.slice(-LEARNER_ANALYTICS_LIMITS.assessments)
  const ids = new Set([
    ...assignedRecords.map((assignment) => assignment.testId),
    ...attemptRecords.map((attempt) => attempt.testId),
  ])
  return [...ids].slice(0, LEARNER_ANALYTICS_LIMITS.assessments).map((testId) => {
    const attempts = attemptRecords.filter((attempt) => attempt.testId === testId)
    const completed = attempts.filter((attempt) => !!attempt.finishedAt)
    const inProgress = attempts.some((attempt) => !attempt.finishedAt)
    const assigned = assignedRecords.some((assignment) => assignment.testId === testId)
    const latest = completed[completed.length - 1]
    const score = latest?.autoScore
    const totals = score
      ? Object.values(score.bySection).reduce((sum, section) => ({ correct: sum.correct + section.correct, of: sum.of + section.of }), { correct: 0, of: 0 })
      : null
    return {
      assessmentRef: testId,
      title: TEST_BY_ID[testId]?.title ?? testId,
      source: 'fixed-assessment' as const,
      status: completed.length > 0 ? 'completed' as const : inProgress ? 'in-progress' as const : assigned ? 'assigned' as const : 'not-started' as const,
      attemptCount: attempts.length,
      score: totals,
      masteryOutcome: null,
      percent: totals && totals.of > 0 ? Math.round((totals.correct / totals.of) * 100) : null,
      requiresAdultScoring: (score?.gradedItems ?? 0) > 0,
      retakeStatus: completed.length === 0
        ? 'not-applicable' as const
        : (state.retakeUnlocked ?? []).includes(testId)
          ? 'ready' as const
          : 'locked' as const,
    }
  })
}

function academyAssessments(profile: Profile, index: CatalogIndex): AssessmentEvidence[] {
  const recorded = profile.academy?.assessments ?? {}
  const ids = new Set<string>(Object.keys(recorded).slice(0, LEARNER_ANALYTICS_LIMITS.assessments))
  for (const courseId of profile.academy?.courseIds ?? []) {
    const course = index.courseById.get(releaseCourseKey(profile.academy!.releaseVersion, courseId))
    for (const unit of course?.units ?? []) {
      if (unit.hasAssessment) ids.add(`${courseId}-u${String(unit.unitNumber).padStart(2, '0')}-assessment`)
    }
  }
  return [...ids].slice(0, LEARNER_ANALYTICS_LIMITS.assessments).map((assessmentId) => {
    const attempts = recorded[assessmentId] ?? []
    const latest = attempts[attempts.length - 1]
    return {
      assessmentRef: assessmentId,
      title: index.assessmentLabelById.get(assessmentId) ?? assessmentId,
      source: 'academy' as const,
      status: latest ? 'completed' as const : 'not-started' as const,
      attemptCount: attempts.length,
      score: null,
      masteryOutcome: latest?.outcome ?? null,
      percent: latest?.percent ?? null,
      requiresAdultScoring: false,
      retakeStatus: 'unavailable' as const,
    }
  })
}

function recentEvidence(profile: Profile, study: StudyLearnerEvidenceState | undefined, index: CatalogIndex): RecentLearningEvidence[] {
  const evidence: RecentLearningEvidence[] = []
  for (const [lessonId, lesson] of Object.entries(profile.academy?.lessons ?? {}).slice(-32)) {
    const at = lesson.completedAt ?? lesson.startedAt
    evidence.push({
      at,
      kind: 'academy-lesson',
      title: index.lessonLabelById.get(lessonId) ?? lessonId,
      summary: lesson.status === 'complete' ? `Completed · mastery ${masteryOf(lesson)}` : lesson.status === 'reteach' ? 'Reteach needed' : 'In progress',
    })
  }
  for (const attempt of getAssessmentState(profile.assessments).attempts.slice(-32)) {
    evidence.push({
      at: attempt.finishedAt ?? attempt.startedAt,
      kind: 'assessment',
      title: TEST_BY_ID[attempt.testId]?.title ?? attempt.testId,
      summary: attempt.finishedAt ? 'Completed' : 'In progress',
    })
  }
  for (const [date, mission] of Object.entries(profile.missions).slice(-32)) {
    if (isDayComplete(mission)) evidence.push({ at: date, kind: 'mission-day', title: 'Mission day', summary: 'Completed' })
  }
  for (const reading of (profile.reading?.sessions ?? []).slice(-32)) {
    evidence.push({
      at: reading.date,
      kind: 'reading',
      title: 'Reading session',
      summary: `${reading.mode === 'manual' ? 'Manual' : 'Estimated'} ${reading.wcpm} WCPM`,
    })
  }
  if (profile.typing?.lastPracticedDate) {
    evidence.push({ at: profile.typing.lastPracticedDate, kind: 'typing', title: 'Typing practice', summary: 'Practice recorded' })
  }
  for (const snapshot of (profile.masterySnapshots ?? []).slice(-LEARNER_ANALYTICS_LIMITS.masterySnapshots)) {
    evidence.push({ at: snapshot.at, kind: 'mastery-snapshot', title: safeLabel(snapshot.subject, 'Subject'), summary: `Mastery snapshot ${snapshot.level}` })
  }
  if (study?.status === 'available') {
    for (const entry of study.evidence.calendar.slice(0, LEARNER_ANALYTICS_LIMITS.studyCalendar)) {
      evidence.push({ at: entry.scheduledStart, kind: 'study', title: entry.title, summary: entry.state === 'paused' ? `Resume needed · ${entry.requiredWorkCompletionPercent}% complete` : entry.state })
    }
  }
  return evidence.sort((a, b) => b.at.localeCompare(a.at)).slice(0, LEARNER_ANALYTICS_LIMITS.recentEvidence)
}

function detailFor(profile: Profile, input: BuildLearnerAnalyticsInput, index: CatalogIndex): LearnerDetail {
  const attendance = getAttendance(profile)
  const totals = yearToDateTotals(attendance, input.today)
  const studyState = input.studyByProfile?.[profile.id]
  const study = studyState?.status === 'available'
    ? {
        status: 'available' as const,
        value: {
          summary: studySummary(studyState.evidence),
          calendar: studyState.evidence.calendar.slice(0, LEARNER_ANALYTICS_LIMITS.studyCalendar).map((entry) => ({
            blockRef: entry.blockRef,
            title: safeLabel(entry.title, 'Study block'),
            subject: entry.subject,
            intendedLocalDate: entry.intendedLocalDate,
            state: entry.state,
            requiredWorkCompletionPercent: entry.requiredWorkCompletionPercent,
            estimatedRemainingMinutes: entry.estimatedRemainingMinutes,
          })),
          workBlock: studyState.evidence.settings ? {
            maximumWorkMinutes: studyState.evidence.settings.maximumWorkMinutes,
            breakMinutes: studyState.evidence.settings.breakMinutes,
            timerHidden: studyState.evidence.settings.timerHidden,
            accommodations: studyState.evidence.settings.accommodations.length,
          } : null,
        },
      }
    : { status: 'unavailable' as const, reason: 'study-not-integrated' as const }
  const needsDad = (Object.entries(profile.tutorFlags ?? {}) as [SkillId, NonNullable<Profile['tutorFlags']>[SkillId]][])
    .filter((entry): entry is [SkillId, NonNullable<typeof entry[1]>] => !!entry[1])
    .slice(0, LEARNER_ANALYTICS_LIMITS.needsDad)
    .map(([skillRef, flag]) => ({
      skillRef,
      skillName: SKILL_BY_ID[skillRef]?.name ?? skillRef,
      since: flag.since,
      supportSignal: flag.sessionCount > 0 || flag.weekCount > 0 ? 'repeated-walkthroughs' as const : 'tutor-review' as const,
    }))
  const academyReteachCount = Object.values(profile.academy?.lessons ?? {}).filter((lesson) => lesson.status === 'reteach').length
  const curriculum = curriculumEnrollment(profile, index)
  const courses = coursesFor(profile, input.academyCatalogs ?? [], index)
  const mathMastery = skillsForGrade(profile.grade).map((skill) => {
    const stat = getStat(profile, skill.id)
    return {
      skillRef: skill.id,
      skillName: skill.name,
      attempts: stat.attempts,
      correct: stat.correct,
      mastery: stat.mastery,
      status: statusOf(stat),
      lastSeen: stat.lastSeen ?? null,
    }
  })
  const assessments = [...fixedAssessments(profile), ...academyAssessments(profile, index)].slice(0, LEARNER_ANALYTICS_LIMITS.assessments)
  const curriculumAvailability: LearnerOperationalAvailability = courses.status === 'partial'
    || curriculum.status === 'partial'
    || (curriculum.status === 'not-configured' && courses.status === 'available')
    ? 'partial'
    : curriculum.status === 'not-configured' && courses.status === 'not-configured'
      ? 'not-configured'
      : courses.status === 'unavailable'
        ? 'unavailable'
        : 'available'
  const progressAvailability: LearnerOperationalAvailability = courses.status === 'partial'
    ? 'partial'
    : mathMastery.length > 0 || courses.status === 'available'
      ? 'available'
      : courses.status
  return {
    learnerRef: profile.id,
    displayName: safeLabel(profile.name, 'Learner'),
    nominalGrade: profile.grade,
    workingLevels: workingLevels(profile),
    curriculum,
    courses,
    mathMastery,
    manualMasterySnapshots: (profile.masterySnapshots ?? []).slice(-LEARNER_ANALYTICS_LIMITS.masterySnapshots).map(({ at, subject, level }) => ({ at, subject: safeLabel(subject, 'Subject'), level })),
    recentEvidence: recentEvidence(profile, studyState, index),
    assessments,
    study,
    attendance: {
      instructionalDaysYtd: totals.days,
      instructionalHoursYtd: totals.hours,
      recordedToday: hasAttendance(attendance, input.today),
      recentDays: [...attendance.log].sort((a, b) => b.date.localeCompare(a.date)).slice(0, LEARNER_ANALYTICS_LIMITS.attendanceDays),
    },
    interventions: {
      needsDad,
      adultReviews: studyState?.status === 'available'
        ? studyState.evidence.reviews.slice(0, LEARNER_ANALYTICS_LIMITS.studyReviews).map((review) => ({ reviewRef: review.recommendationRef, dueDate: review.dueDate, status: review.status, reasonCodes: review.reasonCodes.slice(0, 8).map((code) => safeLabel(code, 'review')) }))
        : [],
      localAdultReviewRequests: studyState?.status === 'available' ? (studyState.evidence.settings?.adultReviewRequests.length ?? 0) : 0,
      academyReteachCount,
    },
    futureIntegrations: {
      operationalTelemetry: { status: 'unavailable', reason: 'future-integration' },
      aiCost: { status: 'unavailable', reason: 'future-integration' },
    },
    availability: {
      overview: 'available',
      curriculum: curriculumAvailability,
      progress: progressAvailability,
      assessments: assessments.length > 0 ? 'available' : 'not-configured',
      study: study.status,
      operationalStatus: 'partial',
    },
  }
}

/**
 * Privacy-minimized projection from existing trusted learner state. This function
 * deliberately never reads Profile.mindset journal storage, tutorChats,
 * assistant.sessions, assessment answers, audio, or free-text flag reasons.
 */
export function buildLearnerAnalyticsSnapshot(input: BuildLearnerAnalyticsInput): LearnerAnalyticsSnapshot {
  const index = indexCatalogs(input.academyCatalogs ?? [], input.release ?? ADMIN_EXPANDED_RELEASE)
  const profiles = input.profiles.slice(0, LEARNER_ANALYTICS_LIMITS.learners)
  const details = Object.fromEntries(profiles.map((profile) => [profile.id, detailFor(profile, input, index)]))
  const learners = profiles.map((profile): LearnerListItem => {
    const detail = details[profile.id]
    const studyState = input.studyByProfile?.[profile.id]
    const study = studyState?.status === 'available'
      ? { status: 'available' as const, value: studySummary(studyState.evidence) }
      : { status: 'unavailable' as const, reason: 'study-not-integrated' as const }
    const attendance = getAttendance(profile)
    const totals = yearToDateTotals(attendance, input.today)
    return {
      learnerRef: profile.id,
      displayName: safeLabel(profile.name, 'Learner'),
      nominalGrade: profile.grade,
      workingLevels: detail.workingLevels,
      curriculum: detail.curriculum,
      todayCompletion: todayCompletion(profile, input.today),
      attendance: {
        recordedToday: hasAttendance(attendance, input.today),
        instructionalDaysYtd: totals.days,
        instructionalHoursYtd: totals.hours,
      },
      mastery: masterySummary(profile, index),
      study,
      openReviewCount: detail.interventions.needsDad.length + (study.status === 'available' ? study.value.pendingReviews : 0) + detail.interventions.localAdultReviewRequests,
      needsDadCount: detail.interventions.needsDad.length,
    }
  })
  return { observedAt: input.observedAt, learners, details }
}

export type LearnerAnalyticsAuthorization =
  | { readonly status: 'resolving' }
  | { readonly status: 'unauthorized'; readonly reasonCode?: string }
  | {
      readonly status: 'authorized'
      readonly capabilities: readonly AdminCapability[]
    }

export interface LearnerAnalyticsReadSource {
  /** Production adapters must enforce authorization again on the server. */
  read(request: { readonly capability: typeof LEARNERS_READ_CAPABILITY; readonly today: ISODate }): Promise<LearnerAnalyticsSnapshot>
}

export type LearnerAnalyticsViewState =
  | { readonly status: 'resolving' }
  | { readonly status: 'unauthorized'; readonly reasonCode: string }
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly snapshot: LearnerAnalyticsSnapshot }

/** Presentation gate only; canonical ADMIN-1/server enforcement remains required. */
export async function loadLearnerAnalytics(
  authorization: LearnerAnalyticsAuthorization,
  source: LearnerAnalyticsReadSource,
  today: ISODate,
): Promise<LearnerAnalyticsViewState> {
  if (authorization.status === 'resolving') return { status: 'resolving' }
  if (authorization.status !== 'authorized' || !authorization.capabilities.includes(LEARNERS_READ_CAPABILITY)) {
    return {
      status: 'unauthorized',
      reasonCode: authorization.status === 'unauthorized' ? authorization.reasonCode ?? 'authorization_unavailable' : 'learners_read_required',
    }
  }
  try {
    return { status: 'ready', snapshot: await source.read({ capability: LEARNERS_READ_CAPABILITY, today }) }
  } catch {
    return { status: 'error', message: 'Learner evidence could not be loaded safely.' }
  }
}
