import { SKILLS } from '../skills'
import type { Profile } from '../types'
import { getStat, statusOf } from '../appState'
import { useTheme } from '../theme'

export function SkillTree({ profile }: { profile: Profile }) {
  const t = useTheme()
  const style = {
    mastered: { chip: t.chipMastered, label: t.cheers === 'full' ? 'Mastered ⭐' : 'Mastered', bar: t.barMastered },
    developing: { chip: t.chipDeveloping, label: t.cheers === 'full' ? 'Growing 🌱' : 'In progress', bar: t.barDeveloping },
    'not-started': { chip: t.chipNotStarted, label: 'Not started', bar: t.barNotStarted },
  } as const
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {SKILLS.map((s) => {
        const stat = getStat(profile, s.id)
        const status = statusOf(profile.skills[s.id])
        const ui = style[status]
        return (
          <div key={s.id} className={`${t.card} p-4`}>
            <div className="flex items-start justify-between gap-2">
              {t.bigEmoji ? <div className="text-4xl">{s.emoji}</div> : <div />}
              <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${ui.chip}`}>{ui.label}</span>
            </div>
            <div className={`mt-2 text-lg font-extrabold leading-tight ${t.heading}`}>{s.name}</div>
            <div className={`text-sm font-semibold ${t.sub}`}>{s.blurb}</div>
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${ui.bar} transition-all duration-700`}
                style={{ width: `${stat.mastery}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
