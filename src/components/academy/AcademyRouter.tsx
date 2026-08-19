import { useEffect, useRef, useState } from 'react'
import type { AcademyGrade, Profile, SchoolYear } from '../../types'
import { isoToday } from '../../appState'
import { derivedScopeWeek, isSchoolYearConfigured, resolvePointer } from '../../curriculum/pacing'
import type { AcademyRoute } from '../../academy/academyRoute'
import { loadUnit } from '../../academy/contentClient'
import { loadProgram, type AcademyProgram } from '../../academy/program'
import type { AcademyProgramEntry } from '../../academy/workingLevel'
import type { AcademyStudyContext } from '../../academy/adapters/studyContextAdapter'
import {
  ACADEMY_SUBJECT_LABELS,
  type AcademyCatalog,
  type AcademyCatalogCourse,
  type AcademyLesson,
  type AcademySchedule,
  type AcademyUnitChunk,
} from '../../academy/contentTypes'
import {
  enrollInCatalog,
  isStaleAttempt,
  masteryOf,
  completeSegment,
  latestAssessmentAttempt,
  reopenLesson,
  startLesson,
  submitLessonCheck,
  recordReassessment,
} from '../../academy/academyState'
import {
  StudentDashboard,
  type StudentDashboardComposition,
} from './dashboard/StudentDashboard'

/**
 * CURR-1 — the Manuel Academy curriculum router, lazy-loaded from App.tsx while
 * the universal dashboard shell remains synchronous. Per-level feature flags
 * gate only the entries composed inside it. The surface is self-styled, text-first,
 * keyboard-first: every control is a real button/input, headings receive focus
 * on view changes, and content renders without any media.
 *
 * ACADEMY-LEVEL-DECOUPLE: the surface is driven by the girl's PROGRAM — her
 * per-subject working levels — not by her profile grade. One profile can hold
 * courses from several levels at once, so the router composes a merged catalog
 * (see academy/program.ts) and labels each course with the level it came from.
 * This surface is read-only with respect to levels: nothing here can change one.
 */

interface AcademyProps {
  profile: Profile
  entries: readonly AcademyProgramEntry[]
  schoolYear: SchoolYear | undefined
  route: AcademyRoute
  onNavigate: (route: AcademyRoute) => void
  onPatch: (update: (prev: Profile) => Profile) => void
  onOpenStudy?: (context: AcademyStudyContext) => void
  onExit: () => void
  dashboard?: StudentDashboardComposition
}

type ProgramLoadState =
  | { entriesKey: string; status: 'loading' }
  | { entriesKey: string; status: 'ready'; program: AcademyProgram }
  | { entriesKey: string; status: 'error'; message: string }

const EMPTY_DASHBOARD_CATALOG: AcademyCatalog = {
  releaseVersion: '',
  grade: '5',
  courses: [],
}
const EMPTY_DASHBOARD_SCHEDULE: AcademySchedule = {
  releaseVersion: '',
  grade: '5',
  days: [],
}

/**
 * Authorize a parsed route against the CURRENT composed program before any
 * child view can fetch a unit or write lesson state. The catalog summaries are
 * sufficient for every check: course membership, unit membership, lesson
 * membership, and whether an assessment exists.
 */
function routeAvailable(catalog: AcademyCatalog, route: AcademyRoute): boolean {
  if (route.kind === 'home' || route.kind === 'schedule') return true
  const course = catalog.courses.find((item) => item.courseId === route.courseId)
  if (!course) return false
  if (route.kind === 'course') return true
  const unit = course.units.find((item) => item.unitNumber === route.unitNumber)
  if (!unit) return false
  if (route.kind === 'unit') return true
  if (route.kind === 'lesson') return unit.lessonIds.includes(route.lessonId)
  return unit.hasAssessment
}

function unavailableRouteLabel(route: AcademyRoute): keyof typeof MISSING_CONTENT_COPY {
  switch (route.kind) {
    case 'course':
      return 'course'
    case 'unit':
      return 'unit'
    case 'lesson':
      return 'lesson'
    case 'assessment':
      return 'assessment'
    case 'home':
    case 'schedule':
      return 'course'
  }
}

export function AcademyRouter(props: AcademyProps) {
  const { profile, entries, route, onNavigate, onPatch, onExit } = props
  // The entries array is rebuilt on every render; its CONTENT is the real
  // dependency, so the key drives the effect and the ref carries the values.
  const entriesKey = entries.map((e) => `${e.subject}@${e.level}`).join(',')
  const [loadState, setLoadState] = useState<ProgramLoadState>({
    entriesKey,
    status: 'loading',
  })
  const entriesRef = useRef(entries)
  entriesRef.current = entries

  useEffect(() => {
    let current = true
    const requestedKey = entriesKey
    setLoadState({ entriesKey: requestedKey, status: 'loading' })
    loadProgram(entriesRef.current)
      .then((composed) => {
        if (current) {
          setLoadState({ entriesKey: requestedKey, status: 'ready', program: composed })
        }
      })
      .catch(() => {
        if (current) {
          setLoadState({
            entriesKey: requestedKey,
            status: 'error',
            message: "Academy courses couldn't load right now. Ask a grown-up for help.",
          })
        }
      })
    return () => {
      current = false
    }
  }, [entriesKey])

  // A resolved program belongs only to the exact entry set that requested it.
  // Treat an older result as loading during the render before the effect above
  // starts the replacement request, so removed courses cannot authorize a child.
  const currentLoadState: ProgramLoadState = loadState.entriesKey === entriesKey
    ? loadState
    : { entriesKey, status: 'loading' }
  const program = currentLoadState.status === 'ready' ? currentLoadState.program : null
  const loadError = currentLoadState.status === 'error' ? currentLoadState.message : null
  const catalog = program?.catalog ?? null
  const schedule = program?.schedule ?? null
  const routeIsAvailable = catalog !== null && routeAvailable(catalog, route)

  // Enrollment mirrors the program's course list. It re-runs when a parent
  // changes a working level (the course set changes), and enrollInCatalog
  // preserves existing lesson state, so no completed work is ever lost.
  const enrolledIds = profile.academy?.courseIds
  const desiredKey = catalog?.courses.map((c) => c.courseId).sort().join(',') ?? null
  const enrolledKey = enrolledIds ? [...enrolledIds].sort().join(',') : null
  const inSync = catalog !== null && desiredKey === enrolledKey && profile.academy?.grade === catalog.grade
  useEffect(() => {
    if (!catalog || !routeIsAvailable || inSync || catalog.courses.length === 0) return
    const now = new Date().toISOString()
    onPatch((prev) => enrollInCatalog(prev, catalog, now))
  }, [catalog, inSync, onPatch, routeIsAvailable])

  if (loadError) {
    if (route.kind === 'home') {
      return (
        <StudentDashboard
          profile={profile}
          catalog={EMPTY_DASHBOARD_CATALOG}
          schedule={EMPTY_DASHBOARD_SCHEDULE}
          levelOf={{}}
          schoolYear={props.schoolYear}
          academyStatus="error"
          academyNotice={loadError}
          onNavigate={onNavigate}
          onExit={onExit}
          dashboard={props.dashboard}
        />
      )
    }
    return (
      <AcademyShell title="Manuel Academy" onExit={onExit}>
        <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 font-semibold">
          {loadError}
        </p>
      </AcademyShell>
    )
  }
  if (!catalog || !schedule || !program) {
    if (route.kind === 'home') {
      return (
        <StudentDashboard
          profile={profile}
          catalog={EMPTY_DASHBOARD_CATALOG}
          schedule={EMPTY_DASHBOARD_SCHEDULE}
          levelOf={{}}
          schoolYear={props.schoolYear}
          academyStatus="loading"
          onNavigate={onNavigate}
          onExit={onExit}
          dashboard={props.dashboard}
        />
      )
    }
    return (
      <AcademyShell title="Manuel Academy" onExit={onExit}>
        <p role="status" className="font-semibold text-slate-500">
          Loading your courses…
        </p>
      </AcademyShell>
    )
  }

  // The dashboard shell is universal, but deep content remains program-bound.
  // Reject unavailable targets here, before their components mount and before
  // loadUnit/startLesson can run.
  if (!routeIsAvailable) {
    return (
      <MissingContent
        onBack={() => onNavigate({ kind: 'home' })}
        label={unavailableRouteLabel(route)}
      />
    )
  }

  // A zero-entry program intentionally has no AcademyState. Home still renders
  // against its empty catalog/schedule; authorized deep routes wait for the
  // existing enrollment reconciliation before mounting stateful content.
  if (route.kind !== 'home' && route.kind !== 'schedule' && !inSync) {
    return <LoadingShell onBack={() => onNavigate({ kind: 'home' })} />
  }

  const shared = {
    profile,
    catalog,
    schedule,
    levelOf: program.levelOf,
    onNavigate,
    onPatch,
    onOpenStudy: props.onOpenStudy,
    onExit,
    schoolYear: props.schoolYear,
  }
  switch (route.kind) {
    case 'home':
      return <StudentDashboard {...shared} dashboard={props.dashboard} />
    case 'schedule':
      return <AcademyScheduleView {...shared} />
    case 'course':
      return <AcademyCourseView {...shared} courseId={route.courseId} />
    case 'unit':
      return <AcademyUnitView {...shared} courseId={route.courseId} unitNumber={route.unitNumber} />
    case 'assessment':
      return (
        <AcademyAssessmentView {...shared} courseId={route.courseId} unitNumber={route.unitNumber} />
      )
    case 'lesson':
      return (
        <AcademyLessonView
          {...shared}
          courseId={route.courseId}
          unitNumber={route.unitNumber}
          lessonId={route.lessonId}
        />
      )
  }
}

// ---------- shared shell ----------

function AcademyShell({
  title,
  onExit,
  exitLabel = 'Back home',
  children,
}: {
  title: string
  onExit: () => void
  exitLabel?: string
  children: React.ReactNode
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    headingRef.current?.focus()
  }, [title])
  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-6">
      <div className="mx-auto w-full max-w-3xl">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold sm:text-3xl">
            {title}
          </h1>
          <button
            onClick={onExit}
            className="min-h-11 rounded-lg border border-slate-400 bg-white px-4 py-2 font-bold hover:border-slate-600"
          >
            {exitLabel}
          </button>
        </header>
        <div className="mt-4">{children}</div>
      </div>
    </main>
  )
}

interface SharedViewProps {
  profile: Profile
  catalog: AcademyCatalog
  schedule: AcademySchedule
  /** courseId → the academy level it came from (courses may span levels). */
  levelOf: Record<string, AcademyGrade>
  schoolYear: SchoolYear | undefined
  onNavigate: (route: AcademyRoute) => void
  onPatch: (update: (prev: Profile) => Profile) => void
  onOpenStudy?: (context: AcademyStudyContext) => void
  onExit: () => void
}

const courseLabel = (course: AcademyCatalogCourse) =>
  ACADEMY_SUBJECT_LABELS[course.subject] ?? 'Academy course'

/** Subject plus the level it is served at — the girl always sees which level a
 * course is, because in a decoupled program they are no longer all the same. */
const courseLevelLabel = (
  course: AcademyCatalogCourse,
  levelOf: Record<string, AcademyGrade>,
) => {
  const level = levelOf[course.courseId]
  return level ? `${courseLabel(course)} · Grade ${level}` : courseLabel(course)
}

// ---------- year schedule (36 weeks) ----------

function AcademyScheduleView({ profile, catalog, schedule, schoolYear, onNavigate }: SharedViewProps) {
  const today = isoToday()
  const currentWeek = isSchoolYearConfigured(schoolYear) ? derivedScopeWeek(schoolYear, today) : 1
  const weeks = new Map<number, { day: number; lessons: { lessonId: string; title: string }[] }[]>()
  for (const d of schedule.days) {
    if (!weeks.has(d.week)) weeks.set(d.week, [])
    weeks.get(d.week)!.push(d)
  }
  const doneCount = (lessons: { lessonId: string }[]) =>
    lessons.filter((l) => profile.academy?.lessons[l.lessonId]?.status === 'complete').length
  return (
    <AcademyShell
      title="Year schedule"
      onExit={() => onNavigate({ kind: 'home' })}
      exitLabel="Back to Academy"
    >
      <p className="text-sm font-semibold text-slate-500">
        36 weeks, Monday–Friday. This week: week {currentWeek}.
      </p>
      <ol className="mt-3 space-y-2">
        {[...weeks.entries()]
          .sort(([a], [b]) => a - b)
          .map(([week, days]) => {
            const total = days.reduce((n, d) => n + d.lessons.length, 0)
            const done = days.reduce((n, d) => n + doneCount(d.lessons), 0)
            return (
              <li
                key={week}
                className={`rounded-xl border p-3 ${
                  week === currentWeek ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 bg-white'
                }`}
              >
                <span className="font-extrabold">Week {week}</span>{' '}
                <span className="text-sm font-semibold text-slate-500">
                  {done}/{total} lessons done
                </span>
              </li>
            )
          })}
      </ol>
    </AcademyShell>
  )
}

// ---------- course → units ----------

function AcademyCourseView({
  profile,
  catalog,
  levelOf,
  schoolYear,
  onNavigate,
  courseId,
}: SharedViewProps & { courseId: string }) {
  const course = catalog.courses.find((c) => c.courseId === courseId)
  if (!course) {
    return <MissingContent onBack={() => onNavigate({ kind: 'home' })} label="course" />
  }
  const pointer = schoolYear
    ? resolvePointer(profile, courseId, schoolYear, isoToday())
    : 1
  return (
    <AcademyShell
      title={courseLevelLabel(course, levelOf)}
      onExit={() => onNavigate({ kind: 'home' })}
      exitLabel="Back to Academy"
    >
      <p className="text-sm font-semibold text-slate-500">
        {course.lessonCount} lessons across {course.units.length} units. Pacing week {pointer}.
      </p>
      <ol className="mt-3 space-y-2">
        {course.units.map((unit) => {
          const done = unit.lessonIds.filter(
            (id) => profile.academy?.lessons[id]?.status === 'complete',
          ).length
          return (
            <li key={unit.unitId}>
              <button
                onClick={() =>
                  onNavigate({ kind: 'unit', courseId, unitNumber: unit.unitNumber })
                }
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white p-4 text-left hover:border-cyan-500"
              >
                <span className="block font-extrabold">
                  Unit {unit.unitNumber}: {unit.title}
                </span>
                <span className="block text-sm font-semibold text-slate-500">
                  {done}/{unit.lessonIds.length} lessons done · {unit.days} days
                  {unit.hasAssessment ? ' · has assessment' : ''}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </AcademyShell>
  )
}

// ---------- unit → lessons + assessment ----------

function AcademyUnitView({
  profile,
  catalog,
  onNavigate,
  courseId,
  unitNumber,
}: SharedViewProps & { courseId: string; unitNumber: number }) {
  const [unit, setUnit] = useState<AcademyUnitChunk | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let current = true
    setUnit(null)
    setError(false)
    loadUnit(courseId, unitNumber)
      .then((u) => current && setUnit(u))
      .catch(() => current && setError(true))
    return () => {
      current = false
    }
  }, [courseId, unitNumber])
  const course = catalog.courses.find((c) => c.courseId === courseId)
  if (error || !course) {
    return <MissingContent onBack={() => onNavigate({ kind: 'home' })} label="unit" />
  }
  if (!unit) return <LoadingShell onBack={() => onNavigate({ kind: 'course', courseId })} />
  return (
    <AcademyShell
      title={`Unit ${unit.unit.unit_number}: ${unit.unit.title}`}
      onExit={() => onNavigate({ kind: 'course', courseId })}
      exitLabel="Back to course"
    >
      <p className="font-semibold text-slate-600">{unit.unit.essential_question}</p>
      <p className="mt-2 text-sm font-semibold text-slate-500">
        Unit project: {unit.unit.performance_task}
      </p>
      <ol className="mt-4 space-y-2">
        {unit.lessons.map((lesson) => {
          const state = profile.academy?.lessons[lesson.lesson_id]
          const mastery = masteryOf(state)
          return (
            <li key={lesson.lesson_id}>
              <button
                onClick={() =>
                  onNavigate({
                    kind: 'lesson',
                    courseId,
                    unitNumber,
                    lessonId: lesson.lesson_id,
                  })
                }
                className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-slate-300 bg-white p-3 text-left hover:border-cyan-500"
              >
                <span aria-hidden="true">
                  {state?.status === 'complete' ? '✅' : state?.status === 'reteach' ? '🔁' : state ? '⏸️' : '▫️'}
                </span>
                <span className="flex-1">
                  <span className="block font-bold">
                    Day {lesson.day_in_unit}: {lesson.title}
                  </span>
                  <span className="block text-sm font-semibold text-slate-500">
                    {state?.status === 'reteach'
                      ? 'Reteach — review needed'
                      : state?.status === 'complete'
                        ? mastery === 'mastered'
                          ? 'Done — mastered'
                          : 'Done'
                        : state
                          ? 'In progress — resume'
                          : 'Not started'}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      {unit.assessment && (
        <button
          onClick={() => onNavigate({ kind: 'assessment', courseId, unitNumber })}
          className="mt-4 min-h-11 w-full rounded-xl border border-indigo-300 bg-indigo-50 p-4 text-left font-bold hover:border-indigo-500"
        >
          📋 Unit assessment: {unit.assessment.unit_title}
        </button>
      )}
    </AcademyShell>
  )
}

// ---------- lesson: segments, resume, check for understanding ----------

const requiresAdultAcknowledgement = (lesson: AcademyLesson): boolean =>
  lesson.safety_and_privacy.some((s) => /adult|guardian|grown.?up|supervis|parent/i.test(s))

function AcademyLessonView({
  profile,
  catalog,
  levelOf,
  onNavigate,
  onPatch,
  courseId,
  unitNumber,
  lessonId,
}: SharedViewProps & { courseId: string; unitNumber: number; lessonId: string }) {
  const [unit, setUnit] = useState<AcademyUnitChunk | null>(null)
  const [error, setError] = useState(false)
  const [adultOk, setAdultOk] = useState(false)
  const [checkMode, setCheckMode] = useState<'guided' | 'independent'>('independent')
  useEffect(() => {
    let current = true
    setUnit(null)
    setError(false)
    loadUnit(courseId, unitNumber)
      .then((u) => current && setUnit(u))
      .catch(() => current && setError(true))
    return () => {
      current = false
    }
  }, [courseId, unitNumber])

  const lesson = unit?.lessons.find((l) => l.lesson_id === lessonId)
  const state = profile.academy?.lessons[lessonId]

  // Opening a lesson starts (or resumes) the attempt — never resets progress.
  useEffect(() => {
    if (!lesson || state) return
    const now = new Date().toISOString()
    onPatch((prev) => startLesson(prev, lessonId, now))
  }, [lesson, state, lessonId, onPatch])

  if (error || (unit && !lesson)) {
    return <MissingContent onBack={() => onNavigate({ kind: 'unit', courseId, unitNumber })} label="lesson" />
  }
  if (!unit || !lesson || !state) {
    return <LoadingShell onBack={() => onNavigate({ kind: 'unit', courseId, unitNumber })} />
  }

  const course = catalog.courses.find((c) => c.courseId === courseId)
  const stale = isStaleAttempt(profile, lessonId)
  const segments = lesson.lesson_flow
  const segmentIndex = Math.min(state.segmentIndex, segments.length)
  const allSegmentsDone = segmentIndex >= segments.length
  const needsAdult = requiresAdultAcknowledgement(lesson)
  const mastery = masteryOf(state)
  const nowISO = () => new Date().toISOString()

  const submitCheck = (met: boolean) => {
    onPatch((prev) =>
      state.status === 'reteach'
        ? recordReassessment(prev, lessonId, { date: isoToday(), mode: checkMode, met, now: nowISO() })
        : submitLessonCheck(prev, lessonId, { date: isoToday(), mode: checkMode, met, now: nowISO() }),
    )
  }

  return (
    <AcademyShell
      title={lesson.title}
      onExit={() => onNavigate({ kind: 'unit', courseId, unitNumber })}
      exitLabel="Pause & back"
    >
      <p className="text-sm font-semibold text-slate-500">
        {course ? courseLevelLabel(course, levelOf) : 'Academy course'} · Unit {unitNumber} · Day{' '}
        {lesson.day_in_unit} ·{' '}
        {lesson.estimated_minutes} minutes
      </p>
      <p className="mt-2 font-semibold text-slate-600">{lesson.essential_question}</p>

      <section aria-labelledby="lesson-objectives" className="mt-4">
        <h2 id="lesson-objectives" className="font-extrabold">
          Today you will
        </h2>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm font-semibold text-slate-600">
          {lesson.learning_objectives.map((o, i) => (
            <li key={i}>{o}</li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="lesson-safety"
        className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3"
      >
        <h2 id="lesson-safety" className="font-extrabold text-amber-900">
          Safety &amp; privacy
        </h2>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm font-semibold text-amber-900">
          {lesson.safety_and_privacy.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
        {needsAdult && (
          <label className="mt-2 flex min-h-11 items-center gap-2 font-bold text-amber-900">
            <input
              type="checkbox"
              checked={adultOk}
              onChange={(e) => setAdultOk(e.target.checked)}
              className="h-5 w-5"
            />
            A grown-up knows I&apos;m doing this lesson
          </label>
        )}
      </section>

      {stale && (
        <div role="alert" className="mt-4 rounded-xl border border-amber-400 bg-amber-50 p-3 font-semibold">
          This lesson was started with a different curriculum version. Restart it to continue.
          <button
            onClick={() => onPatch((prev) => reopenLesson(prev, lessonId, 0))}
            className="ml-3 min-h-11 rounded-lg border border-amber-500 bg-white px-3 py-1 font-bold"
          >
            Restart lesson
          </button>
        </div>
      )}

      {!stale && (
        <>
          <section aria-labelledby="lesson-steps" className="mt-4">
            <h2 id="lesson-steps" className="font-extrabold">
              Lesson steps
            </h2>
            <ol className="mt-2 space-y-2">
              {segments.map((seg, i) => {
                const done = i < segmentIndex
                const isCurrent = i === segmentIndex
                return (
                  <li
                    key={i}
                    className={`rounded-xl border p-3 ${
                      isCurrent
                        ? 'border-cyan-500 bg-cyan-50'
                        : done
                          ? 'border-emerald-200 bg-emerald-50'
                          : 'border-slate-200 bg-white'
                    }`}
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    <p className="font-bold">
                      {done ? '✅ ' : ''}
                      {seg.segment}{' '}
                      <span className="text-sm font-semibold text-slate-500">({seg.minutes} min)</span>
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-600">
                      {seg.teacher_or_tutor_action}
                    </p>
                    {isCurrent && (
                      <button
                        onClick={() => onPatch((prev) => completeSegment(prev, lessonId, i))}
                        className="mt-2 min-h-11 rounded-lg border border-cyan-600 bg-white px-4 py-2 font-bold hover:bg-cyan-100"
                      >
                        Done with this step
                      </button>
                    )}
                  </li>
                )
              })}
            </ol>
            {!allSegmentsDone && (
              <p className="mt-2 text-sm font-semibold text-slate-500">
                You can leave anytime — the lesson resumes right here.
              </p>
            )}
          </section>

          {allSegmentsDone && (
            <section
              aria-labelledby="lesson-check"
              className="mt-4 rounded-xl border border-indigo-300 bg-indigo-50 p-4"
            >
              <h2 id="lesson-check" className="font-extrabold text-indigo-900">
                Check for understanding
              </h2>
              <p className="mt-1 font-semibold text-indigo-900">{lesson.formative_check}</p>
              <p className="mt-2 text-sm font-semibold text-indigo-800">
                Success looks like: {lesson.success_criteria.join(' ')}
              </p>
              {state.status === 'complete' ? (
                <div className="mt-3 font-bold text-emerald-700" role="status">
                  ✅ Lesson complete{mastery === 'mastered' ? ' — mastered over multiple days' : ''}.
                  {(state.revisits ?? 0) > 0 && (
                    <span className="block text-sm font-semibold text-slate-600">
                      Revisited {state.revisits} time{state.revisits === 1 ? '' : 's'} — your first
                      completion is what counts.
                    </span>
                  )}
                  <button
                    onClick={() => onPatch((prev) => reopenLesson(prev, lessonId, 0))}
                    className="mt-2 block min-h-11 rounded-lg border border-slate-400 bg-white px-4 py-2 font-bold text-slate-700"
                  >
                    Revisit lesson
                  </button>
                </div>
              ) : (
                <fieldset className="mt-3">
                  <legend className="font-bold text-indigo-900">How did it go?</legend>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <label className="flex min-h-11 items-center gap-2 font-semibold">
                      <input
                        type="radio"
                        name="check-mode"
                        checked={checkMode === 'independent'}
                        onChange={() => setCheckMode('independent')}
                      />
                      I did it on my own
                    </label>
                    <label className="flex min-h-11 items-center gap-2 font-semibold">
                      <input
                        type="radio"
                        name="check-mode"
                        checked={checkMode === 'guided'}
                        onChange={() => setCheckMode('guided')}
                      />
                      I had help
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      onClick={() => submitCheck(true)}
                      disabled={needsAdult && !adultOk}
                      className="min-h-11 rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      I met the success criteria
                    </button>
                    <button
                      onClick={() => submitCheck(false)}
                      disabled={needsAdult && !adultOk}
                      className="min-h-11 rounded-lg border border-slate-400 bg-white px-4 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Not yet — plan a reteach
                    </button>
                  </div>
                  {needsAdult && !adultOk && (
                    <p className="mt-2 text-sm font-bold text-amber-900">
                      Check the safety box above first.
                    </p>
                  )}
                  {state.status === 'reteach' && (
                    <p className="mt-2 text-sm font-bold text-indigo-900" role="status">
                      This is a fresh try after reteaching — new evidence, new day.
                    </p>
                  )}
                </fieldset>
              )}
            </section>
          )}

          {lesson.home_connection && (
            <p className="mt-4 text-sm font-semibold text-slate-500">
              Home connection: {lesson.home_connection}
            </p>
          )}
        </>
      )}
    </AcademyShell>
  )
}

// ---------- unit assessment (prompts only; scoring is a Grown-Ups job) ----------

function AcademyAssessmentView({
  profile,
  onNavigate,
  courseId,
  unitNumber,
}: SharedViewProps & { courseId: string; unitNumber: number }) {
  const [unit, setUnit] = useState<AcademyUnitChunk | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let current = true
    loadUnit(courseId, unitNumber)
      .then((u) => current && setUnit(u))
      .catch(() => current && setError(true))
    return () => {
      current = false
    }
  }, [courseId, unitNumber])
  if (error || (unit && !unit.assessment)) {
    return <MissingContent onBack={() => onNavigate({ kind: 'unit', courseId, unitNumber })} label="assessment" />
  }
  if (!unit) return <LoadingShell onBack={() => onNavigate({ kind: 'unit', courseId, unitNumber })} />
  const assessment = unit.assessment!
  const latest = latestAssessmentAttempt(profile, assessment.assessment_id)
  return (
    <AcademyShell
      title={`Assessment — ${assessment.unit_title}`}
      onExit={() => onNavigate({ kind: 'unit', courseId, unitNumber })}
      exitLabel="Back to unit"
    >
      <p className="text-sm font-semibold text-slate-500">
        {assessment.total_points} points. Work through each prompt on paper or in your notebook; a
        grown-up scores it from the Grown-Ups hub.
      </p>
      {latest && (
        <p role="status" className="mt-2 rounded-xl border border-slate-300 bg-white p-3 font-bold">
          Last result: {latest.percent}% —{' '}
          {latest.outcome === 'secure'
            ? 'secure ✅'
            : latest.outcome === 'developing'
              ? 'developing — targeted review, then a fresh check'
              : 'not yet — reteach the smallest gap, then reassess'}
        </p>
      )}
      <ol className="mt-4 space-y-3">
        {assessment.prompts.map((prompt, i) => (
          <li key={i} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-400">
              {prompt.type} · {prompt.points} pts
            </p>
            <p className="mt-1 font-semibold">{prompt.prompt}</p>
          </li>
        ))}
      </ol>
    </AcademyShell>
  )
}

// ---------- small shared bits ----------

function LoadingShell({ onBack }: { onBack: () => void }) {
  return (
    <AcademyShell title="Manuel Academy" onExit={onBack} exitLabel="Back">
      <p role="status" className="font-semibold text-slate-500">
        Loading…
      </p>
    </AcademyShell>
  )
}

const MISSING_CONTENT_COPY = {
  course: "This course isn't available. Go back to Academy and ask a grown-up for help if it keeps happening.",
  unit: "This unit isn't available. Go back to Academy and ask a grown-up for help if it keeps happening.",
  lesson: "This lesson isn't available. Go back to the unit and ask a grown-up for help if it keeps happening.",
  assessment: "This assessment isn't available. Go back to the unit and ask a grown-up for help if it keeps happening.",
} as const

function MissingContent({ onBack, label }: { onBack: () => void; label: keyof typeof MISSING_CONTENT_COPY }) {
  return (
    <AcademyShell title="Manuel Academy" onExit={onBack} exitLabel="Back">
      <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 font-semibold">
        {MISSING_CONTENT_COPY[label]}
      </p>
    </AcademyShell>
  )
}
