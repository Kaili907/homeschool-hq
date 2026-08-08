import { useEffect, useRef } from 'react'
import type { AcademyGrade, Profile, SchoolYear } from '../../../types'
import type { AcademyRoute } from '../../../academy/academyRoute'
import {
  ACADEMY_SUBJECT_LABELS,
  type AcademyCatalog,
  type AcademyCatalogCourse,
  type AcademySchedule,
} from '../../../academy/contentTypes'
import { courseProgress } from '../../../academy/academyState'
import {
  buildStudentDashboardData,
  dashboardLessonRoute,
  type DashboardCalendarState,
  type DashboardLesson,
  type DashboardLessonStatus,
} from './dashboardData'
import './studentDashboard.css'

interface StudentDashboardProps {
  profile: Profile
  catalog: AcademyCatalog
  schedule: AcademySchedule
  levelOf: Record<string, AcademyGrade>
  schoolYear: SchoolYear | undefined
  /** Test-only override; production uses the local Academy date helper. */
  today?: string
  onNavigate: (route: AcademyRoute) => void
  onExit: () => void
}

const STATUS_COPY: Record<DashboardLessonStatus, string> = {
  complete: 'Complete',
  'in-progress': 'In progress',
  'not-started': 'Not started',
  'ready-to-retry': 'Review needed',
}

const STATUS_MARK: Record<DashboardLessonStatus, string> = {
  complete: '✓',
  'in-progress': '↗',
  'not-started': '○',
  'ready-to-retry': '↺',
}

function lessonStatusCopy(lesson: DashboardLesson) {
  return lesson.requiresRestart ? 'Curriculum version changed — restart required' : STATUS_COPY[lesson.status]
}

function lessonStatusMark(lesson: DashboardLesson) {
  return lesson.requiresRestart ? '↻' : STATUS_MARK[lesson.status]
}

function courseLabel(course: AcademyCatalogCourse) {
  return ACADEMY_SUBJECT_LABELS[course.subject] ?? 'Academy course'
}

function courseLevelLabel(course: AcademyCatalogCourse, levelOf: Record<string, AcademyGrade>) {
  const level = levelOf[course.courseId]
  return level ? `${courseLabel(course)} · Grade ${level}` : courseLabel(course)
}

function lessonContext(lesson: DashboardLesson) {
  if (!lesson.course) return 'Academy course'
  const level = lesson.level ? ` · Grade ${lesson.level}` : ''
  return `${courseLabel(lesson.course)}${level}`
}

function JarvisCore() {
  return (
    <div className="student-dashboard__jarvis-core" aria-hidden="true">
      <span className="student-dashboard__jarvis-ambient-halo" />
      <span className="student-dashboard__jarvis-outer-detail" />
      <span className="student-dashboard__jarvis-secondary-orbit" />
      <span className="student-dashboard__jarvis-primary-ring" />
      <span className="student-dashboard__jarvis-nucleus">
        <span className="student-dashboard__jarvis-monogram">M</span>
      </span>
    </div>
  )
}

function JarvisPanel() {
  return (
    <aside className="student-dashboard__jarvis panel-glass" aria-labelledby="jarvis-heading">
      <div className="jarvis-panel__heading">
        <div>
          <p className="eyebrow">Academy display</p>
          <h2 id="jarvis-heading">Jarvis</h2>
        </div>
        <span className="jarvis-panel__state">Visual only</span>
      </div>
      <JarvisCore />
      <p className="jarvis-panel__copy">Jarvis is a visual part of your Academy dashboard. It does not listen or answer questions.</p>
    </aside>
  )
}

function UpNextCard({
  lesson,
  isReference,
  onNavigate,
}: {
  lesson: DashboardLesson
  isReference: boolean
  onNavigate: StudentDashboardProps['onNavigate']
}) {
  const route = dashboardLessonRoute(lesson)
  const buttonLabel = isReference
    ? 'Open lesson'
    : lesson.requiresRestart
      ? 'Open lesson'
      : lesson.status === 'in-progress'
        ? 'Continue lesson'
        : lesson.status === 'ready-to-retry'
          ? 'Open lesson'
          : 'Start lesson'
  const statusCopy = lessonStatusCopy(lesson)
  const context = lessonContext(lesson)
  return (
    <section
      className={`up-next-card${isReference ? ' up-next-card--reference' : ''}`}
      aria-label={`${isReference ? 'Reference lesson' : 'Up next'}: ${lesson.title}, ${context}, ${statusCopy}`}
    >
      <div className="up-next-card__glow" aria-hidden="true" />
      <p className="eyebrow">{isReference ? 'Reference lesson' : 'Up next'}</p>
      <h2 id="up-next-heading">{lesson.title}</h2>
      <p className="up-next-card__context">{context}</p>
      <p className="up-next-card__status"><span aria-hidden="true">{lessonStatusMark(lesson)}</span> {statusCopy}</p>
      {route ? (
        <button className={isReference ? 'button-secondary' : 'button-primary'} onClick={() => onNavigate(route)} aria-label={`${buttonLabel}: ${lesson.title}, ${context}, ${statusCopy}`}>
          {buttonLabel}<span aria-hidden="true">→</span>
        </button>
      ) : (
        <p className="up-next-card__unavailable" role="status">This lesson can&apos;t be opened from the schedule. Ask a grown-up for help.</p>
      )}
    </section>
  )
}

function RestartRequiredCard({
  lesson,
  isReference,
  onNavigate,
}: {
  lesson: DashboardLesson
  isReference: boolean
  onNavigate: StudentDashboardProps['onNavigate']
}) {
  const route = dashboardLessonRoute(lesson)
  const context = lessonContext(lesson)
  const statusCopy = lessonStatusCopy(lesson)
  return (
    <section
      className={`up-next-card${isReference ? ' up-next-card--reference' : ''}`}
      aria-label={isReference ? `Reference lesson: ${lesson.title}, ${context}, ${statusCopy}` : undefined}
      aria-labelledby={isReference ? undefined : 'restart-required-heading'}
    >
      <div className="up-next-card__glow" aria-hidden="true" />
      <p className="eyebrow">{isReference ? 'Reference lesson' : 'Scheduled Academy lesson'}</p>
      <h2 id="restart-required-heading">{lesson.title}</h2>
      <p className="up-next-card__context">{context}</p>
      <p className="up-next-card__status"><span aria-hidden="true">↻</span> {statusCopy}</p>
      <p className="up-next-card__explanation">This lesson was started with a different curriculum version.</p>
      {route ? (
        <button className={isReference ? 'button-secondary' : 'button-primary'} onClick={() => onNavigate(route)} aria-label={`Open lesson: ${lesson.title}, ${context}${isReference ? `, ${statusCopy}` : ''}`}>
          Open lesson<span aria-hidden="true">→</span>
        </button>
      ) : (
        <p className="up-next-card__unavailable" role="status">This lesson can&apos;t be opened from the schedule. Ask a grown-up for help.</p>
      )}
    </section>
  )
}

function timelineHeading(calendarState: DashboardCalendarState) {
  if (calendarState === 'unconfigured') return { eyebrow: 'Week 1 preview', heading: 'Week 1 schedule' }
  if (calendarState === 'off-week') return { eyebrow: 'This week is marked off', heading: 'Current Academy schedule' }
  if (calendarState === 'after-year') return { eyebrow: 'Available for reference', heading: 'Final Academy schedule' }
  return { eyebrow: "Today's sequence", heading: 'Your learning plan' }
}

function TodayTimeline({ lessons, calendarState, onNavigate }: { lessons: readonly DashboardLesson[]; calendarState: DashboardCalendarState; onNavigate: StudentDashboardProps['onNavigate'] }) {
  const copy = timelineHeading(calendarState)
  return (
    <section className="today-panel panel-glass" aria-labelledby="today-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2 id="today-heading">{copy.heading}</h2>
        </div>
        <span className="section-heading__count">{lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'}</span>
      </div>
      <ol className="today-timeline">
        {lessons.map((lesson, index) => {
          const route = dashboardLessonRoute(lesson)
          const statusCopy = lessonStatusCopy(lesson)
          const statusClass = lesson.requiresRestart ? 'restart-required' : lesson.status
          const contents = (
            <>
              <span className={`timeline-status timeline-status--${statusClass}`} aria-hidden="true">{lessonStatusMark(lesson)}</span>
              <span className="timeline-item__copy">
                <strong>{lesson.title}</strong>
                <span>{lessonContext(lesson)}</span>
              </span>
              <span className="timeline-item__state">{statusCopy}</span>
              {route && <span className="timeline-item__arrow" aria-hidden="true">→</span>}
            </>
          )
          return (
            <li key={lesson.lessonId} className="timeline-item">
              <span className="timeline-item__number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              {route ? (
                <button onClick={() => onNavigate(route)} aria-label={`${lesson.title}, ${lessonContext(lesson)}, ${statusCopy}`}>{contents}</button>
              ) : <div>{contents}</div>}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function CompletionState({ completedCount, total, calendarState }: { completedCount: number; total: number; calendarState: DashboardCalendarState }) {
  const todaySpecific = calendarState === 'normal-weekday'
  return (
    <section className="completion-state panel-glass" role="status" aria-labelledby="complete-heading">
      <span className="completion-state__mark" aria-hidden="true">✓</span>
      <div>
        <p className="eyebrow">{todaySpecific ? "Today's Academy plan" : 'Academy schedule'}</p>
        <h2 id="complete-heading">{todaySpecific ? "Today's scheduled Academy lessons are complete." : 'All lessons shown here are complete.'}</h2>
        <p>{completedCount} of {total} scheduled {total === 1 ? 'lesson is' : 'lessons are'} complete.</p>
      </div>
    </section>
  )
}

function noWorkCopy(calendarState: DashboardCalendarState, week: number) {
  if (calendarState === 'weekend') return {
    eyebrow: 'Weekend',
    heading: 'No Academy lessons scheduled this weekend.',
    body: 'Academy lessons are scheduled Monday through Friday.',
  }
  if (calendarState === 'unconfigured') return {
    eyebrow: 'Week 1 preview',
    heading: 'No lessons are shown in the Week 1 preview.',
    body: 'A grown-up needs to set the school-year start date. Week 1 is shown for reference.',
  }
  if (calendarState === 'before-year') return {
    eyebrow: 'Before Week 1',
    heading: "Your first Academy week hasn't begun.",
    body: 'Academy lessons will appear when Week 1 begins.',
  }
  if (calendarState === 'off-week') return {
    eyebrow: 'Current Academy schedule',
    heading: 'This week is marked off.',
    body: week > 0 ? `The Week ${week} schedule remains available.` : 'The Academy schedule remains available.',
  }
  if (calendarState === 'after-year') return {
    eyebrow: 'Final Academy schedule',
    heading: 'The final Academy week has passed.',
    body: `Week ${week} remains available for reference.`,
  }
  return {
    eyebrow: "Today's plan",
    heading: 'No lessons scheduled today',
    body: "There's nothing assigned in your Academy schedule for today.",
  }
}

function NoWorkState({ calendarState, week, onNavigate }: Pick<StudentDashboardProps, 'onNavigate'> & { calendarState: DashboardCalendarState; week: number }) {
  const copy = noWorkCopy(calendarState, week)
  return (
    <section className="no-work-state panel-glass" aria-labelledby="no-work-heading">
      <span className="no-work-state__mark" aria-hidden="true">☼</span>
      <div>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h2 id="no-work-heading">{copy.heading}</h2>
        <p>{copy.body}</p>
      </div>
      <button className="button-secondary" onClick={() => onNavigate({ kind: 'schedule' })}>View year schedule</button>
    </section>
  )
}

function CourseProgressGrid({ profile, catalog, levelOf, onNavigate }: Pick<StudentDashboardProps, 'profile' | 'catalog' | 'levelOf' | 'onNavigate'>) {
  const progressByCourse = new Map(courseProgress(profile, catalog).map((item) => [item.courseId, item]))
  return (
    <section className="courses-panel" aria-labelledby="courses-heading">
      <div className="section-heading"><div><p className="eyebrow">Your courses</p><h2 id="courses-heading">Keep building</h2></div></div>
      <ul className="course-grid">
        {catalog.courses.map((course) => {
          const progress = progressByCourse.get(course.courseId)
          const completed = progress?.completed ?? 0
          const percent = course.lessonCount > 0 ? Math.round((completed / course.lessonCount) * 100) : 0
          return (
            <li key={course.courseId}>
              <button onClick={() => onNavigate({ kind: 'course', courseId: course.courseId })}>
                <span className="course-card__topline"><span>Course</span><span>{percent}% complete</span></span>
                <strong>{courseLevelLabel(course, levelOf)}</strong>
                <span className="course-card__meter" aria-hidden="true">
                  <span style={{ width: `${percent}%`, minWidth: percent === 0 ? 0 : undefined }} />
                </span>
                <span className="course-card__progress">{completed} of {course.lessonCount} lessons complete</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function StudentDashboard({ profile, catalog, schedule, levelOf, schoolYear, today, onNavigate, onExit }: StudentDashboardProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { headingRef.current?.focus() }, [])
  const data = buildStudentDashboardData({ profile, catalog, schedule, levelOf, schoolYear, today })
  const isReferenceSchedule = data.calendarState === 'off-week' || data.calendarState === 'after-year'
  const firstName = profile.name.trim().split(/\s+/)[0] || 'Learner'
  const intro = data.calendarState === 'weekend'
    ? { eyebrow: 'Weekend', heading: 'No Academy lessons scheduled this weekend.', detail: 'Academy lessons are scheduled Monday through Friday.' }
    : data.calendarState === 'unconfigured'
      ? { eyebrow: 'Week 1 preview', heading: 'Week 1 preview', detail: 'A grown-up needs to set the school-year start date. Week 1 is shown for reference.' }
      : data.calendarState === 'before-year'
        ? { eyebrow: 'Before Week 1', heading: "Your first Academy week hasn't begun.", detail: '' }
        : data.calendarState === 'off-week'
          ? { eyebrow: 'Current Academy schedule', heading: 'This week is marked off.', detail: data.week > 0 ? `The Week ${data.week} schedule remains available.` : 'The Academy schedule remains available.' }
          : data.calendarState === 'after-year'
            ? { eyebrow: 'Final Academy schedule', heading: 'The final Academy week has passed.', detail: `Week ${data.week} remains available for reference.` }
            : { eyebrow: "Today's Academy plan", heading: `Week ${data.week}`, detail: data.hasScheduledWork ? `${data.completedCount} of ${data.lessons.length} complete today` : '' }

  return (
    <main className="student-dashboard">
      <div className="student-dashboard__ambient student-dashboard__ambient--one" aria-hidden="true" />
      <div className="student-dashboard__ambient student-dashboard__ambient--two" aria-hidden="true" />
      <div className="student-dashboard__shell">
        <header className="student-topbar">
          <div className="student-topbar__identity">
            <span className="student-topbar__mark" aria-hidden="true">M</span>
            <div><p>Manuel Academy</p><h1 ref={headingRef} tabIndex={-1}>Hello, {firstName}</h1></div>
          </div>
          <nav className="student-topbar__nav" aria-label="Academy navigation">
            <button onClick={() => onNavigate({ kind: 'schedule' })}>Year schedule</button>
            <button className="student-topbar__exit" onClick={onExit}>Back home</button>
          </nav>
        </header>

        <div className="student-dashboard__intro">
          <div><p className="eyebrow">{intro.eyebrow}</p><p className="student-dashboard__week">{intro.heading}</p></div>
          {intro.detail && <p className="student-dashboard__completion">{intro.detail}</p>}
        </div>

        <div className="student-dashboard__primary-grid">
          <div className="student-dashboard__daily-area">
            {data.upNext && !data.allWorkComplete ? <UpNextCard lesson={data.upNext} isReference={isReferenceSchedule} onNavigate={onNavigate} />
              : data.restartRequiredLesson ? <RestartRequiredCard lesson={data.restartRequiredLesson} isReference={isReferenceSchedule} onNavigate={onNavigate} />
              : data.allWorkComplete ? <CompletionState completedCount={data.completedCount} total={data.lessons.length} calendarState={data.calendarState} />
                : <NoWorkState calendarState={data.calendarState} week={data.week} onNavigate={onNavigate} />}
            {data.hasScheduledWork && <TodayTimeline lessons={data.lessons} calendarState={data.calendarState} onNavigate={onNavigate} />}
          </div>
          <JarvisPanel />
        </div>
        <CourseProgressGrid profile={profile} catalog={catalog} levelOf={levelOf} onNavigate={onNavigate} />
      </div>
    </main>
  )
}
