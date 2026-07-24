import { useState } from 'react'
import type { Prize, Profile, StarsConfig } from '../types'
import { availableBalance, getStars } from '../stars/stars'

interface PrizeShopProps {
  profile: Profile
  config: StarsConfig
  playful: boolean
  /** performs the request in App state; returns a friendly error if it couldn't. */
  onRequest: (prize: Prize) => { ok: boolean; error?: string }
  onHome: () => void
}

export function PrizeShop({ profile, config, playful, onRequest, onHome }: PrizeShopProps) {
  const [confirming, setConfirming] = useState<Prize | null>(null)
  const [flash, setFlash] = useState<string>('')

  const stars = getStars(profile)
  const available = availableBalance(profile)
  const pendingIds = new Set(stars.pendingRedemptions.map((r) => r.prizeId))
  const prizes = config.prizes.filter((p) => p.active).sort((a, b) => a.cost - b.cost)

  const ask = (prize: Prize) => {
    const res = onRequest(prize)
    setConfirming(null)
    setFlash(res.ok ? `Asked Dad for ${prize.emoji} ${prize.name}! ⭐ ${prize.cost} on hold.` : (res.error ?? ''))
    window.setTimeout(() => setFlash(''), 3500)
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className={`text-3xl font-extrabold ${playful ? 'text-violet-900' : 'text-slate-800'}`}>
          🎁 Prize Shop
        </h1>
        <button
          onClick={onHome}
          className={
            playful
              ? 'rounded-3xl border-b-8 border-violet-300 bg-white px-4 py-2 font-extrabold text-violet-800 shadow-lg active:translate-y-1 active:border-b-4'
              : 'rounded-2xl border-2 border-slate-200 bg-white px-4 py-2 font-bold text-slate-700 shadow'
          }
        >
          Back home 🏠
        </button>
      </header>

      <div className="mt-2 text-lg font-extrabold text-amber-600">
        ⭐ {stars.balance} stars
        {available !== stars.balance && (
          <span className="ml-2 text-sm font-bold text-violet-500">({available} to spend now)</span>
        )}
      </div>

      {flash && (
        <div className="mt-3 rounded-2xl bg-emerald-100 p-3 text-center font-bold text-emerald-800 shadow">
          {flash}
        </div>
      )}

      {prizes.length === 0 ? (
        <p className="mt-8 text-center font-semibold text-slate-400">
          No prizes yet — ask Dad to add some in the Grown-Ups panel!
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {prizes.map((prize) => {
            const affordable = available >= prize.cost
            const pending = pendingIds.has(prize.id)
            return (
              <button
                key={prize.id}
                disabled={pending || !affordable}
                onClick={() => setConfirming(prize)}
                className={[
                  'flex flex-col items-center rounded-3xl border-b-8 p-4 text-center shadow-lg transition-all',
                  pending
                    ? 'border-violet-300 bg-violet-50 opacity-80'
                    : affordable
                      ? 'border-amber-400 bg-white ring-4 ring-amber-200 hover:scale-[1.03] active:translate-y-1 active:border-b-4 star-glow'
                      : 'border-slate-200 bg-slate-50 opacity-60',
                ].join(' ')}
              >
                <span className="text-4xl">{prize.emoji}</span>
                <span className={`mt-1 text-sm font-extrabold ${playful ? 'text-violet-900' : 'text-slate-800'}`}>
                  {prize.name}
                </span>
                <span className="mt-1 rounded-full bg-amber-100 px-3 py-0.5 text-sm font-extrabold text-amber-700">
                  ⭐ {prize.cost}
                </span>
                {pending && <span className="mt-1 text-xs font-bold text-violet-500">Asked Dad!</span>}
                {!pending && !affordable && (
                  <span className="mt-1 text-xs font-bold text-slate-400">Keep saving!</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirming(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-5xl">{confirming.emoji}</div>
            <h2 className="mt-2 text-2xl font-extrabold text-violet-900">{confirming.name}</h2>
            <p className="mt-1 font-bold text-slate-500">
              Ask Dad for this? It costs ⭐ {confirming.cost}.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => ask(confirming)}
                className="rounded-3xl border-b-8 border-emerald-700 bg-emerald-500 px-4 py-3 text-lg font-extrabold text-white shadow-lg active:translate-y-1 active:border-b-4"
              >
                Ask Dad! 🙌
              </button>
              <button
                onClick={() => setConfirming(null)}
                className="rounded-3xl border-b-8 border-slate-300 bg-white px-4 py-3 text-lg font-extrabold text-slate-600 shadow-lg active:translate-y-1 active:border-b-4"
              >
                Not yet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
