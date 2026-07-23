import { useEffect, useRef, useState } from 'react'
import type { FixedTest } from '../../assessment/types'

interface EssayEditorProps {
  test: FixedTest
  prompt: string
  initialValue: string
  /** persist current text; addMs is time elapsed since the last save */
  onSave: (value: string, addMs: number) => void
  onFinish: (value: string, addMs: number) => void
  onExit: () => void
}

function mmss(sec: number): string {
  const m = Math.floor(Math.max(0, sec) / 60)
  const s = Math.max(0, sec) % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const GRACE_SEC = 60

/**
 * Distraction-free timed essay editor. Autosaves every 10s. Hard timer soft-locks
 * the textarea after a 60s grace banner; a soft timer (senior Part 3B) warns but
 * never locks. Spellcheck is off — we're assessing her, not the browser.
 */
export function EssayEditor({ test, prompt, initialValue, onSave, onFinish, onExit }: EssayEditorProps) {
  const [value, setValue] = useState(initialValue)
  const [remaining, setRemaining] = useState(test.timerSec ?? 0)
  const [grace, setGrace] = useState<number | null>(null)
  const [locked, setLocked] = useState(false)
  const valueRef = useRef(value)
  const lastSaveRef = useRef(Date.now())
  valueRef.current = value

  const flush = (final = false) => {
    const now = Date.now()
    const delta = now - lastSaveRef.current
    lastSaveRef.current = now
    if (final) onFinish(valueRef.current, delta)
    else onSave(valueRef.current, delta)
  }

  // autosave every 10s
  useEffect(() => {
    const id = window.setInterval(() => onSave(valueRef.current, 10000), 10000)
    return () => window.clearInterval(id)
  }, [onSave])

  // countdown
  useEffect(() => {
    if (!test.timerSec) return
    const id = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          window.clearInterval(id)
          if (test.softTimer) {
            return 0 // soft: just show "time's up", never lock
          }
          setGrace(GRACE_SEC) // hard: begin 60s grace
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [test.timerSec, test.softTimer])

  // grace countdown → lock
  useEffect(() => {
    if (grace === null) return
    if (grace <= 0) {
      onSave(valueRef.current, 0)
      setLocked(true)
      return
    }
    const id = window.setTimeout(() => setGrace((g) => (g === null ? null : g - 1)), 1000)
    return () => window.clearTimeout(id)
  }, [grace, onSave])

  const words = value.trim() === '' ? 0 : value.trim().split(/\s+/).length
  const timeUp = test.timerSec ? remaining <= 0 : false

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      {/* top bar */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
        <button onClick={() => { flush(); onExit() }} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          Save &amp; exit
        </button>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-400">{words} words</span>
          {test.timerSec != null && (
            <span
              className={`rounded-md px-2 py-1 font-mono font-bold ${
                locked ? 'bg-rose-100 text-rose-700' : timeUp ? 'bg-amber-100 text-amber-700' : 'text-slate-700'
              }`}
            >
              {grace !== null ? `Grace ${mmss(grace)}` : mmss(remaining)}
            </span>
          )}
        </div>
        <button
          onClick={() => flush(true)}
          className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Turn in
        </button>
      </div>

      {/* banners */}
      {locked && (
        <div className="bg-rose-600 px-4 py-2 text-center text-sm font-semibold text-white">
          Time is up — the editor is locked. Press “Turn in”.
        </div>
      )}
      {!locked && grace !== null && (
        <div className="bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-white">
          Time is up. You have {mmss(grace)} to finish your sentence, then the editor locks.
        </div>
      )}
      {!locked && grace === null && timeUp && test.softTimer && (
        <div className="bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-amber-950">
          The soft timer is up — take the time you need to finish well.
        </div>
      )}

      {/* prompt + editor */}
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 overflow-hidden px-4 py-4">
        <p className="shrink-0 text-lg font-semibold text-slate-800">{prompt}</p>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => flush()}
          readOnly={locked}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          placeholder="Start writing here…"
          className="flex-1 resize-none rounded-lg border border-slate-300 p-4 text-base leading-relaxed text-slate-900 focus:border-slate-500 focus:outline-none"
        />
      </div>
    </div>
  )
}
