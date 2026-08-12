import { useEffect, useMemo, useState } from 'react'
import type { StudyPortBundle } from '../../ports'
import type { StudyAdultAuthorization, StudyCalendarEntry, StudyParentSettings, StudyReviewRecommendation } from '../../types'
import { readLocalSafetyStopLedger, type LocalSafetyStopLedgerView } from '../../safety/localStopLedger'
import type { SafetyHoldV1 } from '../safety'
import { deriveStudentSnapshot } from './deriveSnapshot'
import { allowResume, acknowledgeReview } from './actions'
import type { FamilyPilotLearnerOption, FamilyPilotSafetyHoldsView } from './types'
import { FamilyPilotStudentCard } from './FamilyPilotStudentCard'

export function FamilyPilotParentHub({
  householdRef,
  learners,
  ports,
  authorization,
  readSafetyLedger = readLocalSafetyStopLedger,
  safetyHolds,
}: {
  readonly householdRef: string
  readonly learners: readonly FamilyPilotLearnerOption[]
  readonly ports: StudyPortBundle
  readonly authorization: StudyAdultAuthorization
  readonly readSafetyLedger?: () => LocalSafetyStopLedgerView
  /** Absent: no Family Pilot safety-hold section renders, identical to pre-integration behavior. */
  readonly safetyHolds?: FamilyPilotSafetyHoldsView
}) {
  const [learnerRef, setLearnerRef] = useState(learners[0]?.learnerRef ?? '')
  const [calendar, setCalendar] = useState<readonly StudyCalendarEntry[]>([])
  const [reviews, setReviews] = useState<readonly StudyReviewRecommendation[]>([])
  const [settings, setSettings] = useState<StudyParentSettings | null>(null)
  const [openHolds, setOpenHolds] = useState<readonly SafetyHoldV1[]>([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const learner = learners.find((option) => option.learnerRef === learnerRef) ?? null
  const scope = { householdRef, learnerRef }

  const refresh = async () => {
    if (!learnerRef) {
      setCalendar([])
      setReviews([])
      setSettings(null)
      return
    }
    try {
      const [nextCalendar, nextReviews, nextSettings] = await Promise.all([
        ports.calendar.list(scope),
        ports.reviewQueue.list(scope),
        ports.parentSettings.read(scope),
      ])
      setCalendar(nextCalendar)
      setReviews(nextReviews)
      setSettings(nextSettings)
      setError('')
    } catch {
      setError('Family Pilot evidence could not be loaded safely.')
    }
  }

  const refreshHolds = () => {
    setOpenHolds(learnerRef && safetyHolds ? safetyHolds.openHoldsFor(learnerRef) : [])
  }

  // Switching learners must reset every piece of derived state before the
  // next fetch resolves, so a slow response for the old learner can never
  // land on the new learner's view.
  useEffect(() => {
    setCalendar([])
    setReviews([])
    setSettings(null)
    setStatus('')
    setError('')
    refresh()
    refreshHolds()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learnerRef, ports, safetyHolds])

  const snapshot = useMemo(() => {
    if (!learner) return null
    return deriveStudentSnapshot(learner, calendar, reviews, settings, readSafetyLedger())
  }, [learner, calendar, reviews, settings, readSafetyLedger])

  if (learners.length === 0) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5" role="status">
        <h2 className="font-bold text-amber-950">Family Pilot Parent Hub</h2>
        <p className="mt-1 text-amber-900">No learner is enrolled in the family pilot yet.</p>
      </section>
    )
  }

  const runResume = async (blockRef: string) => {
    setError('')
    setStatus('')
    const outcome = await allowResume(ports, authorization, scope, blockRef)
    if (outcome.ok) {
      setStatus(outcome.message)
      await refresh()
    } else {
      setError(outcome.message)
    }
  }

  const runResolveHold = (holdRef: string) => {
    if (!safetyHolds) return
    setError('')
    setStatus('')
    const outcome = safetyHolds.resolveHold(holdRef, authorization.actorRef)
    if (outcome.ok) {
      setStatus(outcome.message)
      refreshHolds()
    } else {
      setError(outcome.message)
    }
  }

  const runReviewDecision = async (recommendationRef: string, decision: 'accepted' | 'rejected') => {
    setError('')
    setStatus('')
    const outcome = await acknowledgeReview(ports, scope, authorization, recommendationRef, decision)
    if (outcome.ok) {
      setStatus(outcome.message)
      await refresh()
    } else {
      setError(outcome.message)
    }
  }

  return (
    <div className="family-pilot-parent-hub space-y-5" aria-busy={!settings}>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Family Pilot — Parent view</h2>
            <p className="text-sm text-slate-600">Local development only — not durable. Per-student progress for the family pilot. Reads only — the Study Engine stays the record of truth.</p>
          </div>
          <label className="font-semibold text-slate-800">
            Student
            <select
              className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2"
              value={learnerRef}
              onChange={(event) => setLearnerRef(event.target.value)}
            >
              {learners.map((option) => (
                <option key={option.learnerRef} value={option.learnerRef}>
                  {option.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>
        {status && (
          <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-emerald-900" role="status">
            {status}
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 p-3 text-red-900" role="alert">
            {error}
          </p>
        )}
      </section>

      {safetyHolds && learner && (
        <section
          className={`rounded-2xl border p-5 ${openHolds.length > 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}
          aria-labelledby={`family-pilot-safety-holds-${learner.learnerRef}`}
          data-testid="family-pilot-safety-holds"
        >
          <h3 id={`family-pilot-safety-holds-${learner.learnerRef}`} className="text-xl font-bold text-slate-900">
            Family Pilot pause for review
          </h3>
          {openHolds.length === 0 ? (
            <p className="mt-2 text-slate-600">Nothing is paused for {learner.displayName} right now.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {openHolds.map((hold) => (
                <li key={hold.holdRef} className="rounded-xl border border-amber-200 bg-white p-4" data-hold-ref={hold.holdRef}>
                  <p className="font-semibold text-amber-950">
                    Paused since {hold.createdAt} — {hold.reasonCode}
                  </p>
                  <button
                    type="button"
                    className="mt-2 min-h-11 rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white"
                    onClick={() => runResolveHold(hold.holdRef)}
                  >
                    Resolve and let them resume
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {snapshot && (
        <FamilyPilotStudentCard
          key={snapshot.learner.learnerRef}
          snapshot={snapshot}
          onAllowResume={runResume}
          onReviewDecision={runReviewDecision}
        />
      )}
    </div>
  )
}
