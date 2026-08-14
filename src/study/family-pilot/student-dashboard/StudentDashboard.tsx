import { useEffect, useRef, useState } from 'react'
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

function progressPercent(course: StudentDashboardCourse): number | null {
  if (course.completionPercent === null) return null
  if (typeof course.completionPercent === 'number') return Math.min(100, Math.max(0, course.completionPercent))
  if (course.total <= 0) return null
  return Math.round((Math.min(Math.max(course.completed, 0), course.total) / course.total) * 100)
}

interface DashboardLaunchState {
  readonly phase: 'opening' | 'failed'
  readonly workRef: string
  readonly message: string
}

function TodayItem({ item, onActivate, launchState }: {
  readonly item: StudentDashboardWorkItem
  readonly onActivate: (workRef: string, workKind: 'lesson' | 'assessment') => void
  readonly launchState: DashboardLaunchState | null
}) {
  const isOpening = launchState?.phase === 'opening' && launchState.workRef === item.workRef
  const actionLabel = item.actionLabel ?? 'Open'
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
      {item.actionable ? <span className="family-dashboard__timeline-action" aria-hidden="true">{isOpening ? 'Opening…' : actionLabel}<span>→</span></span> : null}
    </>
  )

  return (
    <li className="family-dashboard__timeline-item">
      {item.actionable ? (
        <button
          type="button"
          disabled={launchState?.phase === 'opening'}
          onClick={() => onActivate(item.workRef, item.workKind ?? 'lesson')}
          aria-label={`${actionLabel} ${item.title}`}
        >
          {contents}
        </button>
      ) : <div>{contents}</div>}
    </li>
  )
}

function CourseCard({ course, onOpenCourse }: { readonly course: StudentDashboardCourse; readonly onOpenCourse: StudentDashboardProps['onOpenCourse'] }) {
  const percent = progressPercent(course)
  const progressLabel = course.progressLabel ?? (percent === null
    ? 'No assigned work yet'
    : `${course.completed} of ${course.total} lessons complete`)
  const contents = (
    <>
      <span className="family-dashboard__course-topline"><span>Course</span><span>{percent === null ? 'Progress starts with assigned work' : `${percent}% complete`}</span></span>
      <strong>{course.title}</strong>
      <span className="family-dashboard__course-context">{course.context}</span>
      {percent === null ? null : (
        <span className="family-dashboard__course-meter" role="progressbar" aria-label={`${course.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <span style={{ width: `${percent}%`, minWidth: percent === 0 ? 0 : undefined }} />
        </span>
      )}
      <span className="family-dashboard__course-progress">{progressLabel}</span>
    </>
  )
  return (
    <li data-dashboard-course-ref={course.courseRef}>
      {course.actionable === false ? <div className="family-dashboard__course-card family-dashboard__course-card--unavailable">{contents}</div> : (
        <button type="button" onClick={() => onOpenCourse(course.courseRef)} aria-label={`Open ${course.title}, ${course.context}, ${percent === null ? progressLabel : `${percent}% complete`}`}>
          {contents}
        </button>
      )}
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
  onLock,
  onSwitchLearner,
  onSignOut,
}: StudentDashboardProps) {
  const [launchState, setLaunchState] = useState<DashboardLaunchState | null>(null)
  const launchPending = useRef(false)
  const launchNotice = useRef<HTMLParagraphElement>(null)
  const mission = model.mission
  const canOpenMission = Boolean(mission.workRef && mission.actionLabel)
  const initial = (model.student.avatarInitial || model.student.displayName.charAt(0) || '?').toUpperCase()
  const activateWork = (workRef: string, workKind: 'lesson' | 'assessment') => {
    if (launchPending.current) return
    launchPending.current = true
    setLaunchState({ phase: 'opening', workRef, message: `Opening ${workKind}…` })
    // Allow the immediate status update to paint before the host replaces this
    // dashboard with Study. One shared pending flag blocks pointer/key repeats.
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      void Promise.resolve().then(() => onOpenWork(workRef)).then(() => {
        launchPending.current = false
        setLaunchState((held) => held?.workRef === workRef ? null : held)
      }).catch(() => {
        launchPending.current = false
        setLaunchState({
          phase: 'failed',
          workRef,
          message: `We couldn’t open this ${workKind}. Please try again or ask a parent for help.`,
        })
      })
    }))
  }
  const missionOpening = launchState?.phase === 'opening' && launchState.workRef === mission.workRef
  useEffect(() => {
    if (launchState?.phase === 'failed') launchNotice.current?.focus()
  }, [launchState])

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
            {onLock ? <button type="button" onClick={onLock}>Lock</button> : null}
            {onSwitchLearner ? <button type="button" onClick={onSwitchLearner}>Switch learner</button> : null}
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
            <section id="family-dashboard-mission" className={`family-dashboard__mission family-dashboard__mission--${mission.state}${canOpenMission ? ' family-dashboard__mission--actionable' : ''}`} aria-labelledby="family-dashboard-mission-heading">
              <div className="family-dashboard__mission-glow" aria-hidden="true" />
              <p className="family-dashboard__eyebrow">{mission.eyebrow}</p>
              <h2 id="family-dashboard-mission-heading">{mission.title}</h2>
              {mission.context ? <p className="family-dashboard__mission-context">{mission.context}</p> : null}
              <p className="family-dashboard__mission-status">{mission.statusLabel}</p>
              {mission.description ? <p className="family-dashboard__mission-description">{mission.description}</p> : null}
              {canOpenMission ? (
                <button
                  type="button"
                  className="family-dashboard__mission-control"
                  disabled={launchState?.phase === 'opening'}
                  aria-label={mission.actionLabel}
                  onClick={() => activateWork(mission.workRef!, mission.workKind ?? 'lesson')}
                >
                  <span className="family-dashboard__button-primary" aria-hidden="true">
                    <span>{missionOpening ? 'Opening…' : mission.actionLabel}</span><span>→</span>
                  </span>
                </button>
              ) : null}
            </section>

            {launchState ? (
              <p
                ref={launchNotice}
                className={`family-dashboard__launch-notice family-dashboard__launch-notice--${launchState.phase}`}
                role={launchState.phase === 'failed' ? 'alert' : 'status'}
                aria-live={launchState.phase === 'failed' ? 'assertive' : 'polite'}
                tabIndex={launchState.phase === 'failed' ? -1 : undefined}
              >
                {launchState.message}
              </p>
            ) : null}

            <section className="family-dashboard__today family-dashboard__panel" aria-labelledby="family-dashboard-today-heading">
              <div className="family-dashboard__section-heading">
                <div><p className="family-dashboard__eyebrow">Today&rsquo;s sequence</p><h2 id="family-dashboard-today-heading">Today&rsquo;s work</h2></div>
                <span>{model.todayItems.length} {model.todayItems.length === 1 ? 'item' : 'items'}</span>
              </div>
              {model.todayItems.length ? (
                <ol className="family-dashboard__timeline">
                  {model.todayItems.map((item) => <TodayItem key={item.workRef} item={item} onActivate={activateWork} launchState={launchState} />)}
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
