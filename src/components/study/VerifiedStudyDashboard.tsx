import { useEffect, useRef, useState } from 'react'
import {
  parseVerifiedStudyCalendar,
  parseVerifiedStudyDashboard,
  VERIFIED_CALENDAR_BLOCK_LIMIT,
  VerifiedStudyContractError,
  type VerifiedStudyBlockState,
  type VerifiedStudyBlockType,
  type VerifiedStudyCalendarBlock,
  type VerifiedStudySessionRecord,
  type VerifiedStudySessionState,
} from '../../study/production/verifiedDashboardContracts'
import type { VerifiedStudyRuntimeAdapter } from '../../study/production/verifiedRuntimeAdapter'

/**
 * STUDY-A1-PROD-DASH-1 — the production learner surface.
 *
 * Read-only by construction. It runs the only two verified academic runtime
 * operations that exist today, `dashboard:read` and `calendar:read`, through the
 * adapter it is handed, and renders exactly the fields those two responses
 * carry. There is no session launch, no resume, no settings and no review queue,
 * because the verified runtime supports none of them yet; the preview
 * StudyDashboard cannot be reused for the same reason.
 *
 * Nothing is synthesised. No lesson title, no subject, no completion percentage
 * and no "today" is derived here: the production path is deliberately given no
 * household timezone, so blocks are grouped by the household's own
 * `intendedLocalDate` rather than by a guess about where the learner is.
 */

/**
 * Typed as a total record on purpose. A new server enum value reaches this file
 * as a build failure rather than as a blank label on a learner's screen.
 */
const BLOCK_TYPE_LABEL: Readonly<Record<VerifiedStudyBlockType, string>> = Object.freeze({
  lesson: 'Lesson',
  review: 'Review',
  resume: 'Resume',
  break: 'Break',
  assessment: 'Assessment',
})

const BLOCK_STATE_LABEL: Readonly<Record<VerifiedStudyBlockState, string>> = Object.freeze({
  scheduled: 'Scheduled',
  available: 'Available',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
})

const SESSION_STATE_LABEL: Readonly<Record<VerifiedStudySessionState, string>> = Object.freeze({
  planned: 'Planned',
  active: 'Active',
  paused: 'Paused',
  approved_break: 'Approved break',
  student_requested_break: 'Student requested break',
  technical_interruption: 'Technical interruption',
  completed: 'Completed',
  abandoned: 'Abandoned',
})

type DashboardView =
  | { readonly kind: 'loading' }
  | {
      readonly kind: 'ready'
      readonly blocks: readonly VerifiedStudyCalendarBlock[]
      readonly sessions: readonly VerifiedStudySessionRecord[]
    }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'malformed' }

/**
 * A fresh reference per call. The lifecycle quarantines a reference it has
 * already seen in the current epoch as a duplicate response, so the two reads
 * below can never share one, and a remount can never reuse an earlier one.
 */
function freshOperationRef(operation: string): string {
  const unique = globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}`
  return `production-${operation}:${unique}`
}

function groupByIntendedLocalDate(
  blocks: readonly VerifiedStudyCalendarBlock[],
): readonly (readonly [string, readonly VerifiedStudyCalendarBlock[]])[] {
  const grouped = new Map<string, VerifiedStudyCalendarBlock[]>()
  for (const block of blocks) {
    const day = grouped.get(block.intendedLocalDate)
    if (day) day.push(block)
    else grouped.set(block.intendedLocalDate, [block])
  }
  // The keys are `YYYY-MM-DD`, so a plain string sort is the household's own
  // calendar order without any timezone being assumed for the reader.
  return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right))
}

export function VerifiedStudyDashboard({
  runtime,
  onBack,
}: {
  runtime: VerifiedStudyRuntimeAdapter
  onBack: () => void
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [view, setView] = useState<DashboardView>({ kind: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    let live = true
    setView({ kind: 'loading' })

    Promise.all([
      runtime.execute({
        operation: 'dashboard:read',
        request: Object.freeze({}),
        operationRef: freshOperationRef('dashboard-read'),
        signal: controller.signal,
      }),
      runtime.execute({
        operation: 'calendar:read',
        request: Object.freeze({ cursor: null }),
        operationRef: freshOperationRef('calendar-read'),
        signal: controller.signal,
      }),
    ])
      .then(([dashboardBody, calendarBody]) => {
        // Both bodies are parsed before anything is committed to state, so a
        // response that fails its contract cannot leave half a plan on screen.
        const dashboard = parseVerifiedStudyDashboard(dashboardBody)
        const calendar = parseVerifiedStudyCalendar(calendarBody)
        if (!live) return
        setView({ kind: 'ready', blocks: calendar.blocks, sessions: dashboard.sessions })
      })
      .catch((error: unknown) => {
        if (!live) return
        setView({ kind: error instanceof VerifiedStudyContractError ? 'malformed' : 'unavailable' })
      })

    return () => {
      live = false
      controller.abort('navigation-away')
    }
  }, [runtime])

  useEffect(() => { headingRef.current?.focus() }, [view.kind])

  return (
    <main
      className="study-runtime-host min-h-screen bg-slate-50 p-6 text-slate-900"
      data-surface="verified-study-dashboard"
      data-view={view.kind}
      aria-busy={view.kind === 'loading'}
    >
      <div className="mx-auto max-w-3xl">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 ref={headingRef} className="text-3xl font-bold" tabIndex={-1}>Your Study plan</h1>
          <button
            className="min-h-11 rounded-lg border border-slate-400 bg-white px-4 py-2 font-bold"
            onClick={onBack}
          >
            Back home
          </button>
        </header>

        {view.kind === 'loading' && (
          <p className="mt-6" role="status">Loading your Study plan.</p>
        )}
        {view.kind === 'unavailable' && (
          <p className="mt-6" role="alert">
            Study could not be loaded right now. Nothing was changed.
          </p>
        )}
        {view.kind === 'malformed' && (
          <p className="mt-6" role="alert">
            Study could not show this plan safely, so none of it is shown.
          </p>
        )}

        {view.kind === 'ready' && (
          <>
            <section className="mt-8" aria-labelledby="verified-study-blocks">
              <h2 id="verified-study-blocks" className="text-xl font-bold">Scheduled Study blocks</h2>
              {view.blocks.length === 0 ? (
                <p className="mt-2" data-empty="blocks">No Study blocks are scheduled.</p>
              ) : (<>
                {/*
                  The server answers calendar:read with at most
                  VERIFIED_CALENDAR_BLOCK_LIMIT blocks, ordered by scheduled
                  start, and returns no continuation cursor with them. So at
                  exactly the limit this surface cannot tell whether the plan
                  ends there, and it says so rather than letting a full page
                  read as a complete plan.
                */}
                <p
                  className="mt-2 text-sm"
                  data-block-limit={view.blocks.length === VERIFIED_CALENDAR_BLOCK_LIMIT ? 'reached' : 'under'}
                >
                  {view.blocks.length === VERIFIED_CALENDAR_BLOCK_LIMIT
                    ? `Showing the first ${VERIFIED_CALENDAR_BLOCK_LIMIT} scheduled Study blocks. There may be more that are not shown here.`
                    : `Showing up to ${VERIFIED_CALENDAR_BLOCK_LIMIT} scheduled Study blocks.`}
                </p>
                {groupByIntendedLocalDate(view.blocks).map(([intendedLocalDate, blocks]) => (
                  <div key={intendedLocalDate} className="mt-4" data-intended-local-date={intendedLocalDate}>
                    <h3 className="font-bold">{intendedLocalDate}</h3>
                    <ul className="mt-2 space-y-2">
                      {blocks.map((block) => (
                        <li
                          key={block.blockId}
                          className="rounded-lg border border-slate-200 bg-white p-3"
                          data-block-type={block.blockType}
                          data-block-state={block.state}
                        >
                          <p className="font-bold">{BLOCK_TYPE_LABEL[block.blockType]}</p>
                          <p className="text-sm">
                            Scheduled start <time dateTime={block.scheduledStart}>{block.scheduledStart}</time>
                          </p>
                          <p className="text-sm">{BLOCK_STATE_LABEL[block.state]}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </>)}
            </section>

            <section className="mt-8" aria-labelledby="verified-study-sessions">
              <h2 id="verified-study-sessions" className="text-xl font-bold">Recent Study sessions</h2>
              {view.sessions.length === 0 ? (
                <p className="mt-2" data-empty="sessions">No recent Study sessions.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {view.sessions.map((session) => (
                    <li
                      key={session.sessionId}
                      className="rounded-lg border border-slate-200 bg-white p-3"
                      data-session-state={session.state}
                    >
                      <p className="font-bold">{session.lessonId}</p>
                      <p className="text-sm">{SESSION_STATE_LABEL[session.state]}</p>
                      <p className="text-sm">
                        Updated <time dateTime={session.updatedAt}>{session.updatedAt}</time>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}
