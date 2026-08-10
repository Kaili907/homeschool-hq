import { useEffect, useState, type KeyboardEvent } from 'react'
import type {
  AssessmentEvidence,
  CurriculumEnrollmentEvidence,
  LearnerAnalyticsViewState,
  LearnerDetail,
  LearnerEvidenceUnavailableReason,
  LearnerEvidenceValue,
  LearnerListItem,
  LearnerOperationalAvailability,
  StudySummary,
} from '../../admin/learnerAnalyticsModel'

export type LearnerOperationsFilter = 'all' | 'needs-attention' | 'enrolled' | 'not-configured'

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

export function filterLearnerOperations(
  learners: readonly LearnerListItem[],
  query: string,
  filter: LearnerOperationsFilter,
): LearnerListItem[] {
  const normalized = query.trim().toLocaleLowerCase()
  return learners.filter((learner) => {
    const matchesQuery = normalized === '' || [
      learner.displayName,
      learner.learnerRef,
      `grade ${learner.nominalGrade}`,
      ...learner.workingLevels.map((level) => `${level.subjectLabel} grade ${level.level}`),
    ].some((value) => value.toLocaleLowerCase().includes(normalized))
    if (!matchesQuery) return false
    if (filter === 'needs-attention') return learner.openReviewCount > 0 || learner.curriculum.status === 'partial'
    if (filter === 'enrolled') return learner.curriculum.status === 'available' || learner.curriculum.status === 'partial'
    if (filter === 'not-configured') return learner.curriculum.status === 'not-configured'
    return true
  })
}

export function LearnerAnalytics({
  state,
  initialLearnerRef,
  selectedLearnerRef,
  onLearnerSelect,
  onRetry,
}: {
  state: LearnerAnalyticsViewState
  initialLearnerRef?: string
  selectedLearnerRef?: string | null
  onLearnerSelect?: (learnerRef: string | null) => void
  onRetry?: () => void
}) {
  const [localSelectedRef, setLocalSelectedRef] = useState(initialLearnerRef ?? '')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<LearnerOperationsFilter>('all')

  if (state.status === 'resolving') {
    return <AccessState busy title="Verifying learner access" message="Learner operations stay private until administrator authorization is confirmed." />
  }
  if (state.status === 'unauthorized') {
    return <AccessState title="Learner operations unavailable" message="The canonical learners:read capability is required. General Admin access does not grant learner detail access." backToAcademy />
  }
  if (state.status === 'loading') {
    return <AccessState busy title="Loading learner operations" message="Reading the bounded, authorized learner projection." />
  }
  if (state.status === 'error') {
    return <AccessState title="Learner operations unavailable" message={state.message} alert onRetry={onRetry} />
  }

  const { learners, details, observedAt } = state.snapshot
  if (learners.length === 0) return <AuthorizedEmptyState observedAt={observedAt} />

  const controlledSelection = selectedLearnerRef !== undefined
  const selectedRef = controlledSelection
    ? selectedLearnerRef ?? ''
    : localSelectedRef || learners[0]?.learnerRef || ''
  const selected = selectedRef ? details[selectedRef] : undefined
  const visibleLearners = filterLearnerOperations(learners, query, filter)
  const visibleRefs = visibleLearners.map((learner) => learner.learnerRef)

  function selectLearner(learnerRef: string | null) {
    setLocalSelectedRef(learnerRef ?? '')
    onLearnerSelect?.(learnerRef)
  }

  return (
    <div className="space-y-6" aria-labelledby="learner-operations-title">
      <header className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Admin console</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 id="learner-operations-title" className="text-3xl font-bold text-slate-950">Learner operations</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">Read-only operational evidence from trusted learner state. Conversations, prompts, answers, essays, journals, audio, private notes, and diagnostic inference are structurally absent.</p>
          </div>
          <p className="text-xs font-semibold text-slate-500">Observed {formatDateTime(observedAt)}</p>
        </div>
        <AvailabilityLegend />
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-labelledby="learner-list-title">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="learner-list-title" className="text-xl font-bold text-slate-950">Learners</h2>
              <p className="mt-1 text-sm text-slate-600">Choose a learner to open the routed operations detail.</p>
            </div>
            <p className="text-sm font-semibold text-slate-500" role="status">{visibleLearners.length} of {learners.length} learners</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
            <label className="text-sm font-semibold text-slate-700">
              Search learners
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, reference, grade, or subject"
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-950 outline-offset-2 focus-visible:outline-2 focus-visible:outline-sky-700"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Operational filter
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as LearnerOperationsFilter)}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-950 outline-offset-2 focus-visible:outline-2 focus-visible:outline-sky-700"
              >
                <option value="all">All learners</option>
                <option value="needs-attention">Needs attention</option>
                <option value="enrolled">Curriculum enrolled</option>
                <option value="not-configured">Curriculum not configured</option>
              </select>
            </label>
          </div>
        </div>

        {visibleLearners.length === 0 ? (
          <div className="p-6" role="status">
            <h3 className="font-bold text-slate-950">No matching learners</h3>
            <p className="mt-1 text-sm text-slate-600">No authorized learner matches the current search and filter. The underlying learner list has not been changed.</p>
            <button type="button" onClick={() => { setQuery(''); setFilter('all') }} className="mt-4 min-h-11 rounded-lg border border-slate-400 px-4 py-2 font-bold text-slate-900">Clear filters</button>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3" scope="col">Learner</th>
                    <th className="px-4 py-3" scope="col">Curriculum</th>
                    <th className="px-4 py-3" scope="col">Today</th>
                    <th className="px-4 py-3" scope="col">Progress / mastery</th>
                    <th className="px-4 py-3" scope="col">Study</th>
                    <th className="px-4 py-3" scope="col">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLearners.map((learner, index) => (
                    <LearnerRow
                      key={learner.learnerRef}
                      learner={learner}
                      selected={learner.learnerRef === selectedRef}
                      tabStop={learner.learnerRef === selectedRef || (!selectedRef && index === 0)}
                      allRefs={visibleRefs}
                      onSelect={selectLearner}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="grid gap-3 p-4 md:hidden" aria-label="Learner cards">
              {visibleLearners.map((learner, index) => (
                <LearnerCard
                  key={learner.learnerRef}
                  learner={learner}
                  selected={learner.learnerRef === selectedRef}
                  tabStop={learner.learnerRef === selectedRef || (!selectedRef && index === 0)}
                  onSelect={selectLearner}
                />
              ))}
            </ul>
          </>
        )}
      </section>

      {!selectedRef ? (
        <section id="learner-detail" className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center" aria-labelledby="learner-detail-prompt">
          <h2 id="learner-detail-prompt" className="text-xl font-bold text-slate-900">Select a learner</h2>
          <p className="mt-2 text-slate-600">The learner detail remains closed until an authorized record is selected.</p>
        </section>
      ) : selected ? (
        <LearnerDetailView detail={selected} onBack={controlledSelection ? () => selectLearner(null) : undefined} />
      ) : (
        <section id="learner-detail" className="rounded-2xl border border-amber-200 bg-amber-50 p-6" role="status" aria-labelledby="learner-unavailable-title">
          <StatusBadge status="unavailable" />
          <h2 id="learner-unavailable-title" className="mt-2 text-xl font-bold text-amber-950">Learner detail unavailable</h2>
          <p className="mt-1 text-amber-900">This learner reference is not present in the authorized household projection.</p>
          <button type="button" onClick={() => selectLearner(null)} className="mt-4 min-h-11 rounded-lg border border-amber-700 px-4 py-2 font-bold text-amber-950">Back to learners</button>
        </section>
      )}
    </div>
  )
}

function AuthorizedEmptyState({ observedAt }: { observedAt: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6" aria-labelledby="learner-operations-title">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Admin console</p>
      <h1 id="learner-operations-title" className="mt-1 text-3xl font-bold text-slate-950">Learner operations</h1>
      <StatusBadge status="not-configured" className="mt-4" />
      <p className="mt-2 text-slate-600">No learner records are available to this authorized view.</p>
      <p className="mt-2 text-xs font-semibold text-slate-500">Observed {formatDateTime(observedAt)}</p>
    </div>
  )
}

function AccessState({ busy = false, title, message, alert = false, onRetry, backToAcademy = false }: { busy?: boolean; title: string; message: string; alert?: boolean; onRetry?: () => void; backToAcademy?: boolean }) {
  return (
    <div className="flex min-h-72 items-center justify-center rounded-2xl border border-slate-200 bg-white p-6" aria-busy={busy}>
      <section className="max-w-lg text-center" aria-live="polite" role={alert ? 'alert' : undefined}>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Learner operations</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">{title}</h1>
        <p className="mt-2 text-slate-600">{message}</p>
        {onRetry && <button type="button" onClick={onRetry} className="mt-4 min-h-11 rounded-lg bg-slate-950 px-4 py-2 font-bold text-white">Try again</button>}
        {backToAcademy && <a href="/academy" className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-slate-400 px-4 py-2 font-bold text-slate-900">Back to Academy</a>}
      </section>
    </div>
  )
}

function LearnerRow({ learner, selected, tabStop, allRefs, onSelect }: { learner: LearnerListItem; selected: boolean; tabStop: boolean; allRefs: readonly string[]; onSelect: (ref: string) => void }) {
  const handleKey = (event: KeyboardEvent<HTMLAnchorElement>) => {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = moveLearnerSelection(allRefs, learner.learnerRef, event.key as 'ArrowUp' | 'ArrowDown' | 'Home' | 'End')
    onSelect(next)
    const links = event.currentTarget.closest('tbody')?.querySelectorAll<HTMLAnchorElement>('[data-learner-ref]') ?? []
    Array.from(links).find((link) => link.dataset.learnerRef === next)?.focus()
  }
  return (
    <tr className={`border-t border-slate-100 ${selected ? 'bg-sky-50' : ''}`}>
      <th className="px-4 py-3" scope="row">
        <LearnerDetailLink learner={learner} selected={selected} tabStop={tabStop} onSelect={onSelect} onKeyDown={handleKey} />
      </th>
      <td className="px-4 py-3"><CurriculumListValue curriculum={learner.curriculum} /></td>
      <td className="px-4 py-3"><CompletionValue completion={learner.todayCompletion} /></td>
      <td className="px-4 py-3"><MasteryValue mastery={learner.mastery} /></td>
      <td className="px-4 py-3"><StudyValue study={learner.study} /></td>
      <td className="px-4 py-3 text-slate-700">{learner.openReviewCount === 0 ? 'No open flags' : `${learner.openReviewCount} open`} {learner.needsDadCount > 0 && <span className="block font-bold text-rose-700">Needs Dad {learner.needsDadCount}</span>}</td>
    </tr>
  )
}

function LearnerCard({ learner, selected, tabStop, onSelect }: { learner: LearnerListItem; selected: boolean; tabStop: boolean; onSelect: (ref: string) => void }) {
  return (
    <li className={`rounded-xl border p-4 ${selected ? 'border-sky-500 bg-sky-50' : 'border-slate-200'}`}>
      <LearnerDetailLink learner={learner} selected={selected} tabStop={tabStop} onSelect={onSelect} />
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-slate-500">Curriculum</dt><dd className="font-semibold"><CurriculumListValue curriculum={learner.curriculum} /></dd></div>
        <div><dt className="text-slate-500">Today</dt><dd><CompletionValue completion={learner.todayCompletion} /></dd></div>
        <div><dt className="text-slate-500">Mastery</dt><dd><MasteryValue mastery={learner.mastery} /></dd></div>
        <div><dt className="text-slate-500">Flags</dt><dd className="font-semibold">{learner.openReviewCount}</dd></div>
      </dl>
    </li>
  )
}

function LearnerDetailLink({ learner, selected, tabStop, onSelect, onKeyDown }: { learner: LearnerListItem; selected: boolean; tabStop: boolean; onSelect: (ref: string) => void; onKeyDown?: (event: KeyboardEvent<HTMLAnchorElement>) => void }) {
  return (
    <a
      href={`/academy/admin/learners/${encodeURIComponent(learner.learnerRef)}`}
      data-learner-ref={learner.learnerRef}
      aria-current={selected ? 'page' : undefined}
      aria-controls="learner-detail"
      tabIndex={tabStop ? 0 : -1}
      onClick={(event) => { event.preventDefault(); onSelect(learner.learnerRef) }}
      onKeyDown={onKeyDown}
      className="inline-flex min-h-11 items-center rounded-lg px-2 text-left font-bold text-sky-800 outline-offset-2 hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-sky-700"
    >
      <span>{learner.displayName}<span className="block text-xs font-semibold text-slate-500">{learner.learnerRef} · Grade {learner.nominalGrade}</span></span>
    </a>
  )
}

function CurriculumListValue({ curriculum }: { curriculum: CurriculumEnrollmentEvidence }) {
  if (curriculum.status === 'not-configured') return <span className="text-slate-500">Not configured</span>
  return <span className="font-semibold text-slate-800">Release {curriculum.releaseVersion}<span className="block text-xs font-normal text-slate-500">{curriculum.status === 'partial' ? 'Partial catalog match' : `${curriculum.enrolledCourseCount} courses`}</span></span>
}

function CompletionValue({ completion }: { completion: LearnerListItem['todayCompletion'] }) {
  if (completion.status !== 'available' && completion.status !== 'partial') return <EvidenceLabel evidence={completion} />
  return <span className="font-semibold text-slate-800">{completion.value.completed}/{completion.value.total}<span className="block text-xs font-normal text-slate-500">{completion.value.percent}% complete</span></span>
}

function MasteryValue({ mastery }: { mastery: LearnerListItem['mastery'] }) {
  if (mastery.status !== 'available' && mastery.status !== 'partial') return <EvidenceLabel evidence={mastery} />
  return <span className="font-semibold text-slate-800">{mastery.value.mastered}/{mastery.value.total} mastered<span className="block text-xs font-normal text-slate-500">{mastery.value.developing} developing</span></span>
}

function StudyValue({ study }: { study: LearnerListItem['study'] }) {
  if (study.status !== 'available' && study.status !== 'partial') return <EvidenceLabel evidence={study} />
  return <span className="font-semibold text-slate-800">{study.value.completed} completed<span className="block text-xs font-normal text-slate-500">{study.value.resumeNeeded} resume needed</span></span>
}

function EvidenceLabel({ evidence }: { evidence: Exclude<LearnerEvidenceValue<unknown>, { status: 'available' | 'partial' }> }) {
  return <span className="font-semibold text-slate-500">{reasonLabel(evidence.reason)}</span>
}

function LearnerDetailView({ detail, onBack }: { detail: LearnerDetail; onBack?: () => void }) {
  useEffect(() => {
    document.getElementById('learner-detail-title')?.focus()
  }, [detail.learnerRef])
  return (
    <article id="learner-detail" className="space-y-5" aria-labelledby="learner-detail-title" aria-live="polite">
      <header className="rounded-2xl bg-slate-950 p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Learner operations detail</p>
            <h2 id="learner-detail-title" tabIndex={-1} className="mt-1 text-3xl font-bold outline-none">{detail.displayName}</h2>
            <p className="mt-1 text-slate-300">Reference {detail.learnerRef} · nominal grade {detail.nominalGrade} · read only</p>
          </div>
          {onBack && <button type="button" onClick={onBack} className="min-h-11 rounded-lg border border-slate-500 px-4 py-2 font-bold text-white hover:bg-slate-800">Back to learners</button>}
        </div>
      </header>

      <DetailSection id="learner-overview-title" title="Overview" status={detail.availability.overview}>
        <dl className="grid gap-3 sm:grid-cols-3">
          <Stat label="Operational reference" value={detail.learnerRef} />
          <Stat label="Assigned grade" value={`Grade ${detail.nominalGrade}`} />
          <Stat label="Enrollment" value={detail.curriculum.status === 'not-configured' ? 'Not configured' : `Grade ${detail.curriculum.grade}`} />
        </dl>
        <h4 className="mt-5 font-bold text-slate-900">Official working levels</h4>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {detail.workingLevels.map((level) => <div key={level.subject} className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{level.subjectLabel}</dt><dd className="mt-1 font-semibold text-slate-900">Grade {level.level}<span className="ml-1 text-xs font-normal text-slate-500">({level.source === 'explicit' ? 'assigned' : 'nominal default'})</span></dd></div>)}
        </dl>
      </DetailSection>

      <DetailSection id="learner-curriculum-title" title="Curriculum" status={detail.availability.curriculum} action={<a href="/academy/admin/curriculum" className="font-bold text-sky-800 underline-offset-4 hover:underline">Open curriculum</a>}>
        <EnrollmentDetail enrollment={detail.curriculum} />
        <h4 className="mt-5 font-bold text-slate-900">Course progress</h4>
        <CourseProgress evidence={detail.courses} />
      </DetailSection>

      <DetailSection id="learner-progress-title" title="Progress / Mastery" status={detail.availability.progress}>
        <h4 className="font-bold text-slate-900">Math mastery</h4>
        {detail.mathMastery.length === 0 ? <EmptyEvidence>No app-scored math skill set is available for this grade.</EmptyEvidence> : <div className="mt-2 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="text-xs uppercase tracking-wide text-slate-500"><th className="p-2" scope="col">Skill</th><th className="p-2" scope="col">Status</th><th className="p-2" scope="col">Mastery</th><th className="p-2" scope="col">Evidence</th></tr></thead><tbody>{detail.mathMastery.map((skill) => <tr className="border-t" key={skill.skillRef}><th className="p-2 font-semibold" scope="row">{skill.skillName}</th><td className="p-2 capitalize">{skill.status.replace('-', ' ')}</td><td className="p-2">{skill.attempts === 0 ? 'Not started' : `${skill.mastery}%`}</td><td className="p-2 text-slate-600">{skill.correct}/{skill.attempts} correct{skill.lastSeen ? ` · ${skill.lastSeen}` : ''}</td></tr>)}</tbody></table></div>}
        {detail.manualMasterySnapshots.length > 0 && <><h4 className="mt-5 font-bold text-slate-900">Manual mastery snapshots</h4><ul className="mt-2 space-y-2">{detail.manualMasterySnapshots.map((snapshot, index) => <li key={`${snapshot.at}-${index}`} className="rounded-lg bg-slate-50 p-3 text-sm"><span className="font-bold">{snapshot.subject}: {snapshot.level}</span><span className="ml-2 text-slate-500">{formatDate(snapshot.at)}</span></li>)}</ul></>}
      </DetailSection>

      <DetailSection id="learner-assessments-title" title="Assessments" status={detail.availability.assessments} action={<a href="/academy/admin/engines/assessment" className="font-bold text-sky-800 underline-offset-4 hover:underline">Assessment operations</a>}>
        {detail.assessments.length === 0 ? <EmptyEvidence>No assessment is assigned or attempted. This is not reported as a zero score.</EmptyEvidence> : <ul className="grid gap-3 md:grid-cols-2">{detail.assessments.map((assessment) => <AssessmentCard key={`${assessment.source}-${assessment.assessmentRef}`} assessment={assessment} />)}</ul>}
      </DetailSection>

      <DetailSection id="learner-study-title" title="Study" status={detail.availability.study} action={<a href="/academy/admin/engines/study" className="font-bold text-sky-800 underline-offset-4 hover:underline">Study operations</a>}>
        {detail.study.status === 'unavailable' ? <IntegrationEmpty title="Study evidence unavailable">The authorized learner-level Study read integration is not connected. Missing evidence is not reported as zero or not configured.</IntegrationEmpty> : detail.study.status === 'available' || detail.study.status === 'partial' ? <StudyDetail summary={detail.study.value.summary} detail={detail} /> : <EmptyEvidence>{reasonLabel(detail.study.reason)}</EmptyEvidence>}
      </DetailSection>

      <DetailSection id="learner-operational-title" title="Operational status" status={detail.availability.operationalStatus} action={<a href="/academy/admin/safety" className="font-bold text-sky-800 underline-offset-4 hover:underline">Safety operations</a>}>
        <h4 className="font-bold text-slate-900">Attendance</h4>
        <dl className="mt-2 grid gap-3 sm:grid-cols-3"><Stat label="Instructional days YTD" value={String(detail.attendance.instructionalDaysYtd)} /><Stat label="Instructional hours YTD" value={`${detail.attendance.instructionalHoursYtd}h`} /><Stat label="Today" value={detail.attendance.recordedToday ? 'Recorded' : 'Not recorded'} /></dl>
        {detail.attendance.recentDays.length === 0 ? <EmptyEvidence>No instructional attendance days are recorded.</EmptyEvidence> : <ul className="mt-4 flex flex-wrap gap-2">{detail.attendance.recentDays.map((day) => <li key={day.date} className="rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="font-bold">{day.date}</span> · {day.hours}h</li>)}</ul>}

        <h4 className="mt-6 font-bold text-slate-900">Unresolved safe flags</h4>
        <Interventions detail={detail} />

        <h4 className="mt-6 font-bold text-slate-900">Recent operational activity</h4>
        {detail.recentEvidence.length === 0 ? <EmptyEvidence>No recent learning activity is recorded.</EmptyEvidence> : <ol className="mt-2 space-y-2">{detail.recentEvidence.map((item, index) => <li key={`${item.at}-${item.kind}-${index}`} className="flex gap-3 rounded-lg border border-slate-200 p-3"><time className="shrink-0 text-xs font-semibold text-slate-500">{formatDate(item.at)}</time><p className="text-sm"><span className="font-bold text-slate-900">{item.title}</span><span className="block text-slate-600">{item.summary}</span></p></li>)}</ol>}

        <div className="mt-6 grid gap-3 md:grid-cols-2"><IntegrationEmpty title="Operational telemetry unavailable">Only the bounded profile activity above is shown; learner-attributed operational telemetry is not connected.</IntegrationEmpty><IntegrationEmpty title="Learner cost unavailable">Reconciled learner attribution is not connected. Usage and cost are not inferred.</IntegrationEmpty></div>
      </DetailSection>
    </article>
  )
}

function AvailabilityLegend() {
  return (
    <details className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
      <summary className="cursor-pointer font-bold text-slate-900">Data state meanings</summary>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <li><StatusBadge status="available" /><span className="mt-1 block">Trusted projection is present.</span></li>
        <li><StatusBadge status="partial" /><span className="mt-1 block">Some trusted evidence is present.</span></li>
        <li><StatusBadge status="unavailable" /><span className="mt-1 block">A trusted source cannot be read.</span></li>
        <li><StatusBadge status="not-configured" /><span className="mt-1 block">No authoritative setup or record exists.</span></li>
        <li><StatusBadge status="not-applicable" /><span className="mt-1 block">The operation does not apply.</span></li>
      </ul>
    </details>
  )
}

function DetailSection({ id, title, status, action, children }: { id: string; title: string; status: LearnerOperationalAvailability; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby={id}><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-3"><h3 id={id} className="text-xl font-bold text-slate-950">{title}</h3><StatusBadge status={status} /></div>{action}</div><div className="mt-4">{children}</div></section>
}

function StatusBadge({ status, className = '' }: { status: LearnerOperationalAvailability; className?: string }) {
  const labels: Record<LearnerOperationalAvailability, string> = {
    available: 'Available', partial: 'Partial', unavailable: 'Unavailable',
    'not-configured': 'Not configured', 'not-applicable': 'Not applicable',
  }
  const colors: Record<LearnerOperationalAvailability, string> = {
    available: 'bg-emerald-100 text-emerald-800', partial: 'bg-amber-100 text-amber-900',
    unavailable: 'bg-slate-200 text-slate-700', 'not-configured': 'bg-violet-100 text-violet-800',
    'not-applicable': 'bg-sky-100 text-sky-800',
  }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${colors[status]} ${className}`}>{labels[status]}</span>
}

function EnrollmentDetail({ enrollment }: { enrollment: CurriculumEnrollmentEvidence }) {
  if (enrollment.status === 'not-configured') return <EmptyEvidence>Academy curriculum enrollment is not configured for this learner. No release pin or course assignment is invented.</EmptyEvidence>
  return (
    <div>
      {enrollment.status === 'partial' && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">Enrollment and release pin are authoritative, but {enrollment.matchedCourseCount} of {enrollment.enrolledCourseCount} course references match the loaded catalog.</p>}
      <dl className="grid gap-3 sm:grid-cols-4">
        <Stat label="Enrollment state" value="Enrolled" />
        <Stat label="Curriculum release pin" value={enrollment.releaseVersion} />
        <Stat label="Curriculum grade" value={`Grade ${enrollment.grade}`} />
        <Stat label="Enrolled" value={formatDate(enrollment.enrolledAt)} />
      </dl>
    </div>
  )
}

function CourseProgress({ evidence }: { evidence: LearnerDetail['courses'] }) {
  if (evidence.status === 'unavailable') return <IntegrationEmpty title="Course progress unavailable">{reasonLabel(evidence.reason)}</IntegrationEmpty>
  if (evidence.status === 'not-configured' || evidence.status === 'not-applicable') return <EmptyEvidence>{reasonLabel(evidence.reason)}</EmptyEvidence>
  return (
    <>
      {evidence.status === 'partial' && <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">Only catalog-matched course progress is shown. Unknown course references are not inferred.</p>}
      {evidence.value.length === 0 ? <EmptyEvidence>No catalog-matched course progress is recorded.</EmptyEvidence> : <ul className="mt-2 grid gap-3 md:grid-cols-2">{evidence.value.map((course) => <li key={`${course.source}-${course.courseRef}`} className="rounded-xl border border-slate-200 p-4"><p className="font-bold text-slate-900">{course.title}{course.workingLevel && <span className="ml-2 text-xs text-slate-500">Grade {course.workingLevel}</span>}</p><p className="mt-1 text-sm text-slate-600">{course.completed}/{course.total} complete{course.mastered !== null ? ` · ${course.mastered} mastered` : ''}{course.reteach ? ` · ${course.reteach} reteach` : ''}</p><Progress completed={course.completed} total={course.total} /></li>)}</ul>}
    </>
  )
}

function AssessmentCard({ assessment }: { assessment: AssessmentEvidence }) {
  const retakeAvailability: LearnerOperationalAvailability = assessment.retakeStatus === 'unavailable'
    ? 'unavailable'
    : assessment.retakeStatus === 'not-applicable'
      ? 'not-applicable'
      : 'available'
  return <li className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{assessment.source === 'academy' ? 'Academy assessment' : 'Assigned assessment'}</p><h4 className="mt-1 font-bold text-slate-950">{assessment.title}</h4><dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500">Status</dt><dd className="font-semibold capitalize">{assessment.status.replace('-', ' ')}</dd></div><div><dt className="text-slate-500">Attempts</dt><dd className="font-semibold">{assessment.attemptCount}</dd></div><div><dt className="text-slate-500">Score / mastery</dt><dd className="font-semibold">{assessment.percent !== null ? `${assessment.percent}%${assessment.masteryOutcome ? ` · ${assessment.masteryOutcome}` : ''}` : 'Unavailable'}</dd></div><div><dt className="text-slate-500">Retake</dt><dd className="mt-1"><StatusBadge status={retakeAvailability} /><span className="ml-2 font-semibold capitalize">{assessment.retakeStatus.replace('-', ' ')}</span></dd></div></dl>{assessment.requiresAdultScoring && <p className="mt-3 rounded bg-amber-50 p-2 text-sm font-semibold text-amber-900">Adult scoring remains.</p>}</li>
}

function StudyDetail({ summary, detail }: { summary: StudySummary; detail: LearnerDetail }) {
  if (detail.study.status !== 'available' && detail.study.status !== 'partial') return null
  return <><dl className="grid gap-3 sm:grid-cols-4"><Stat label="Scheduled" value={String(summary.scheduled)} /><Stat label="Completed" value={String(summary.completed)} /><Stat label="Resume needed" value={String(summary.resumeNeeded)} /><Stat label="Review queue" value={String(summary.pendingReviews)} /></dl>{detail.study.value.workBlock ? <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><span className="font-bold">Work block:</span> up to {detail.study.value.workBlock.maximumWorkMinutes} minutes · {detail.study.value.workBlock.breakMinutes}-minute breaks · timer {detail.study.value.workBlock.timerHidden ? 'hidden' : 'shown'} · {detail.study.value.workBlock.accommodations} functional support{detail.study.value.workBlock.accommodations === 1 ? '' : 's'}</p> : <p className="mt-4"><StatusBadge status="not-configured" /> <span className="ml-2 text-sm text-slate-600">Work-block configuration</span></p>}{detail.study.value.calendar.length === 0 ? <EmptyEvidence>No Study block is scheduled or recorded.</EmptyEvidence> : <ul className="mt-4 space-y-2">{detail.study.value.calendar.map((entry) => <li className="rounded-lg border border-slate-200 p-3 text-sm" key={entry.blockRef}><span className="font-bold">{entry.title}</span> · {entry.intendedLocalDate}<span className="block text-slate-600">{entry.state === 'paused' ? `Resume needed · ${entry.requiredWorkCompletionPercent}% complete · ${entry.estimatedRemainingMinutes} min remaining` : entry.state}</span></li>)}</ul>}</>
}

function Interventions({ detail }: { detail: LearnerDetail }) {
  const interventions = detail.interventions
  if (interventions.needsDad.length === 0 && interventions.adultReviews.length === 0 && interventions.localAdultReviewRequests === 0 && interventions.academyReteachCount === 0) return <EmptyEvidence>No open instructional intervention is recorded.</EmptyEvidence>
  return <div className="mt-2 space-y-4">
    {interventions.needsDad.length > 0 && <div><h5 className="font-bold text-rose-800">Needs Dad</h5><ul className="mt-2 space-y-2">{interventions.needsDad.map((flag) => <li className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm" key={flag.skillRef}><span className="font-bold text-rose-900">{flag.skillName}</span> · since {flag.since}<span className="block text-rose-700">{flag.supportSignal === 'repeated-walkthroughs' ? 'Repeated walkthrough support' : 'Tutor review requested'}</span></li>)}</ul></div>}
    {interventions.adultReviews.length > 0 && <div><h5 className="font-bold">Adult review recommendations</h5><ul className="mt-2 space-y-2">{interventions.adultReviews.map((review) => <li className="rounded-lg bg-slate-50 p-3 text-sm" key={review.reviewRef}><span className="font-bold">{review.status}</span> · due {review.dueDate}<span className="block text-slate-600">{review.reasonCodes.join(' · ')}</span></li>)}</ul></div>}
    {interventions.localAdultReviewRequests > 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">{interventions.localAdultReviewRequests} local adult-review request{interventions.localAdultReviewRequests === 1 ? '' : 's'} not delivered.</p>}
    {interventions.academyReteachCount > 0 && <p className="rounded-lg bg-indigo-50 p-3 text-sm font-semibold text-indigo-900">{interventions.academyReteachCount} Academy lesson{interventions.academyReteachCount === 1 ? '' : 's'} in reteach.</p>}
  </div>
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-lg font-bold text-slate-950">{value}</dd></div>
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

function reasonLabel(reason: LearnerEvidenceUnavailableReason): string {
  const labels: Record<LearnerEvidenceUnavailableReason, string> = {
    'not-recorded': 'Not recorded',
    'catalog-not-integrated': 'Catalog unavailable',
    'catalog-partially-integrated': 'Catalog partially available',
    'study-not-integrated': 'Study unavailable',
    'future-integration': 'Integration unavailable',
    'not-configured': 'Not configured',
    'not-applicable': 'Not applicable',
  }
  return labels[reason]
}

function formatDate(value: string): string {
  return value.slice(0, 10)
}

function formatDateTime(value: string): string {
  return value.replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')
}
