import { useEffect, useMemo, useState } from 'react'
import { ACADEMY_SUBJECT_LABELS } from '../../../academy/contentTypes'
import type { AcademySubject } from '../../../types'
import type { FamilySetupStudent } from '../setup'
import type { FinalFamilyAutoPlannerHost } from './autoPlannerHost'
import type { FinalFamilyPilotController } from './controller'
import {
  buildFamilyOverviewLearner,
  summarizeFamilyOverview,
  type FamilyOverviewLearner,
  type FamilyOverviewTodayState,
} from './familyOverviewModel'

const TODAY_LABEL: Readonly<Record<FamilyOverviewTodayState, string>> = Object.freeze({
  DONE: 'Done for today',
  WORK_REMAINING: 'Work remaining',
  BLOCKED: 'Blocked',
  NEEDS_PLAN: 'School Plan needed',
  NO_SCHOOL: 'No school today',
  ASSESSMENT_WAITING: 'Assessment waiting',
})

const TODAY_CLASS: Readonly<Record<FamilyOverviewTodayState, string>> = Object.freeze({
  DONE: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  WORK_REMAINING: 'border-cyan-300 bg-cyan-50 text-cyan-950',
  BLOCKED: 'border-red-300 bg-red-50 text-red-950',
  NEEDS_PLAN: 'border-amber-300 bg-amber-50 text-amber-950',
  NO_SCHOOL: 'border-slate-300 bg-slate-100 text-slate-800',
  ASSESSMENT_WAITING: 'border-violet-300 bg-violet-50 text-violet-950',
})

const WORK_STATUS_LABEL = Object.freeze({
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  BLOCKED: 'Blocked',
  WAITING: 'Waiting',
})

type LearnerLoad =
  | { readonly status: 'ready'; readonly learner: FamilyOverviewLearner }
  | { readonly status: 'error'; readonly student: FamilySetupStudent; readonly message: string }

function onlineNow(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}

function Stat({ label, value }: { readonly label: string; readonly value: number }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm font-bold text-slate-600">{label}</p><p className="mt-1 text-3xl font-extrabold tabular-nums">{value}</p></div>
}

function courseFacts(controller: FinalFamilyPilotController, student: FamilySetupStudent): {
  readonly titles: Partial<Record<AcademySubject, string>>
  readonly completedTitles: readonly string[]
} {
  const courses = student.enabledSubjects.flatMap((subject) => controller.coursesFor(student, subject))
  const titles = Object.fromEntries(student.enabledSubjects.flatMap((subject) => {
    const courses = controller.coursesFor(student, subject)
    return courses.length === 1 ? [[subject, courses[0].title]] : []
  }))
  const assignments = controller.coreSnapshot.state.students.find((item) => item.studentRef === student.studentRef)?.assignments ?? []
  const assessments = controller.assessmentAssignments(student.studentRef)
  const completedTitles = courses.flatMap((course) => {
    const completedLessonRefs = new Set(assignments.filter((item) => item.state === 'completed' && item.lessonRef.startsWith(`${course.courseRef}-`)).map((item) => item.lessonRef))
    if (course.lessonCount === 0 || completedLessonRefs.size !== course.lessonCount) return []
    const assessmentRefs = controller.catalog.runtime.listUnits(course.courseRef).flatMap((unit) => unit.assessmentRef ? [unit.assessmentRef] : [])
    const certifiedRefs = new Set(assessments.filter((item) => item.courseRef === course.courseRef && item.status === 'CERTIFIED').map((item) => item.assessmentRef))
    return assessmentRefs.every((assessmentRef) => certifiedRefs.has(assessmentRef)) ? [course.title] : []
  })
  return Object.freeze({ titles, completedTitles: Object.freeze(completedTitles) })
}

export function FamilyOverviewContent({
  learners,
  online,
  onOpenDetails,
  onOpenSchoolPlan,
  onRefresh,
}: {
  readonly learners: readonly LearnerLoad[]
  readonly online: boolean
  readonly onOpenDetails: (studentRef: string) => void
  readonly onOpenSchoolPlan: (studentRef: string) => void
  readonly onRefresh: () => void
}) {
  const ready = learners.flatMap((item) => item.status === 'ready' ? [item.learner] : [])
  const summary = summarizeFamilyOverview(ready)
  return (
    <div className="mt-6 space-y-5" data-testid="family-overview">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-bold text-cyan-700">Family overview</p>
            <h3 className="mt-1 text-2xl font-extrabold">Today across your household</h3>
            <p className="mt-2 max-w-3xl text-slate-600">Persisted School Plans, assignments, assessments, and safety holds for each learner. Counts are work items, not estimated percentages.</p>
          </div>
          <button type="button" className="min-h-11 rounded-lg border border-slate-400 bg-white px-4 py-2 font-bold" onClick={onRefresh}>Refresh overview</button>
        </div>
        {!online ? <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 font-semibold text-amber-950" role="status">Offline. Saved work and progress on this device are still shown; new curriculum work may wait until the connection returns.</p> : null}
      </section>

      <section aria-label="Family at a glance" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Done today" value={summary.done} />
        <Stat label="Still has work" value={summary.workRemaining} />
        <Stat label="Blocked" value={summary.blocked} />
        <Stat label="Needs parent" value={summary.needsParent} />
        <Stat label="Assessment waiting" value={summary.assessmentsWaiting} />
      </section>

      <section aria-labelledby="family-overview-learners-heading">
        <h3 id="family-overview-learners-heading" className="sr-only">Learners</h3>
        <div className="grid gap-5 lg:grid-cols-2">
          {learners.map((entry) => entry.status === 'error' ? (
            <article key={entry.student.studentRef} className="rounded-2xl border border-red-300 bg-red-50 p-5" data-learner-ref={entry.student.studentRef}>
              <h4 className="text-xl font-extrabold">{entry.student.displayName}</h4>
              <p className="mt-2 font-semibold text-red-900" role="alert">{entry.message}</p>
              <button type="button" className="mt-4 min-h-11 rounded-lg border border-red-400 bg-white px-4 py-2 font-bold" onClick={onRefresh}>Try again</button>
            </article>
          ) : <LearnerCard key={entry.learner.studentRef} learner={entry.learner} online={online} onOpenDetails={onOpenDetails} onOpenSchoolPlan={onOpenSchoolPlan} />)}
        </div>
      </section>
    </div>
  )
}

function LearnerCard({ learner, online, onOpenDetails, onOpenSchoolPlan }: {
  readonly learner: FamilyOverviewLearner
  readonly online: boolean
  readonly onOpenDetails: (studentRef: string) => void
  readonly onOpenSchoolPlan: (studentRef: string) => void
}) {
  const planLabel = learner.schoolPlanState === 'CONFIGURED' ? 'School Plan configured'
    : learner.schoolPlanState === 'MISSING' ? 'No School Plan'
      : learner.schoolPlanState === 'READ_ONLY' ? 'School Plan read-only' : 'School Plan unavailable'
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" data-learner-ref={learner.studentRef} aria-labelledby={`family-overview-${learner.studentRef}`}>
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h4 id={`family-overview-${learner.studentRef}`} className="text-xl font-extrabold">{learner.displayName}</h4><p className="text-sm font-semibold text-slate-600">Nominal Grade {learner.nominalGrade} · {learner.localDate}</p></div>
          <span className={`rounded-full border px-3 py-1 text-sm font-extrabold ${TODAY_CLASS[learner.todayState]}`}>{TODAY_LABEL[learner.todayState]}</span>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg bg-slate-100 p-3"><dt className="text-xs font-bold text-slate-600">Scheduled</dt><dd className="text-xl font-extrabold tabular-nums">{learner.scheduledToday}</dd></div>
          <div className="rounded-lg bg-emerald-50 p-3"><dt className="text-xs font-bold text-emerald-800">Completed</dt><dd className="text-xl font-extrabold tabular-nums">{learner.completedToday}</dd></div>
          <div className="rounded-lg bg-cyan-50 p-3"><dt className="text-xs font-bold text-cyan-900">Remaining</dt><dd className="text-xl font-extrabold tabular-nums">{learner.remainingToday}</dd></div>
          <div className="rounded-lg bg-amber-50 p-3"><dt className="text-xs font-bold text-amber-900">Carried</dt><dd className="text-xl font-extrabold tabular-nums">{learner.carriedUnfinished}</dd></div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold">
          <span className={`rounded-full px-3 py-1 ${learner.schoolPlanState === 'CONFIGURED' ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-950'}`}>{planLabel}</span>
          {learner.openSafetyHolds > 0 ? <span className="rounded-full bg-red-100 px-3 py-1 text-red-950">Safety hold · {learner.openSafetyHolds}</span> : null}
          {learner.pendingAssessments > 0 ? <span className="rounded-full bg-violet-100 px-3 py-1 text-violet-950">Assessment waiting · {learner.pendingAssessments}</span> : null}
          {learner.pendingGuardianAttestations > 0 ? <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-950">Guardian review · {learner.pendingGuardianAttestations}</span> : null}
          {learner.courseComplete ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-950">Course complete</span> : null}
          {!online && learner.offlineMaterializedWorkAvailable ? <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-950">Saved work available offline</span> : null}
        </div>

        {learner.needsParent ? <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3"><p className="font-extrabold text-amber-950">Needs parent</p><p className="mt-1 text-sm text-amber-900">{learner.needsParentReasons.join(' · ')}</p></div> : null}

        <section className="mt-4" aria-labelledby={`family-overview-work-${learner.studentRef}`}>
          <h5 id={`family-overview-work-${learner.studentRef}`} className="font-extrabold">Today’s scheduled work</h5>
          {learner.workItems.length === 0 ? <p className="mt-2 text-sm text-slate-600">{learner.todayState === 'NO_SCHOOL' ? 'No schoolwork is scheduled today.' : learner.todayState === 'DONE' ? 'All scheduled work is complete.' : 'No work items are scheduled.'}</p> : (
            <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200">{learner.workItems.map((item) => (
              <li key={item.assignmentRef} className="flex items-start justify-between gap-3 p-3">
                <span><strong className="block text-sm">{item.title}</strong><span className="text-xs text-slate-600">{item.assessment ? 'Assessment' : item.subject ? ACADEMY_SUBJECT_LABELS[item.subject] : 'Scheduled work'}{item.workingGrade ? ` · Working Grade ${item.workingGrade}` : ''}{item.scheduledLocalTime ? ` · ${item.scheduledLocalTime}` : ''}{item.carriedForwardFromDate ? ` · Carried from ${item.carriedForwardFromDate}` : ''}</span></span>
                <span className="shrink-0 text-xs font-extrabold">{WORK_STATUS_LABEL[item.status]}</span>
              </li>
            ))}</ul>
          )}
        </section>

        <details className="mt-4 rounded-xl bg-slate-50 p-3">
          <summary className="cursor-pointer font-bold">Courses and working levels ({learner.workingLevels.length})</summary>
          <ul className="mt-2 space-y-1 text-sm">{learner.workingLevels.map((level) => <li key={level.subject}><strong>{level.subjectLabel}</strong> · Working Grade {level.workingGrade}{level.courseTitle ? ` · ${level.courseTitle}` : ' · No resolved course'}</li>)}</ul>
        </details>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="min-h-11 rounded-lg bg-slate-900 px-4 py-2 font-extrabold text-white" onClick={() => onOpenDetails(learner.studentRef)}>View {learner.displayName}’s parent details</button>
          <button type="button" className="min-h-11 rounded-lg border border-slate-400 bg-white px-4 py-2 font-bold" onClick={() => onOpenSchoolPlan(learner.studentRef)}>Open School Plan</button>
        </div>
        <p className="mt-2 text-xs text-slate-500">Opens an authorized parent-only view. This does not sign in as {learner.displayName}.</p>
      </div>
    </article>
  )
}

export function FamilyOverview({
  controller,
  host,
  revision,
  onOpenDetails,
  onOpenSchoolPlan,
}: {
  readonly controller: FinalFamilyPilotController
  readonly host: FinalFamilyAutoPlannerHost
  readonly revision: number
  readonly onOpenDetails: (studentRef: string) => void
  readonly onOpenSchoolPlan: (studentRef: string) => void
}) {
  const students = controller.appSnapshot.state.setup.students
  const [loads, setLoads] = useState<readonly LearnerLoad[]>([])
  const [busy, setBusy] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [online, setOnline] = useState(onlineNow)
  const studentKey = useMemo(() => students.map((student) => `${student.studentRef}:${student.updatedAt}`).join('|'), [students])

  useEffect(() => {
    const update = () => setOnline(onlineNow())
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  useEffect(() => {
    let live = true
    setBusy(true)
    void (async () => {
      const next: LearnerLoad[] = []
      // dashboardFor may materialize accepted School Plan work through Core.
      // Keep household reads ordered so concurrent student writes cannot race.
      for (const student of students) {
        try {
          const dashboard = await host.dashboardFor(student.studentRef)
          const document = await host.loadDocument(student.studentRef)
          const courses = courseFacts(controller, student)
          next.push({ status: 'ready', learner: buildFamilyOverviewLearner({
            student,
            plan: dashboard.plan,
            schedule: dashboard.schedule,
            schoolPlan: document,
            assessments: controller.assessmentAssignments(student.studentRef),
            openSafetyHolds: controller.openSafetyHolds(student.studentRef).length,
            pendingGuardianAttestations: controller.pendingAttestations(student.studentRef).length,
            courseTitles: courses.titles,
            completedCourseTitles: courses.completedTitles,
          }) })
        } catch {
          next.push({ status: 'error', student, message: 'This learner’s saved overview could not be loaded safely. No other learner’s data was substituted.' })
        }
      }
      if (live) { setLoads(Object.freeze(next)); setBusy(false) }
    })()
    return () => { live = false }
  }, [controller, host, online, refreshKey, revision, studentKey])

  if (busy && loads.length === 0) return <section className="mt-6 rounded-2xl border bg-white p-5" aria-busy="true"><p role="status">Loading the family overview…</p></section>
  return <div aria-busy={busy || undefined}><FamilyOverviewContent learners={loads} online={online} onOpenDetails={onOpenDetails} onOpenSchoolPlan={onOpenSchoolPlan} onRefresh={() => setRefreshKey((value) => value + 1)} />{busy ? <p className="sr-only" role="status">Refreshing family overview…</p> : null}</div>
}
