import { useState } from 'react'
import { isoToday } from '../../appState'
import {
  addCalibration,
  benchmarkFor,
  calibrationTrend,
  getReadingState,
  needsCalibration,
  practiceWordFrequency,
  readingStreak,
  wcpmTrend,
} from '../../reading/fluency'
import type { ReadingGrade } from '../../reading/passages'
import type { Profile } from '../../types'

/**
 * MR reading fluency — the Grown-Ups (Dad) reading view.
 *
 * Trends are the product: an ESTIMATED WCPM series (everyday proxy) plotted with
 * Dad's manual calibration points (ground truth) against the grade benchmark band,
 * a practice-word frequency list (a recurring word = a phonics signal for the grade
 * cards), and the biweekly "run a manual 1-minute check" reminder + entry.
 */
export function ReadingGrownUps({
  profile,
  onChange,
}: {
  profile: Profile
  onChange: (update: (prev: Profile) => Profile) => void
}) {
  const state = getReadingState(profile)
  const grade = profile.grade as ReadingGrade
  const today = isoToday()
  const bench = benchmarkFor(grade)
  const est = wcpmTrend(state)
  const cal = calibrationTrend(state)
  const freq = practiceWordFrequency(state)
  const streak = readingStreak(state)
  const due = needsCalibration(state, today)

  const [calValue, setCalValue] = useState('')

  const submitCal = () => {
    const n = Number(calValue)
    if (!Number.isFinite(n) || n <= 0) return
    onChange((prev) => addCalibration(prev, { date: today, wcpm: Math.round(n) }))
    setCalValue('')
  }

  return (
    <div className="mt-3 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
        <span className="rounded-full bg-white px-3 py-1 shadow-sm">
          {state.sessions.length} reading sessions
        </span>
        <span className="rounded-full bg-white px-3 py-1 shadow-sm">🔥 {streak}-day streak</span>
        <span className="rounded-full bg-white px-3 py-1 shadow-sm">
          benchmark {bench.entering}–{bench.yearEnd} WCPM (grade {grade})
        </span>
        <span className="ml-auto text-[11px] italic text-slate-400">
          WCPM is estimated from speech recognition — trends over time, not single readings.
        </span>
      </div>

      {due && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          ⏰ Time for a manual 1-minute check — count her words-correct in a minute and enter it
          below. Dad&apos;s number is the ground truth the estimate is measured against.
        </div>
      )}

      <TrendChart est={est} cal={cal} bench={bench} />

      {/* practice words */}
      <div>
        <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
          Practice words (most frequent first)
        </div>
        {freq.length === 0 ? (
          <p className="text-sm text-slate-400">No practice words logged yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {freq.slice(0, 24).map((f) => (
              <span
                key={f.word}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600"
              >
                {f.word}
                {f.count > 1 && <span className="ml-1 font-bold text-rose-500">×{f.count}</span>}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* calibration entry */}
      <div>
        <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
          Manual calibration (ground truth)
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            value={calValue}
            onChange={(e) => setCalValue(e.target.value)}
            placeholder="Dad-counted WCPM"
            min={0}
            className="w-44 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800"
            aria-label="manual WCPM"
          />
          <button
            onClick={submitCal}
            className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Save check ({today})
          </button>
          {cal.length > 0 && (
            <span className="text-xs text-slate-500">
              last: {cal[cal.length - 1].wcpm} WCPM on {cal[cal.length - 1].date}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------- tiny inline SVG trend chart (Dad-only) ----------

function TrendChart({
  est,
  cal,
  bench,
}: {
  est: { date: string; wcpm: number; estimated: boolean }[]
  cal: { date: string; wcpm: number }[]
  bench: { entering: number; yearEnd: number }
}) {
  const W = 520
  const H = 160
  const PAD = 28

  const allWcpm = [...est.map((p) => p.wcpm), ...cal.map((p) => p.wcpm), bench.yearEnd]
  const maxY = Math.max(20, ...allWcpm) * 1.1
  const n = Math.max(est.length, cal.length, 1)

  const x = (i: number) => PAD + (n <= 1 ? 0 : (i / (n - 1)) * (W - 2 * PAD))
  const y = (v: number) => H - PAD - (v / maxY) * (H - 2 * PAD)

  if (est.length === 0 && cal.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-center text-sm text-slate-400">
        No readings yet — her WCPM trend will appear here.
      </div>
    )
  }

  const line = est.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.wcpm).toFixed(1)}`).join(' ')

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-2">
      <svg width={W} height={H} role="img" aria-label="WCPM trend with benchmark band">
        {/* benchmark band */}
        <rect
          x={PAD}
          y={y(bench.yearEnd)}
          width={W - 2 * PAD}
          height={Math.max(0, y(bench.entering) - y(bench.yearEnd))}
          fill="#dcfce7"
        />
        <line x1={PAD} y1={y(bench.entering)} x2={W - PAD} y2={y(bench.entering)} stroke="#86efac" strokeDasharray="4 3" />
        <line x1={PAD} y1={y(bench.yearEnd)} x2={W - PAD} y2={y(bench.yearEnd)} stroke="#86efac" strokeDasharray="4 3" />
        <text x={PAD} y={y(bench.entering) - 3} fontSize="9" fill="#16a34a">
          entering {bench.entering}
        </text>
        <text x={PAD} y={y(bench.yearEnd) - 3} fontSize="9" fill="#16a34a">
          year-end {bench.yearEnd}
        </text>

        {/* estimated series line + dots */}
        {est.length > 1 && <path d={line} fill="none" stroke="#f59e0b" strokeWidth="2" />}
        {est.map((p, i) => (
          <circle key={`e${i}`} cx={x(i)} cy={y(p.wcpm)} r={3} fill={p.estimated ? '#f59e0b' : '#0ea5e9'} />
        ))}

        {/* calibration (ground-truth) diamonds */}
        {cal.map((p, i) => (
          <rect
            key={`c${i}`}
            x={x(i) - 3.5}
            y={y(p.wcpm) - 3.5}
            width={7}
            height={7}
            fill="#0f766e"
            transform={`rotate(45 ${x(i)} ${y(p.wcpm)})`}
          />
        ))}

        {/* baseline */}
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#e2e8f0" />
      </svg>
      <div className="mt-1 flex gap-4 px-2 text-[11px] font-semibold text-slate-500">
        <span className="text-amber-600">● estimated</span>
        <span className="text-teal-700">◆ Dad calibration</span>
        <span className="text-emerald-600">▬ benchmark band</span>
      </div>
    </div>
  )
}
