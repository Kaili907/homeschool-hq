import { useEffect, useRef, useState } from 'react'
import type { Profile } from '../types'
import { isoToday } from '../appState'
import { isDayComplete } from '../missions'
import { useTheme } from '../theme'
import { Confetti } from './Confetti'

interface MissionCardProps {
  profile: Profile
  onToggle: (itemId: string, done: boolean) => void
}

function friendlyDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function MissionCard({ profile, onToggle }: MissionCardProps) {
  const t = useTheme()
  const today = isoToday()
  const day = profile.missions[today]
  const complete = isDayComplete(day)
  const prevComplete = useRef(complete)
  const [burst, setBurst] = useState(0)

  useEffect(() => {
    if (complete && !prevComplete.current && t.confetti) setBurst((b) => b + 1)
    prevComplete.current = complete
  }, [complete, t.confetti])

  if (!day) return null
  const doneCount = day.items.filter((i) => i.done).length

  return (
    <div className={`${t.card} p-5`}>
      {t.confetti && <Confetti burst={burst} />}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={`text-xl font-extrabold ${t.heading}`}>
          {t.bigEmoji ? '🌅 ' : ''}Today's Mission
        </h2>
        <span className={`text-sm font-bold ${t.sub}`}>{friendlyDate(today)}</span>
      </div>

      <div className={`mt-3 h-3 w-full overflow-hidden rounded-full ${t.progressTrack}`}>
        <div
          className={`h-full rounded-full ${t.progressFill} transition-all duration-500`}
          style={{ width: `${(doneCount / day.items.length) * 100}%` }}
        />
      </div>
      <div className={`mt-1 text-right text-xs font-bold ${t.sub}`}>
        {doneCount}/{day.items.length} done
      </div>

      <ul className="mt-3 space-y-2">
        {day.items.map((item) => {
          const base =
            'flex w-full items-center gap-3 p-3 text-left font-bold transition-all ' +
            (t.id === 'clean'
              ? 'rounded-lg border border-slate-200'
              : 'rounded-2xl border-2 border-slate-100 shadow-sm')
          const doneCls = item.done
            ? t.id === 'clean'
              ? 'bg-slate-50 text-slate-400 line-through'
              : 'bg-green-50 text-green-700'
            : `bg-white ${t.heading}`
          const box = item.done
            ? 'border-transparent bg-green-500 text-white'
            : 'border-slate-300 bg-white text-transparent'
          return (
            <li key={item.id}>
              <button
                onClick={() => !item.auto && onToggle(item.id, !item.done)}
                disabled={!!item.auto}
                className={`${base} ${doneCls} ${item.auto ? 'cursor-default' : ''}`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-base font-extrabold ${box}`}
                >
                  ✓
                </span>
                <span className="flex-1">{item.label}</span>
                {item.auto && !item.done && (
                  <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-700">
                    {t.cheers === 'full' ? 'checks itself ✨' : 'auto'}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {complete && (
        <div
          className={`mt-4 rounded-xl p-3 text-center font-extrabold ${
            t.cheers === 'minimal'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'animate-pop bg-gradient-to-r from-amber-100 to-emerald-100 text-emerald-700'
          }`}
        >
          {t.cheers === 'full'
            ? `🎉 Day complete! ${profile.streaks.current}-day streak — amazing!`
            : t.cheers === 'brief'
              ? `Day complete ✓ ${profile.streaks.current}-day streak`
              : `✓ Day complete · streak ${profile.streaks.current}`}
        </div>
      )}
    </div>
  )
}
