import { useState } from 'react'
import type { FixedTest } from '../../assessment/types'

interface StartGateProps {
  test: FixedTest
  startCode: string
  resuming: boolean
  onStart: () => void
  onCancel: () => void
}

const SKIP_RULE =
  "If you genuinely don't know how to start, press SKIP. A skip tells us where the gap is; a " +
  "guess hides it. This test can't be failed — only honest or dishonest."

/**
 * Intro + parent start-code gate. Dad enters the code so nobody starts a placement
 * alone at 9pm. No scores, no feedback — just the rules and the gate.
 */
export function StartGate({ test, startCode, resuming, onStart, onCancel }: StartGateProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const submit = () => {
    if (code.trim() === startCode) onStart()
    else setError('That start code is not right — ask Dad.')
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <div className="mx-auto w-full max-w-xl">
        <button onClick={onCancel} className="mb-4 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          ← Back
        </button>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Placement</div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{test.title}</h1>

          {test.intro && <p className="mt-3 leading-relaxed text-slate-700">{test.intro}</p>}

          <div className="mt-4 rounded-lg bg-slate-100 p-3 text-sm font-semibold text-slate-700">
            {SKIP_RULE}
          </div>

          {test.scratchReminder && (
            <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800">
              ✋ Use your scratch pad for all work. When you finish, Dad photographs the scratch pad.
            </div>
          )}

          {resuming && (
            <div className="mt-3 rounded-lg bg-sky-50 p-3 text-sm font-semibold text-sky-800">
              You have this one in progress — the start code will pick up where you left off.
            </div>
          )}

          <div className="mt-6 border-t border-slate-200 pt-4">
            <label className="text-sm font-semibold text-slate-600">Dad enters the start code:</label>
            <div className="mt-2 flex gap-2">
              <input
                value={code}
                onChange={(e) => { setCode(e.target.value); setError('') }}
                inputMode="numeric"
                className="w-40 rounded-lg border border-slate-300 px-3 py-2 font-mono text-lg text-slate-900 focus:border-slate-500 focus:outline-none"
                placeholder="code"
              />
              <button onClick={submit} className="rounded-lg bg-slate-900 px-6 py-2 font-semibold text-white hover:bg-slate-700">
                {resuming ? 'Resume' : 'Start'}
              </button>
            </div>
            {error && <div className="mt-2 text-sm font-semibold text-rose-600">{error}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

export function AssessmentDone({ onHome }: { onHome: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
        <div className="text-4xl">📋</div>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Finished!</h1>
        <p className="mt-2 font-semibold text-slate-600">Nice work — Dad has it from here.</p>
        <button onClick={onHome} className="mt-6 rounded-lg bg-slate-900 px-6 py-2 font-semibold text-white hover:bg-slate-700">
          Back home
        </button>
      </div>
    </div>
  )
}
