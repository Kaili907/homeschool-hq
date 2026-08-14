import { JarvisDashboard } from './JarvisDashboard'
import type {
  StudentDashboardCourse,
  StudentDashboardItemState,
  StudentDashboardProps,
  StudentDashboardWorkItem,
} from './types'
import './studentDashboard.css'

const ITEM_MARK: Readonly<Record<StudentDashboardItemState, string>> = {
  complete: '✓',
  ready: '○',
  'in-progress': '↗',
  pending: '…',
  blocked: '!',
  unavailable: '×',
}

function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || 'Learner'
}

function progressPercent(course: StudentDashboardCourse): number {
  if (course.total <= 0) return 0
  return Math.round((Math.min(Math.max(course.completed, 0), course.total) / course.total) * 100)
}

function TodayItem({ item, onOpenWork }: { readonly item: StudentDashboardWorkItem; readonly onOpenWork: StudentDashboardProps['onOpenWork'] }) {
  const contents = (
    <>
      <span className={`family-dashboard__timeline-status family-dashboard__timeline-status--${item.state}`} aria-hidden="true">
        {ITEM_MARK[item.state]}
      </span>
      <span className="family-dashboard__timeline-copy">
        <strong>{item.title}</strong>
        <span>{item.context}</span>
      </span>
      <span className="family-dashboard__timeline-state">{item.stateLabel}</span>
      {item.actionable ? <span className="family-dashboard__timeline-arrow" aria-hidden="true">→</span> : null}
    </>
  )

  return (
    <li className="family-dashboard__timeline-item">
      {item.actionable ? (
        <button type="button" onClick={() => onOpenWork(item.workRef)} aria-label={`${item.title}, ${item.context}, ${item.stateLabel}`}>
          {contents}
        </button>
      ) : <div>{contents}</div>}
    </li>
  )
}

function CourseCard({ course, onOpenCourse }: { readonly course: StudentDashboardCourse; readonly onOpenCourse: StudentDashboardProps['onOpenCourse'] }) {
  const percent = progressPercent(course)
  return (
    <li>
      <button type="button" onClick={() => onOpenCourse(course.courseRef)} aria-label={`Open ${course.title}, ${course.context}, ${percent}% complete`}>
        <span className="family-dashboard__course-topline"><span>Course</span><span>{percent}% complete</span></span>
        <strong>{course.title}</strong>
        <span className="family-dashboard__course-context">{course.context}</span>
        <span className="family-dashboard__course-meter" role="progressbar" aria-label={`${course.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <span style={{ width: `${percent}%`, minWidth: percent === 0 ? 0 : undefined }} />
        </span>
        <span className="family-dashboard__course-progress">{course.completed} of {course.total} lessons complete</span>
      </button>
    </li>
  )
}

export function StudentDashboard({
  model,
  jarvis = { mode: 'visual-only', status: 'Jarvis is visual only. Tutor is not connected in this release.' },
  onOpenWork,
  onOpenCourse,
  onOpenSchedule,
  onOpenTool,
  onSignOut,
}: StudentDashboardProps) {
  const mission = model.mission
  const canOpenMission = Boolean(mission.workRef && mission.actionLabel)
  const initial = (model.student.avatarInitial || model.student.displayName.charAt(0) || '?').toUpperCase()

  return (
    <div className="family-dashboard">
      <a className="family-dashboard__skip" href="#family-dashboard-mission">Skip to today&rsquo;s work</a>
      <div className="family-dashboard__ambient family-dashboard__ambient--one" aria-hidden="true" />
      <div className="family-dashboard__ambient family-dashboard__ambient--two" aria-hidden="true" />
      <main className="family-dashboard__shell" data-mission-state={mission.state}>
        <header className="family-dashboard__topbar">
          <div className="family-dashboard__identity">
            <span className="family-dashboard__mark" aria-hidden="true">{initial}</span>
            <div>
              <p>Manuel Academy</p>
              <h1>Hello, {firstName(model.student.displayName)}</h1>
            </div>
          </div>
          <nav className="family-dashboard__nav" aria-label="Student dashboard navigation">
            <button type="button" onClick={onOpenSchedule}>Schedule</button>
            <button type="button" className="family-dashboard__sign-out" onClick={onSignOut}>Sign out</button>
          </nav>
        </header>

        <div className="family-dashboard__intro">
          <div>
            <p className="family-dashboard__eyebrow">{model.periodEyebrow}</p>
            <p className="family-dashboard__period">{model.periodLabel}</p>
          </div>
          <p className="family-dashboard__progress-label">{model.progressLabel}</p>
        </div>

        <div className="family-dashboard__primary-grid">
          <div className="family-dashboard__daily-area">
            <section id="family-dashboard-mission" className={`family-dashboard__mission family-dashboard__mission--${mission.state}`} aria-labelledby="family-dashboard-mission-heading">
              <div className="family-dashboard__mission-glow" aria-hidden="true" />
              <p className="family-dashboard__eyebrow">{mission.eyebrow}</p>
              <h2 id="family-dashboard-mission-heading">{mission.title}</h2>
              {mission.context ? <p className="family-dashboard__mission-context">{mission.context}</p> : null}
              <p className="family-dashboard__mission-status">{mission.statusLabel}</p>
              {mission.description ? <p className="family-dashboard__mission-description">{mission.description}</p> : null}
              {canOpenMission ? (
                <button type="button" className="family-dashboard__button-primary" onClick={() => onOpenWork(mission.workRef!)}>
                  {mission.actionLabel}<span aria-hidden="true">→</span>
                </button>
              ) : null}
            </section>

            <section className="family-dashboard__today family-dashboard__panel" aria-labelledby="family-dashboard-today-heading">
              <div className="family-dashboard__section-heading">
                <div><p className="family-dashboard__eyebrow">Today&rsquo;s sequence</p><h2 id="family-dashboard-today-heading">Today&rsquo;s work</h2></div>
                <span>{model.todayItems.length} {model.todayItems.length === 1 ? 'item' : 'items'}</span>
              </div>
              {model.todayItems.length ? (
                <ol className="family-dashboard__timeline">
                  {model.todayItems.map((item) => <TodayItem key={item.workRef} item={item} onOpenWork={onOpenWork} />)}
                </ol>
              ) : model.todayEmptyLabel ? <p className="family-dashboard__empty-copy">{model.todayEmptyLabel}</p> : null}
            </section>
          </div>
          <JarvisDashboard {...jarvis} />
        </div>

        <div className="family-dashboard__secondary-grid">
          <section className="family-dashboard__courses" aria-labelledby="family-dashboard-courses-heading">
            <div className="family-dashboard__section-heading">
              <div><p className="family-dashboard__eyebrow">Your courses</p><h2 id="family-dashboard-courses-heading">Keep building</h2></div>
            </div>
            <ul className="family-dashboard__course-grid">
              {model.courses.map((course) => <CourseCard key={course.courseRef} course={course} onOpenCourse={onOpenCourse} />)}
            </ul>
          </section>

          <div className="family-dashboard__side-stack">
            <section className="family-dashboard__compact-panel family-dashboard__panel" aria-labelledby="family-dashboard-upcoming-heading">
              <div className="family-dashboard__section-heading">
                <div><p className="family-dashboard__eyebrow">Schedule</p><h2 id="family-dashboard-upcoming-heading">Upcoming</h2></div>
                <button type="button" className="family-dashboard__text-button" onClick={onOpenSchedule}>View all</button>
              </div>
              {model.upcoming.length ? <ul className="family-dashboard__upcoming-list">{model.upcoming.map((item) => (
                <li key={item.upcomingRef}>
                  <span>{item.when}</span><strong>{item.title}</strong>{item.detail ? <small>{item.detail}</small> : null}
                </li>
              ))}</ul> : model.upcomingEmptyLabel ? <p className="family-dashboard__empty-copy">{model.upcomingEmptyLabel}</p> : null}
            </section>

            <section className="family-dashboard__compact-panel family-dashboard__panel" aria-labelledby="family-dashboard-tools-heading">
              <div className="family-dashboard__section-heading"><div><p className="family-dashboard__eyebrow">Shortcuts</p><h2 id="family-dashboard-tools-heading">Quick tools</h2></div></div>
              <ul className="family-dashboard__tools-list">{model.quickTools.map((tool) => (
                <li key={tool.toolRef}><button type="button" onClick={() => onOpenTool(tool.toolRef)}><strong>{tool.label}</strong>{tool.description ? <span>{tool.description}</span> : null}<span aria-hidden="true">→</span></button></li>
              ))}</ul>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
