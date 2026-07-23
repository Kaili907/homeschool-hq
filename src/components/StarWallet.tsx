import { useEffect, useRef, useState } from 'react'
import type { StarState } from '../types'
import { heldTotal } from '../stars/stars'

/** A short, celebratory chime for an earn moment. Silent when muted. */
function starChime(): void {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    ;[660, 880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.08
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
      osc.start(t)
      osc.stop(t + 0.28)
    })
    window.setTimeout(() => ctx.close(), 700)
  } catch {
    // no audio available — the animation still plays
  }
}

interface StarWalletProps {
  stars: StarState
  playful: boolean
  muted: boolean
}

/** The always-visible wallet counter. Tapping it opens the kid-readable ledger.
 * When the balance grows, a few stars fly to the counter (≤1.5s) with a chime. */
export function StarWallet({ stars, playful, muted }: StarWalletProps) {
  const [open, setOpen] = useState(false)
  const [flyKey, setFlyKey] = useState(0)
  const prevBalance = useRef(stars.balance)

  useEffect(() => {
    if (stars.balance > prevBalance.current) {
      setFlyKey((k) => k + 1)
      if (!muted) starChime()
    }
    prevBalance.current = stars.balance
  }, [stars.balance, muted])

  const held = heldTotal(stars)
  const pill = playful
    ? 'rounded-full border-b-4 border-amber-500 bg-amber-300 px-4 py-1.5 text-lg font-extrabold text-amber-900 shadow-lg active:translate-y-0.5 active:border-b-2'
    : 'rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-bold text-amber-700 shadow-sm'

  return (
    <>
      <div className="relative inline-flex flex-col items-end">
        <button
          onClick={() => setOpen(true)}
          className={`${pill} relative`}
          aria-label={`${stars.balance} stars — tap for your star history`}
        >
          <span key={flyKey} className={flyKey ? 'inline-block wallet-bump' : 'inline-block'}>
            ⭐ {stars.balance}
          </span>
          {/* flying stars on earn */}
          {flyKey > 0 && (
            <span className="pointer-events-none absolute inset-0" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span
                  key={`${flyKey}-${i}`}
                  className="star-fly absolute left-1/2 top-1/2 text-xl"
                  style={
                    {
                      '--sx': `${(i - 1) * 26}px`,
                      '--sy': `${44 + i * 8}px`,
                      animationDelay: `${i * 90}ms`,
                    } as React.CSSProperties
                  }
                >
                  ⭐
                </span>
              ))}
            </span>
          )}
        </button>
        {held > 0 && (
          <span className={`mt-1 text-xs font-bold ${playful ? 'text-violet-500' : 'text-slate-400'}`}>
            {held} on hold
          </span>
        )}
      </div>

      {open && <LedgerModal stars={stars} playful={playful} onClose={() => setOpen(false)} />}
    </>
  )
}

function LedgerModal({
  stars,
  playful,
  onClose,
}: {
  stars: StarState
  playful: boolean
  onClose: () => void
}) {
  const rows = [...stars.ledger].reverse() // newest first
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-md ${playful ? 'rounded-3xl' : 'rounded-2xl'} bg-white p-5 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '80vh', overflowY: 'auto' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-amber-700">⭐ My Stars</h2>
          <button
            onClick={onClose}
            className="rounded-full bg-slate-100 px-4 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-200"
          >
            Close
          </button>
        </div>
        <div className="mt-1 text-4xl font-extrabold text-amber-500">{stars.balance}</div>
        <div className="text-sm font-semibold text-slate-400">
          {stars.lifetimeEarned} earned all-time
        </div>

        {stars.pendingRedemptions.length > 0 && (
          <div className="mt-3 rounded-2xl bg-violet-50 p-3">
            <div className="text-xs font-bold uppercase tracking-wide text-violet-500">
              Waiting for Dad
            </div>
            {stars.pendingRedemptions.map((r) => (
              <div key={r.id} className="mt-1 flex items-center justify-between text-sm font-bold text-violet-800">
                <span>
                  {r.emoji} {r.name}
                </span>
                <span>⭐ {r.cost}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 space-y-1.5">
          {rows.length === 0 && (
            <p className="py-6 text-center text-sm font-semibold text-slate-400">
              No stars yet — finish today's practice to start earning! ✏️
            </p>
          )}
          {rows.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm"
            >
              <span className="font-semibold text-slate-600">{e.reason}</span>
              <span
                className={`ml-2 shrink-0 font-extrabold ${
                  e.amount >= 0 ? 'text-emerald-600' : 'text-rose-500'
                }`}
              >
                {e.amount >= 0 ? '+' : ''}
                {e.amount} ⭐
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
