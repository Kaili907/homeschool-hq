import { useMemo, useRef, useState } from 'react'
import type { Attempt, FixedTest, Item } from '../../assessment/types'

interface TestPlayerProps {
  test: FixedTest
  attempt: Attempt
  onRecord: (itemId: string, value: string, skipped: boolean, addMs: number) => void
  /** Carries the last item's pending answer so the runner can record+finish in one update. */
  onFinish: (lastId: string, value: string, skipped: boolean, addMs: number) => void
  onExit: () => void
}

interface FlatItem {
  item: Item
  sectionIndex: number
  sectionName: string
  passage?: string
}

/**
 * One-item-at-a-time fixed-form player. SKIP is a first-class, neutrally-styled
 * button on every item. NO per-item feedback, ever — no correct/incorrect signal
 * during or after. Free back/forward navigation; section list shows answered/skipped.
 */
export function TestPlayer({ test, attempt, onRecord, onFinish, onExit }: TestPlayerProps) {
  const flat = useMemo<FlatItem[]>(
    () =>
      test.sections.flatMap((s, si) =>
        s.items.map((item) => ({ item, sectionIndex: si, sectionName: s.name, passage: s.passage })),
    ),
    [test],
  )

  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, { value: string; skipped: boolean }>>(() => {
    const init: Record<string, { value: string; skipped: boolean }> = {}
    for (const [id, a] of Object.entries(attempt.answers)) init[id] = { value: a.value, skipped: a.skipped }
    return init
  })
  const enteredAt = useRef(Date.now())

  const current = flat[idx]
  const state = answers[current.item.id] ?? { value: '', skipped: false }

  const commitTime = () => {
    const now = Date.now()
    const delta = now - enteredAt.current
    enteredAt.current = now
    return delta
  }

  const persist = (value: string, skipped: boolean, addMs: number) => {
    setAnswers((a) => ({ ...a, [current.item.id]: { value, skipped } }))
    onRecord(current.item.id, value, skipped, addMs)
  }

  const setValue = (value: string) =>
    setAnswers((a) => ({ ...a, [current.item.id]: { value, skipped: false } }))

  const go = (nextIdx: number) => {
    // persist current text answer (non-skip) before leaving
    const s = answers[current.item.id]
    if (s && !s.skipped) onRecord(current.item.id, s.value, false, commitTime())
    else commitTime()
    setIdx(Math.max(0, Math.min(flat.length - 1, nextIdx)))
    enteredAt.current = Date.now()
  }

  const skip = () => {
    persist('', true, commitTime())
    if (idx < flat.length - 1) {
      setIdx(idx + 1)
      enteredAt.current = Date.now()
    }
  }

  const answeredCount = (sectionName: string) => {
    const items = flat.filter((f) => f.sectionName === sectionName)
    let answered = 0
    let skipped = 0
    for (const f of items) {
      const a = answers[f.item.id]
      if (!a) continue
      if (a.skipped) skipped++
      else if (a.value.trim() !== '') answered++
    }
    return { answered, skipped, total: items.length }
  }

  const isLast = idx === flat.length - 1
  const showPassageFor = current.passage && (idx === 0 || flat[idx - 1].sectionIndex !== current.sectionIndex)

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5">
        {/* header */}
        <div className="flex items-center justify-between">
          <button onClick={() => { commitTime(); onExit() }} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Save &amp; exit
          </button>
          <div className="text-sm font-semibold text-slate-500">
            {current.sectionName} · {idx + 1} of {flat.length}
          </div>
        </div>

        {/* section progress chips */}
        <div className="flex flex-wrap gap-2">
          {test.sections.map((s) => {
            const c = answeredCount(s.name)
            return (
              <span key={s.name} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                {s.name.replace(/^Section \d+ — /, '')}: {c.answered}/{c.total}
                {c.skipped > 0 && <span className="text-amber-600"> · {c.skipped} skipped</span>}
              </span>
            )
          })}
        </div>

        {/* passage (reading) */}
        {showPassageFor && current.passage && (
          <div className="max-h-72 overflow-y-auto whitespace-pre-line rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-700">
            {current.passage}
          </div>
        )}

        {/* item */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">
            Question {current.item.id}
          </div>
          <p className="whitespace-pre-line text-lg font-semibold text-slate-900">{current.item.prompt}</p>

          <div className="mt-4">
            {current.item.kind === 'choice' ? (
              <div className="grid gap-2">
                {current.item.choices?.map((choice) => {
                  const selected = !state.skipped && state.value === choice
                  return (
                    <button
                      key={choice}
                      onClick={() => persist(choice, false, commitTime())}
                      className={`rounded-lg border px-4 py-3 text-left font-semibold transition-colors ${
                        selected
                          ? 'border-slate-800 bg-slate-800 text-white'
                          : 'border-slate-300 bg-white text-slate-800 hover:border-slate-500'
                      }`}
                    >
                      {choice}
                    </button>
                  )
                })}
              </div>
            ) : current.item.kind === 'numeric' ? (
              <input
                value={state.skipped ? '' : state.value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={() => onRecord(current.item.id, answers[current.item.id]?.value ?? '', false, 0)}
                spellCheck={false}
                placeholder="Type your answer (fractions like 1 7/12, decimals, 10π, x ≤ −3…)"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-lg text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            ) : (
              <textarea
                value={state.skipped ? '' : state.value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={() => onRecord(current.item.id, answers[current.item.id]?.value ?? '', false, 0)}
                spellCheck={false}
                rows={4}
                placeholder="Type your answer…"
                className="w-full resize-y rounded-lg border border-slate-300 px-4 py-3 text-base text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            )}
          </div>

          {state.skipped && (
            <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
              Skipped — that's a fine, honest answer. You can come back anytime.
            </div>
          )}
        </div>

        {/* skip — first-class, neutral */}
        <button
          onClick={skip}
          className="self-center rounded-lg border-2 border-dashed border-slate-300 bg-white px-6 py-2 font-semibold text-slate-500 hover:border-slate-400 hover:text-slate-700"
        >
          I don't know how to start — SKIP
        </button>

        {/* nav */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => go(idx - 1)}
            disabled={idx === 0}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            ← Back
          </button>
          {isLast ? (
            <button
              onClick={() => {
                const s = answers[current.item.id] ?? { value: '', skipped: false }
                onFinish(current.item.id, s.skipped ? '' : s.value, s.skipped, commitTime())
              }}
              className="rounded-lg bg-slate-900 px-6 py-2 font-semibold text-white hover:bg-slate-700"
            >
              Finish &amp; turn in
            </button>
          ) : (
            <button
              onClick={() => go(idx + 1)}
              className="rounded-lg bg-slate-900 px-6 py-2 font-semibold text-white hover:bg-slate-700"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
