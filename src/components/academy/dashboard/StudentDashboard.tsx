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
  'ready-to-revisit': 'Ready to revisit',
}

const STATUS_MARK: Record<DashboardLessonStatus, string> = {
  complete: '✓',
  'in-progress': '↗',
  'not-started': '○',
  'ready-to-revisit': '↺',
}

function courseLabel(course: AcademyCatalogCourse) {
  return ACADEMY_SUBJECT_LABELS[course.subject] ?? course.subject
}

function courseLevelLabel(course: AcademyCatalogCourse, levelOf: Record<string, AcademyGrade>) {
  const level = levelOf[course.courseId]
  return level ? `${courseLabel(course)} · Grade ${level}` : courseLabel(course)
}

function lessonContext(lesson: DashboardLesson) {
  if (!lesson.course) return lesson.lessonId
  const level = lesson.level ? ` · Grade ${lesson.level}` : ''
  return `${courseLabel(lesson.course)}${level}`
}

function JarvisCore() {
  return (
    <div className="jarvis-core" aria-hidden="true">
      <span className="jarvis-core__halo jarvis-core__halo--outer" />
      <span className="jarvis-core__halo jarvis-core__halo--middle" />
      <span className="jarvis-core__halo jarvis-core__halo--inner" />
      <span className="jarvis-core__axis jarvis-core__axis--one" />
      <span className="jarvis-core__axis jarvis-core__axis--two" />
      <span className="jarvis-core__center"><span /></span>
    </div>
  )
}

function JarvisPanel() {
  return (
    <aside className="student-dashboard__jarvis panel-glass" aria-labelledby="jarvis-heading">
      <div className="jarvis-panel__heading">
        <div>
          <p className="eyebrow">Manuel Academy guide</p>
          <h2 id="jarvis-heading">Jarvis</h2>
        </div>
        <span className="jarvis-panel__state">Visual foundation</span>
      </div>
      <JarvisCore />
      <p className="jarvis-panel__copy">Jarvis is not available for conversations on this dashboard yet.</p>
    </aside>
  )
}

function UpNextCard({ lesson, onNavigate }: { lesson: DashboardLesson; onNavigate: StudentDashboardProps['onNavigate'] }) {
  const route = dashboardLessonRoute(lesson)
  const buttonLabel = lesson.status === 'in-progress' ? 'Continue lesson' : 'Start lesson'
  return (
    <section className="up-next-card" aria-labelledby="up-next-heading">
      <div className="up-next-card__glow" aria-hidden="true" />
      <p className="eyebrow">Up next</p>
      <h2 id="up-next-heading">{lesson.title}</h2>
      <p className="up-next-card__context">{lessonContext(lesson)}</p>
      <p className="up-next-card__status"><span aria-hidden="true">{STATUS_MARK[lesson.status]}</span> {STATUS_COPY[lesson.status]}</p>
      {route ? (
        <button className="button-primary" onClick={() => onNavigate(route)}>
          {buttonLabel}<span aria-hidden="true">→</span>
        </button>
      ) : (
        <p className="up-next-card__unavailable" role="status">This scheduled lesson is not available to open.</p>
      )}
    </section>
  )
}

function TodayTimeline({ lessons, onNavigate }: { lessons: readonly DashboardLesson[]; onNavigate: StudentDashboardProps['onNavigate'] }) {
  return (
    <section className="today-panel panel-glass" aria-labelledby="today-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Today&apos;s sequence</p>
          <h2 id="today-heading">Your learning plan</h2>
        </div>
        <span className="section-heading__count">{lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'}</span>
      </div>
      <ol className="today-timeline">
        {lessons.map((lesson, index) => {
          const route = dashboardLessonRoute(lesson)
          const contents = (
            <>
              <span className={`timeline-status timeline-status--${lesson.status}`} aria-hidden="true">{STATUS_MARK[lesson.status]}</span>
              <span className="timeline-item__copy">
                <strong>{lesson.title}</strong>
                <span>{lessonContext(lesson)}</span>
              </span>
              <span className="timeline-item__state">{STATUS_COPY[lesson.status]}</span>
              {route && <span className="timeline-item__arrow" aria-hidden="true">→</span>}
            </>
          )
          return (
            <li key={lesson.lessonId} className="timeline-item">
              <span className="timeline-item__number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              {route ? (
                <button onClick={() => onNavigate(route)} aria-label={`${lesson.title}, ${STATUS_COPY[lesson.status]}`}>{contents}</button>
              ) : <div>{contents}</div>}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function CompletionState({ completedCount, total }: { completedCount: number; total: number }) {
  return (
    <section className="completion-state panel-glass" role="status" aria-labelledby="complete-heading">
      <span className="completion-state__mark" aria-hidden="true">✓</span>
      <div>
        <p className="eyebrow">Today&apos;s work</p>
        <h2 id="complete-heading">You&apos;re done for today</h2>
        <p>{completedCount} of {total} scheduled {total === 1 ? 'lesson is' : 'lessons are'} complete.</p>
      </div>
    </section>
  )
}

function NoWorkState({ onNavigate }: Pick<StudentDashboardProps, 'onNavigate'>) {
  return (
    <section className="no-work-state panel-glass" aria-labelledby="no-work-heading">
      <span className="no-work-state__mark" aria-hidden="true">☼</span>
      <div>
        <p className="eyebrow">Today&apos;s plan</p>
        <h2 id="no-work-heading">No lessons scheduled today</h2>
        <p>There&apos;s nothing assigned in your Academy schedule for today.</p>
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
                <span className="course-card__meter" aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>
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
  const firstName = profile.name.trim().split(/\s+/)[0] || 'Learner'

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
          <div><p className="eyebrow">Your Academy day</p><p className="student-dashboard__week">{data.schoolYearConfigured ? `Week ${data.week}` : 'Starting with week 1'}</p></div>
          {data.hasScheduledWork && <p className="student-dashboard__completion">{data.completedCount} of {data.lessons.length} complete today</p>}
        </div>

        <div className="student-dashboard__primary-grid">
          <div className="student-dashboard__daily-area">
            {data.upNext && !data.allWorkComplete ? <UpNextCard lesson={data.upNext} onNavigate={onNavigate} />
              : data.allWorkComplete ? <CompletionState completedCount={data.completedCount} total={data.lessons.length} />
                : <NoWorkState onNavigate={onNavigate} />}
            {data.hasScheduledWork && <TodayTimeline lessons={data.lessons} onNavigate={onNavigate} />}
          </div>
          <JarvisPanel />
        </div>
        <CourseProgressGrid profile={profile} catalog={catalog} levelOf={levelOf} onNavigate={onNavigate} />
      </div>
    </main>
  )
}
