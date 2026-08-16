import { useMemo, useState } from 'react'
import type { FamilySetupStudent } from '../../setup'
import type { FinalFamilyPilotController } from '../controller'
import { deriveParentReviewCenter, type ParentReviewCenterItem } from './model'

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'That review action could not be completed.'
}

function whenLabel(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function ReviewItem({
  item,
  onAction,
}: {
  readonly item: ParentReviewCenterItem
  readonly onAction: (item: ParentReviewCenterItem, mode?: 'adult-observed' | 'simulated-alternative') => void
}) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4" data-review-kind={item.kind}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-extrabold text-slate-950">{item.title}</h4>
          <p className="mt-1 font-semibold text-slate-700">{item.state}</p>
        </div>
        <time className="text-sm text-slate-500" dateTime={item.when}>{whenLabel(item.when)}</time>
      </div>
      <p className="mt-2 text-sm text-slate-700"><strong>Result:</strong> {item.result}</p>
      <p className="mt-1 text-sm text-slate-700"><strong>Next:</strong> {item.next}</p>
      {item.action === 'COMPLETE_MANUAL_REVIEW' ? (
        <button type="button" className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white" onClick={() => onAction(item)}>
          Confirm authorized manual review complete
        </button>
      ) : item.action === 'CERTIFY_ASSESSMENT' ? (
        <button type="button" className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white" onClick={() => onAction(item)}>
          Guardian certify assessment
        </button>
      ) : item.action === 'CERTIFY_PHYSICAL_COMPLETION' ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white" onClick={() => onAction(item, 'adult-observed')}>
            Certify adult-observed completion
          </button>
          <button type="button" className="rounded-lg border border-emerald-700 bg-white px-4 py-2 font-bold text-emerald-900" onClick={() => onAction(item, 'simulated-alternative')}>
            Certify equal-credit alternative
          </button>
        </div>
      ) : item.action === 'CLEAR_SAFETY_HOLD' ? (
        <button type="button" className="mt-3 rounded-lg bg-slate-900 px-4 py-2 font-bold text-white" onClick={() => onAction(item)}>
          Parent checked in — clear exact hold
        </button>
      ) : null}
    </li>
  )
}

function ReviewSection({
  title,
  empty,
  items,
  onAction,
}: {
  readonly title: string
  readonly empty: string
  readonly items: readonly ParentReviewCenterItem[]
  readonly onAction: (item: ParentReviewCenterItem, mode?: 'adult-observed' | 'simulated-alternative') => void
}) {
  return (
    <section className="rounded-2xl border bg-slate-50 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-extrabold">{title}</h3>
        <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-bold text-white">{items.length}</span>
      </div>
      {items.length ? <ul className="mt-4 space-y-3">{items.map((item) => <ReviewItem key={item.itemRef} item={item} onAction={onAction} />)}</ul> : <p className="mt-3 text-sm text-slate-600">{empty}</p>}
    </section>
  )
}

export function ParentReviewCenter({
  controller,
  student,
  refresh,
}: {
  readonly controller: FinalFamilyPilotController
  readonly student: FamilySetupStudent
  readonly refresh: () => void
}) {
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const app = controller.appSnapshot.state
  const coreStudent = controller.coreSnapshot.state.students.find((item) => item.studentRef === student.studentRef)
  const model = useMemo(() => deriveParentReviewCenter({
    studentRef: student.studentRef,
    assessments: app.assessmentAssignments,
    attestations: app.attestations,
    safetyHolds: app.safety.holds,
    sessions: app.sessions,
    assignments: coreStudent?.assignments ?? [],
  }), [app, coreStudent, student.studentRef])

  const runAction = async (
    item: ParentReviewCenterItem,
    mode: 'adult-observed' | 'simulated-alternative' = 'adult-observed',
  ) => {
    if (!item.assignmentRef) return
    setError('')
    try {
      if (item.action === 'COMPLETE_MANUAL_REVIEW') {
        controller.completeAssessmentReview(student.studentRef, item.assignmentRef, 'manual-review')
        setStatus('Manual review recorded. The assessment is ready to continue.')
      } else if (item.action === 'CERTIFY_ASSESSMENT') {
        controller.completeAssessmentReview(student.studentRef, item.assignmentRef, 'guardian-certification')
        setStatus('Guardian certification recorded. The assessment is ready to continue.')
      } else if (item.action === 'CERTIFY_PHYSICAL_COMPLETION') {
        const result = await controller.attest(student.studentRef, item.assignmentRef, mode)
        if (result.status !== 'ok') throw new Error(result.message)
        setStatus('Guardian certification recorded. The learner is ready to continue.')
      } else if (item.action === 'CLEAR_SAFETY_HOLD') {
        await controller.clearHold(student.studentRef, item.assignmentRef, item.itemRef)
        setStatus('Safety check-in completed. This exact learner session may continue.')
      }
      refresh()
    } catch (cause) {
      setError(messageOf(cause))
    }
  }

  const section = (title: string, empty: string, items: readonly ParentReviewCenterItem[]) => (
    <ReviewSection title={title} empty={empty} items={items} onAction={(item, mode) => { void runAction(item, mode) }} />
  )

  return (
    <div className="mt-6 space-y-5" data-testid="parent-review-center" data-student-ref={student.studentRef}>
      <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-800">Authorized parent session</p>
        <h3 className="mt-1 text-2xl font-extrabold">{student.displayName}’s Review Center</h3>
        <p className="mt-2 text-sm text-slate-700">Review status and minimized history only. Learner answers and restricted scoring material are not loaded here.</p>
        <p className="mt-3 font-bold">Review queue: {model.reviewQueue.length}</p>
      </section>
      {status ? <p className="rounded-lg bg-emerald-50 p-3 font-semibold text-emerald-900" role="status">{status}</p> : null}
      {error ? <p className="rounded-lg border border-red-300 bg-red-50 p-3 font-semibold text-red-900" role="alert">{error}</p> : null}
      {section('Pending trusted scoring', 'No assessments are waiting for trusted scoring.', model.pendingScoring)}
      {section('Guardian review', 'No guardian certifications are waiting.', model.guardianReview)}
      {section('Manual review', 'No authorized manual reviews are waiting.', model.manualReview)}
      {section('Safety actions', 'No learner sessions need a safety check-in.', model.safetyActions)}
      {section('Completed review history', 'No completed reviews are recorded yet.', model.completedHistory)}
    </div>
  )
}
