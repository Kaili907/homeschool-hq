import { SKILLS } from '../skills'
import type { Profile } from '../types'
import { getStat, statusOf } from '../storage'

const STATUS_STYLE = {
  mastered: { chip: 'bg-green-500 text-white', label: 'Mastered ⭐', bar: 'bg-green-500' },
  developing: { chip: 'bg-amber-400 text-amber-950', label: 'Growing 🌱', bar: 'bg-amber-400' },
  'not-started': { chip: 'bg-slate-200 text-slate-500', label: 'Not started', bar: 'bg-slate-300' },
} as const

export function SkillTree({ profile }: { profile: Profile }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {SKILLS.map((s) => {
        const stat = getStat(profile, s.id)
        const status = statusOf(profile.skillStats[s.id])
        const style = STATUS_STYLE[status]
        return (
          <div key={s.id} className="rounded-3xl bg-white p-4 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <div className="text-4xl">{s.emoji}</div>
              <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${style.chip}`}>{style.label}</span>
            </div>
            <div className="mt-2 text-lg font-extrabold leading-tight text-slate-800">{s.name}</div>
            <div className="text-sm font-semibold text-slate-500">{s.blurb}</div>
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${style.bar} transition-all duration-700`}
                style={{ width: `${stat.mastery}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
