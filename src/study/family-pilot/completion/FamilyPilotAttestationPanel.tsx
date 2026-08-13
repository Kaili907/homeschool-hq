import { useState } from 'react'
import type {
  FamilyPilotAttestationRequest,
  FamilyPilotAttestationResult,
  FamilyPilotPendingAttestation,
} from './policy'

// FAMILY-PILOT-COMPLETION: the adult-facing attestation surface.
//
// This panel is mounted inside the Parent view and nowhere else. That placement
// is the point: the learner surface has no control that reaches it, so "only a
// guardian may certify" is true of the UI as well as of the store.
//
// It renders both ways to satisfy the requirement side by side. A household
// that ran the authored simulated alternative presses the second button and
// earns the SAME certification — equal credit, not a lesser one — which is what
// keeps the alternative a real option for a family that cannot do the
// real-world action.

export interface FamilyPilotAttestationPanelProps {
  readonly pending: readonly FamilyPilotPendingAttestation[]
  /** Opaque ref for the adult signing off. Never a name or contact detail. */
  readonly attestedByRef: string
  readonly onAttest: (request: FamilyPilotAttestationRequest) => FamilyPilotAttestationResult
}

export function FamilyPilotAttestationPanel({
  pending,
  attestedByRef,
  onAttest,
}: FamilyPilotAttestationPanelProps) {
  const [notice, setNotice] = useState<string | null>(null)

  const attest = (
    item: FamilyPilotPendingAttestation,
    evidenceMode: FamilyPilotAttestationRequest['evidenceMode'],
  ) => {
    // The lesson ref travels with the request, so an attestation raised against
    // a list that has since moved on is refused rather than applied to whatever
    // now sits under that assignment ref.
    const result = onAttest({
      studentRef: item.studentRef,
      assignmentRef: item.assignmentRef,
      lessonRef: item.lessonRef,
      attestedByRef,
      evidenceMode,
    })
    setNotice(
      result.status === 'ok'
        ? result.alreadyAttested
          ? 'Already signed off. Nothing changed.'
          : 'Signed off. This work now counts as complete.'
        : result.message,
    )
  }

  return (
    <section
      className="mt-4 rounded-lg border border-slate-300 p-3"
      aria-labelledby="family-pilot-attestation"
      data-testid="family-pilot-attestation"
    >
      <h3 id="family-pilot-attestation" className="font-extrabold">
        Waiting for a grown-up
      </h3>
      {pending.length === 0 ? (
        <p className="mt-1 font-semibold text-slate-600" data-testid="family-pilot-attestation-empty">
          Nothing is waiting for your sign-off.
        </p>
      ) : (
        <ul className="mt-2 space-y-3">
          {pending.map((item) => (
            <li
              key={`${item.studentRef}:${item.assignmentRef}`}
              className="rounded-lg border border-amber-300 bg-amber-50 p-3"
              data-testid="family-pilot-attestation-item"
              data-assignment-ref={item.assignmentRef}
              data-lesson-ref={item.lessonRef}
            >
              <p className="font-bold">{item.title}</p>
              <p className="text-sm font-semibold text-slate-600">
                {item.subject} · finished by your learner, not yet counted
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="family-pilot-attest-observed"
                  className="min-h-11 rounded-lg border border-emerald-800 bg-emerald-700 px-4 py-2 font-extrabold text-white"
                  onClick={() => attest(item, 'adult-observed')}
                >
                  I watched this happen
                </button>
                <button
                  type="button"
                  data-testid="family-pilot-attest-simulated"
                  className="min-h-11 rounded-lg border border-slate-400 bg-white px-4 py-2 font-bold"
                  onClick={() => attest(item, 'simulated-alternative')}
                >
                  We did the practice version
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {notice && (
        <p className="mt-3 font-semibold" role="status" data-testid="family-pilot-attestation-notice">
          {notice}
        </p>
      )}
    </section>
  )
}
