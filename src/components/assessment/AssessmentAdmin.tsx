import { useState } from 'react'
import type { Profile } from '../../types'
import { testsForGrade } from '../../assessment/banks'
import {
  assignTest,
  completedAttempt,
  findAssignment,
  getState,
  startStatus,
  unassignTest,
  unlockRetake,
} from '../../assessment/attempts'
import { AssessmentResults } from './AssessmentResults'

interface AssessmentAdminProps {
  profile: Profile
  nowISO: string
  onPatch: (p: Profile) => void
}

const STATUS_UI: Record<string, { label: string; cls: string }> = {
  'not-started': { label: 'not assigned / not started', cls: 'bg-slate-100 text-slate-500' },
  'in-progress': { label: 'in progress', cls: 'bg-sky-100 text-sky-700' },
  'completed-locked': { label: 'completed (locked)', cls: 'bg-emerald-100 text-emerald-700' },
  'retake-ready': { label: 'retake unlocked', cls: 'bg-amber-100 text-amber-800' },
}

/** Grown-Ups sub-panel: assign fixed tests, gate with a start code, view results, unlock retakes. */
export function AssessmentAdmin({ profile, nowISO, onPatch }: AssessmentAdminProps) {
  const tests = testsForGrade(profile.grade)
  const [codeDraft, setCodeDraft] = useState<Record<string, string>>({})
  const [openResult, setOpenResult] = useState<string | null>(null)

  if (tests.length === 0) {
    return <div className="mt-3 text-sm text-slate-500">No fixed assessments for grade {profile.grade}.</div>
  }

  const state = getState(profile.assessments)
  const patch = (next: typeof state) => onPatch({ ...profile, assessments: next })

  return (
    <div className="mt-3 space-y-2">
      {tests.map((test) => {
        const status = startStatus(state, test.id)
        const assignment = findAssignment(state, test.id)
        const done = completedAttempt(state, test.id)
        const ui = STATUS_UI[status]
        return (
          <div key={test.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-800">{test.title}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${ui.cls}`}>{ui.label}</span>
              {assignment && (
                <span className="text-xs font-mono text-slate-400">code {assignment.startCode}</span>
              )}
              <span className="ml-auto flex flex-wrap gap-2">
                {!assignment ? (
                  <span className="flex items-center gap-1">
                    <input
                      value={codeDraft[test.id] ?? ''}
                      onChange={(e) => setCodeDraft((d) => ({ ...d, [test.id]: e.target.value }))}
                      placeholder="start code"
                      className="w-24 rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                    <button
                      onClick={() => {
                        const code = (codeDraft[test.id] ?? '').trim()
                        if (code) patch(assignTest(state, test.id, code, nowISO))
                      }}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Assign
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => patch(unassignTest(state, test.id))}
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Unassign
                  </button>
                )}
                {done && (
                  <button
                    onClick={() => setOpenResult(openResult === test.id ? null : test.id)}
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    {openResult === test.id ? 'Hide results' : 'View results'}
                  </button>
                )}
                {status === 'completed-locked' && (
                  <button
                    onClick={() => patch(unlockRetake(state, test.id))}
                    className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                  >
                    Unlock retake
                  </button>
                )}
              </span>
            </div>
            {openResult === test.id && done && (
              <AssessmentResults test={test} attempt={done} studentName={profile.name} />
            )}
          </div>
        )
      })}
    </div>
  )
}
