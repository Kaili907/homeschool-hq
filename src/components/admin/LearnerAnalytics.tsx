import { useState, type KeyboardEvent } from 'react'
import type {
  AssessmentEvidence,
  LearnerAnalyticsViewState,
  LearnerDetail,
  LearnerEvidenceUnavailableReason,
  LearnerListItem,
  StudySummary,
} from '../../admin/learnerAnalyticsModel'

export function moveLearnerSelection(
  refs: readonly string[],
  current: string,
  key: 'ArrowUp' | 'ArrowDown' | 'Home' | 'End',
): string {
  if (refs.length === 0) return ''
  if (key === 'Home') return refs[0]
  if (key === 'End') return refs[refs.length - 1]
  const currentIndex = Math.max(0, refs.indexOf(current))
  const delta = key === 'ArrowDown' ? 1 : -1
  return refs[(currentIndex + delta + refs.length) % refs.length]
}

export function LearnerAnalytics({
  state,
  initialLearnerRef,
  onRetry,
}: {
  state: LearnerAnalyticsViewState
  initialLearnerRef?: string
  onRetry?: () => void
}) {
  const [selectedRef, setSelectedRef] = useState(initialLearnerRef ?? '')

  if (state.status === 'resolving') {
    return <AccessState busy title="Verifying access" message="Learner evidence stays private until administrator authorization is confirmed." />
  }
  if (state.status === 'unauthorized') {
    return <AccessState title="Learner analytics unavailable" message="The canonical learners:read capability is required." backToAcademy />
  }
  if (state.status === 'loading') {
    return <AccessState busy title="Loading learner evidence" message="Reading authorized educational records." />
  }
  if (state.status === 'error') {
    return <AccessState title="Learner evidence unavailable" message={state.message} alert onRetry={onRetry} />
  }

  const { learners, details, observedAt } = state.snapshot
  const selected = details[selectedRef] ?? details[learners[0]?.learnerRef ?? '']
  if (!selected) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6" aria-labelledby="learner-analytics-title">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Admin console</p>
        <h1 id="learner-analytics-title" className="mt-1 text-3xl font-bold text-slate-950">Learner analytics</h1>
        <p className="mt-4 text-slate-600">No learner records are available to this authorized view.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6" aria-labelledby="learner-analytics-title">
      <header className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Admin console</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 id="learner-analytics-title" className="text-3xl font-bold text-slate-950">Learner analytics</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">Read-only educational evidence for instructional support. No conversations, journal text, audio, or diagnostic inference.</p>
          </div>
          <p className="text-xs font-semibold text-slate-500">Observed {formatDateTime(observedAt)}</p>
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-labelledby="learner-list-title">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 id="learner-list-title" className="text-xl font-bold text-slate-950">Learners</h2>
          <p className="mt-1 text-sm text-slate-600">Select a learner to inspect trusted academic evidence.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3" scope="col">Learner</th>
                <th className="px-4 py-3" scope="col">Working levels</th>
                <th className="px-4 py-3" scope="col">Today</th>
                <th className="px-4 py-3" scope="col">Attendance</th>
                <th className="px-4 py-3" scope="col">Mastery</th>
                <th className="px-4 py-3" scope="col">Study</th>
                <th className="px-4 py-3" scope="col">Review</th>
              </tr>
            </thead>
            <tbody>
              {learners.map((learner) => (
                <LearnerRow
                  key={learner.learnerRef}
                  learner={learner}
                  selected={learner.learnerRef === selected.learnerRef}
                  allRefs={learners.map((item) => item.learnerRef)}
                  onSelect={setSelectedRef}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <LearnerDetailView detail={selected} />
    </div>
  )
}

function AccessState({ busy = false, title, message, alert = false, onRetry, backToAcademy = false }: { busy?: boolean; title: string; message: string; alert?: boolean; onRetry?: () => void; backToAcademy?: boolean }) {
  return (
    <div className="flex min-h-72 items-center justify-center rounded-2xl border border-slate-200 bg-white p-6" aria-busy={busy}>
      <section className="max-w-lg text-center" aria-live="polite" role={alert ? 'alert' : undefined}>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Learner analytics</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">{title}</h1>
        <p className="mt-2 text-slate-600">{message}</p>
        {onRetry && <button type="button" onClick={onRetry} className="mt-4 min-h-11 rounded-lg bg-slate-950 px-4 py-2 font-bold text-white">Try again</button>}
        {backToAcademy && <a href="/academy" className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-slate-400 px-4 py-2 font-bold text-slate-900">Back to Academy</a>}
      </section>
    </div>
  )
}

function LearnerRow({ learner, selected, allRefs, onSelect }: { learner: LearnerListItem; selected: boolean; allRefs: readonly string[]; onSelect: (ref: string) => void }) {
  const explicitLevels = learner.workingLevels.filter((level) => level.source === 'explicit')
  const handleKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = moveLearnerSelection(allRefs, learner.learnerRef, event.key as 'ArrowUp' | 'ArrowDown' | 'Home' | 'End')
    onSelect(next)
    const buttons = event.currentTarget.closest('tbody')?.querySelectorAll<HTMLButtonElement>('[data-learner-ref]') ?? []
    Array.from(buttons).find((button) => button.dataset.learnerRef === next)?.focus()
  }
  return (
    <tr className={`border-t border-slate-100 ${selected ? 'bg-sky-50' : ''}`}>
      <th className="px-4 py-3" scope="row">
        <button
          type="button"
          data-learner-ref={learner.learnerRef}
          aria-pressed={selected}
          aria-controls="learner-detail"
          tabIndex={selected ? 0 : -1}
          onClick={() => onSelect(learner.learnerRef)}
          onKeyDown={handleKey}
          className="min-h-11 rounded-lg px-2 text-left font-bold text-sky-800 outline-offset-2 hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-sky-700"
        >
          {learner.displayName}<span className="block text-xs font-semibold text-slate-500">Grade {learner.nominalGrade}</span>
        </button>
      </th>
      <td className="px-4 py-3 text-slate-700">{explicitLevels.length > 0 ? explicitLevels.map((level) => `${level.subjectLabel} ${level.level}`).join(' · ') : `All follow Grade ${learner.nominalGrade}`}</td>
      <td className="px-4 py-3"><CompletionValue completion={learner.todayCompletion} /></td>
      <td className="px-4 py-3 text-slate-700">{learner.attendance.recordedToday ? 'Recorded today' : 'Not recorded today'}<span className="block text-xs text-slate-500">{learner.attendance.instructionalDaysYtd} days · {learner.attendance.instructionalHoursYtd}h YTD</span></td>
      <td className="px-4 py-3"><MasteryValue mastery={learner.mastery} /></td>
      <td className="px-4 py-3"><StudyValue study={learner.study} /></td>
      <td className="px-4 py-3 text-slate-700">{learner.openReviewCount === 0 ? 'No open review' : `${learner.openReviewCount} open`} {learner.needsDadCount > 0 && <span className="block font-bold text-rose-700">Needs Dad {learner.needsDadCount}</span>}</td>
    </tr>
  )
}

function CompletionValue({ completion }: { completion: LearnerListItem['todayCompletion'] }) {
  if (completion.status === 'unavailable') return <Unavailable reason={completion.reason} />
  return <span className="font-semibold text-slate-800">{completion.value.completed}/{completion.value.total}<span className="block text-xs font-normal text-slate-500">{completion.value.percent}% complete</span></span>
}

function MasteryValue({ mastery }: { mastery: LearnerListItem['mastery'] }) {
  if (mastery.status === 'unavailable') return <Unavailable reason={mastery.reason} />
  return <span className="font-semibold text-slate-800">{mastery.value.mastered}/{mastery.value.total} mastered<span className="block text-xs font-normal text-slate-500">{mastery.value.developing} developing</span></span>
}

function StudyValue({ study }: { study: LearnerListItem['study'] }) {
  if (study.status === 'unavailable') return <Unavailable reason={study.reason} />
  return <span className="font-semibold text-slate-800">{study.value.completed} completed<span className="block text-xs font-normal text-slate-500">{study.value.resumeNeeded} resume needed</span></span>
}

function Unavailable({ reason }: { reason: LearnerEvidenceUnavailableReason }) {
  const labels: Record<LearnerEvidenceUnavailableReason, string> = {
    'not-recorded': 'Not recorded',
    'catalog-not-integrated': 'Catalog unavailable',
    'study-not-integrated': 'Study unavailable',
    'future-integration': 'Integration unavailable',
  }
  return <span className="font-semibold text-slate-400">— {labels[reason]}</span>
}

function LearnerDetailView({ detail }: { detail: LearnerDetail }) {
  return (
    <article id="learner-detail" className="space-y-5" aria-labelledby="learner-detail-title" aria-live="polite">
      <header className="rounded-2xl bg-slate-950 p-6 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Learner detail</p>
        <h2 id="learner-detail-title" className="mt-1 text-3xl font-bold">{detail.displayName}</h2>
        <p className="mt-1 text-slate-300">Nominal grade {detail.nominalGrade} · read-only evidence</p>
      </header>

      <DetailSection id="learning-title" title="Learning">
        <h4 className="font-bold text-slate-900">Working levels</h4>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {detail.workingLevels.map((level) => <div key={level.subject} className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{level.subjectLabel}</dt><dd className="mt-1 font-semibold text-slate-900">Grade {level.level}<span className="ml-1 text-xs font-normal text-slate-500">({level.source === 'explicit' ? 'assigned' : 'nominal default'})</span></dd></div>)}
        </dl>

        <h4 className="mt-5 font-bold text-slate-900">Courses and subjects</h4>
        {detail.courses.status === 'unavailable' ? <p className="mt-2"><Unavailable reason={detail.courses.reason} /></p> : detail.courses.value.length === 0 ? <EmptyEvidence>No course progress is recorded.</EmptyEvidence> : <ul className="mt-2 grid gap-3 md:grid-cols-2">{detail.courses.value.map((course) => <li key={course.courseRef} className="rounded-xl border border-slate-200 p-4"><p className="font-bold text-slate-900">{course.title}{course.workingLevel && <span className="ml-2 text-xs text-slate-500">Grade {course.workingLevel}</span>}</p><p className="mt-1 text-sm text-slate-600">{course.completed}/{course.total} complete{course.mastered !== null ? ` · ${course.mastered} mastered` : ''}{course.reteach ? ` · ${course.reteach} reteach` : ''}</p><Progress completed={course.completed} total={course.total} /></li>)}</ul>}

        <h4 className="mt-5 font-bold text-slate-900">Math mastery</h4>
        {detail.mathMastery.length === 0 ? <EmptyEvidence>No app-scored math skill set is available for this grade.</EmptyEvidence> : <div className="mt-2 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="text-xs uppercase tracking-wide text-slate-500"><th className="p-2" scope="col">Skill</th><th className="p-2" scope="col">Status</th><th className="p-2" scope="col">Mastery</th><th className="p-2" scope="col">Evidence</th></tr></thead><tbody>{detail.mathMastery.map((skill) => <tr className="border-t" key={skill.skillRef}><th className="p-2 font-semibold" scope="row">{skill.skillName}</th><td className="p-2 capitalize">{skill.status.replace('-', ' ')}</td><td className="p-2">{skill.attempts === 0 ? '—' : `${skill.mastery}%`}</td><td className="p-2 text-slate-600">{skill.correct}/{skill.attempts} correct{skill.lastSeen ? ` · ${skill.lastSeen}` : ''}</td></tr>)}</tbody></table></div>}

        {detail.manualMasterySnapshots.length > 0 && <><h4 className="mt-5 font-bold text-slate-900">Manual mastery snapshots</h4><ul className="mt-2 space-y-2">{detail.manualMasterySnapshots.map((snapshot, index) => <li key={`${snapshot.at}-${index}`} className="rounded-lg bg-slate-50 p-3 text-sm"><span className="font-bold">{snapshot.subject}: {snapshot.level}</span><span className="ml-2 text-slate-500">{formatDate(snapshot.at)}</span></li>)}</ul></>}

        <h4 className="mt-5 font-bold text-slate-900">Recent instructional evidence</h4>
        {detail.recentEvidence.length === 0 ? <EmptyEvidence>No recent learning evidence is recorded.</EmptyEvidence> : <ol className="mt-2 space-y-2">{detail.recentEvidence.map((item, index) => <li key={`${item.at}-${item.kind}-${index}`} className="flex gap-3 rounded-lg border border-slate-200 p-3"><time className="shrink-0 text-xs font-semibold text-slate-500">{formatDate(item.at)}</time><p className="text-sm"><span className="font-bold text-slate-900">{item.title}</span><span className="block text-slate-600">{item.summary}</span></p></li>)}</ol>}
      </DetailSection>

      <DetailSection id="assessment-title" title="Assessment">
        {detail.assessments.length === 0 ? <EmptyEvidence>No assessment is assigned or attempted.</EmptyEvidence> : <ul className="grid gap-3 md:grid-cols-2">{detail.assessments.map((assessment) => <AssessmentCard key={`${assessment.source}-${assessment.assessmentRef}`} assessment={assessment} />)}</ul>}
      </DetailSection>

      <DetailSection id="study-title" title="Study">
        {detail.study.status === 'unavailable' ? <IntegrationEmpty title="Study evidence unavailable">The authorized Study read integration is not connected. Missing evidence is not reported as zero.</IntegrationEmpty> : <StudyDetail summary={detail.study.value.summary} detail={detail} />}
      </DetailSection>

      <DetailSection id="attendance-title" title="Attendance">
        <dl className="grid gap-3 sm:grid-cols-3"><Stat label="Instructional days YTD" value={String(detail.attendance.instructionalDaysYtd)} /><Stat label="Instructional hours YTD" value={`${detail.attendance.instructionalHoursYtd}h`} /><Stat label="Today" value={detail.attendance.recordedToday ? 'Recorded' : 'Not recorded'} /></dl>
        {detail.attendance.recentDays.length === 0 ? <EmptyEvidence>No instructional attendance days are recorded.</EmptyEvidence> : <ul className="mt-4 flex flex-wrap gap-2">{detail.attendance.recentDays.map((day) => <li key={day.date} className="rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="font-bold">{day.date}</span> · {day.hours}h</li>)}</ul>}
      </DetailSection>

      <DetailSection id="interventions-title" title="Interventions">
        {detail.interventions.needsDad.length === 0 && detail.interventions.adultReviews.length === 0 && detail.interventions.localAdultReviewRequests === 0 && detail.interventions.academyReteachCount === 0 ? <EmptyEvidence>No open instructional intervention is recorded.</EmptyEvidence> : <div className="space-y-4">
          {detail.interventions.needsDad.length > 0 && <div><h4 className="font-bold text-rose-800">Needs Dad</h4><ul className="mt-2 space-y-2">{detail.interventions.needsDad.map((flag) => <li className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm" key={flag.skillRef}><span className="font-bold text-rose-900">{flag.skillName}</span> · since {flag.since}<span className="block text-rose-700">{flag.supportSignal === 'repeated-walkthroughs' ? 'Repeated walkthrough support' : 'Tutor review requested'}</span></li>)}</ul></div>}
          {detail.interventions.adultReviews.length > 0 && <div><h4 className="font-bold">Adult review recommendations</h4><ul className="mt-2 space-y-2">{detail.interventions.adultReviews.map((review) => <li className="rounded-lg bg-slate-50 p-3 text-sm" key={review.reviewRef}><span className="font-bold">{review.status}</span> · due {review.dueDate}<span className="block text-slate-600">{review.reasonCodes.join(' · ')}</span></li>)}</ul></div>}
          {detail.interventions.localAdultReviewRequests > 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">{detail.interventions.localAdultReviewRequests} local adult-review request{detail.interventions.localAdultReviewRequests === 1 ? '' : 's'} not delivered.</p>}
          {detail.interventions.academyReteachCount > 0 && <p className="rounded-lg bg-indigo-50 p-3 text-sm font-semibold text-indigo-900">{detail.interventions.academyReteachCount} Academy lesson{detail.interventions.academyReteachCount === 1 ? '' : 's'} in reteach.</p>}
        </div>}
      </DetailSection>

      <DetailSection id="future-title" title="Future integrations">
        <div className="grid gap-3 md:grid-cols-2"><IntegrationEmpty title="Operational telemetry">Unavailable until the authorized operational telemetry connection is available.</IntegrationEmpty><IntegrationEmpty title="AI cost per learner">Unavailable until reconciled learner attribution is available. No usage or cost is inferred here.</IntegrationEmpty></div>
      </DetailSection>
    </article>
  )
}

function DetailSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby={id}><h3 id={id} className="text-xl font-bold text-slate-950">{title}</h3><div className="mt-4">{children}</div></section>
}

function AssessmentCard({ assessment }: { assessment: AssessmentEvidence }) {
  return <li className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{assessment.source === 'academy' ? 'Academy assessment' : 'Assigned assessment'}</p><h4 className="mt-1 font-bold text-slate-950">{assessment.title}</h4><dl className="mt-3 grid grid-cols-2 gap-2 text-sm"><div><dt className="text-slate-500">Status</dt><dd className="font-semibold capitalize">{assessment.status.replace('-', ' ')}</dd></div><div><dt className="text-slate-500">Attempts</dt><dd className="font-semibold">{assessment.attemptCount}</dd></div><div><dt className="text-slate-500">Score/mastery</dt><dd className="font-semibold">{assessment.percent !== null ? `${assessment.percent}%${assessment.masteryOutcome ? ` · ${assessment.masteryOutcome}` : ''}` : 'Not available'}</dd></div><div><dt className="text-slate-500">Retake</dt><dd className="font-semibold capitalize">{assessment.retakeStatus.replace('-', ' ')}</dd></div></dl>{assessment.requiresAdultScoring && <p className="mt-3 rounded bg-amber-50 p-2 text-sm font-semibold text-amber-900">Adult scoring remains.</p>}</li>
}

function StudyDetail({ summary, detail }: { summary: StudySummary; detail: LearnerDetail }) {
  if (detail.study.status !== 'available') return null
  return <><dl className="grid gap-3 sm:grid-cols-4"><Stat label="Scheduled" value={String(summary.scheduled)} /><Stat label="Completed" value={String(summary.completed)} /><Stat label="Resume needed" value={String(summary.resumeNeeded)} /><Stat label="Review queue" value={String(summary.pendingReviews)} /></dl>{detail.study.value.workBlock ? <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><span className="font-bold">Work block:</span> up to {detail.study.value.workBlock.maximumWorkMinutes} minutes · {detail.study.value.workBlock.breakMinutes}-minute breaks · timer {detail.study.value.workBlock.timerHidden ? 'hidden' : 'shown'} · {detail.study.value.workBlock.accommodations} functional support{detail.study.value.workBlock.accommodations === 1 ? '' : 's'}</p> : <p className="mt-4"><Unavailable reason="not-recorded" /> <span className="text-sm text-slate-600">Work-block configuration</span></p>}{detail.study.value.calendar.length === 0 ? <EmptyEvidence>No Study block is scheduled or recorded.</EmptyEvidence> : <ul className="mt-4 space-y-2">{detail.study.value.calendar.map((entry) => <li className="rounded-lg border border-slate-200 p-3 text-sm" key={entry.blockRef}><span className="font-bold">{entry.title}</span> · {entry.intendedLocalDate}<span className="block text-slate-600">{entry.state === 'paused' ? `Resume needed · ${entry.requiredWorkCompletionPercent}% complete · ${entry.estimatedRemainingMinutes} min remaining` : entry.state}</span></li>)}</ul>}</>
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-xl font-bold text-slate-950">{value}</dd></div>
}

function Progress({ completed, total }: { completed: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100)
  return <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Course completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><div className="h-full bg-sky-600" style={{ width: `${percent}%` }} /></div>
}

function EmptyEvidence({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{children}</p>
}

function IntegrationEmpty({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4"><h4 className="font-bold text-slate-800">{title}</h4><p className="mt-1 text-sm text-slate-600">{children}</p></div>
}

function formatDate(value: string): string {
  return value.slice(0, 10)
}

function formatDateTime(value: string): string {
  return value.replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')
}
