import { useState } from 'react'
import type { PreparedFirstLinkReview } from './coordinator'
import type { FirstLinkExecutionResult } from './types'

export interface ParentFirstLinkReviewProps {
  readonly review: PreparedFirstLinkReview
  readonly busy?: boolean
  readonly result?: FirstLinkExecutionResult | null
  readonly onStudentChoice: (localStudentRef: string, remoteStudentRef: string | null) => void
  readonly onConfirm: () => void
}

function stateLabel(state: PreparedFirstLinkReview['plan']['students'][number]['state']): string {
  if (state === 'EXACT_MATCH') return 'Link to existing student'
  if (state === 'NEW_REMOTE_STUDENT') return 'Create new hosted student'
  if (state === 'EXPLICIT_MAP_REQUIRED') return 'Parent choice required'
  return 'Conflict — linking blocked'
}

/**
 * Feature-gated/injected review only. This component is intentionally not
 * imported by FinalFamilyPilotApp or any production route.
 */
export function ParentFirstLinkReview({
  review,
  busy = false,
  result = null,
  onStudentChoice,
  onConfirm,
}: ParentFirstLinkReviewProps) {
  const [approved, setApproved] = useState(false)
  const totals = review.local.students.reduce((held, student) => ({
    assignments: held.assignments + student.assignments.length,
    sessions: held.sessions + student.studyDocument.sessions.length,
    sources: held.sources + student.sources.length,
    attestations: held.attestations + student.attestations.length,
    safetyHolds: held.safetyHolds + student.safetyHolds.length,
  }), { assignments: 0, sessions: 0, sources: 0, attestations: 0, safetyHolds: 0 })

  return (
    <section aria-labelledby="first-link-title" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 id="first-link-title" className="text-xl font-semibold text-slate-950">Link this family’s existing Study work</h2>
      <p className="mt-2 text-sm text-slate-700">
        Review exactly which local students and work will become available across devices. Nothing on this device is replaced.
      </p>

      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-slate-500">Students</dt><dd className="font-semibold">{review.local.students.length}</dd></div>
        <div><dt className="text-slate-500">Assignments</dt><dd className="font-semibold">{totals.assignments}</dd></div>
        <div><dt className="text-slate-500">Study sessions</dt><dd className="font-semibold">{totals.sessions}</dd></div>
        <div><dt className="text-slate-500">Sources</dt><dd className="font-semibold">{totals.sources}</dd></div>
        <div><dt className="text-slate-500">Attestations</dt><dd className="font-semibold">{totals.attestations}</dd></div>
        <div><dt className="text-slate-500">Safety holds</dt><dd className="font-semibold">{totals.safetyHolds}</dd></div>
      </dl>

      <div className="mt-6 space-y-4">
        {review.plan.students.map((student) => {
          const remote = review.inspection.remoteStudents.find(
            (item) => item.remoteStudentRef === student.remoteStudentRef,
          )
          const localStudent = review.local.students.find(
            (item) => item.localStudentRef === student.localStudentRef,
          )
          return (
            <article key={student.localStudentRef} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-950">{student.displayName}</h3>
                <span className={student.state === 'CONFLICT' ? 'text-sm font-semibold text-red-700' : 'text-sm font-medium text-slate-700'}>
                  {stateLabel(student.state)}
                </span>
              </div>
              {remote ? <p className="mt-1 text-sm text-slate-600">Existing hosted student: {remote.displayName}</p> : null}
              <p className="mt-2 text-sm text-slate-600">
                {localStudent?.assignments.length ?? 0} assignments · {localStudent?.studyDocument.sessions.length ?? 0} Study sessions
              </p>
              {student.state === 'EXPLICIT_MAP_REQUIRED' ? (
                <label className="mt-3 block text-sm font-medium text-slate-800">
                  Choose the hosted student, or create a new one
                  <select
                    aria-label={`Hosted mapping for ${student.displayName}`}
                    className="mt-1 block w-full rounded-lg border border-slate-300 p-2"
                    defaultValue=""
                    onChange={(event) => {
                      if (!event.target.value) return
                      onStudentChoice(
                        student.localStudentRef,
                        event.target.value === '__create_new__' ? null : event.target.value,
                      )
                    }}
                  >
                    <option value="" disabled>Select a mapping</option>
                    {student.candidateRemoteStudentRefs.map((remoteRef) => {
                      const candidate = review.inspection.remoteStudents.find((item) => item.remoteStudentRef === remoteRef)
                      return <option key={remoteRef} value={remoteRef}>{candidate?.displayName ?? 'Existing hosted student'}</option>
                    })}
                    <option value="__create_new__">Create a new hosted student</option>
                  </select>
                </label>
              ) : null}
              {student.reasonCode ? <p className="mt-2 text-sm text-red-700">{student.reasonCode}</p> : null}
            </article>
          )
        })}
      </div>

      <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
        PINs, learner response bodies, Tutor transcripts, adult-private notes, and assessment answer authority will not be uploaded.
      </div>

      <label className="mt-5 flex items-start gap-3 text-sm text-slate-800">
        <input
          type="checkbox"
          checked={approved}
          disabled={!review.plan.readyForParentConfirmation || busy}
          onChange={(event) => setApproved(event.target.checked)}
        />
        <span>I approve this exact student mapping and first-link import.</span>
      </label>
      <button
        type="button"
        className="mt-4 rounded-lg bg-slate-950 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!approved || !review.plan.readyForParentConfirmation || busy}
        onClick={onConfirm}
      >
        {busy ? 'Linking…' : 'Link family Study work'}
      </button>

      {result?.status === 'linked' ? (
        <p role="status" className="mt-4 text-sm font-semibold text-emerald-700">Family Study work linked successfully.</p>
      ) : null}
      {result?.status === 'failed' ? (
        <p role="alert" className="mt-4 text-sm font-semibold text-red-700">{result.message}</p>
      ) : null}
    </section>
  )
}
