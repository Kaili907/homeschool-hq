import type { Profile } from '../../types'
import { isoToday } from '../../appState'
import { useTheme } from '../../theme'
import { mindsetWeek } from '../../mindset/content'
import { currentWeek, isWeekComplete } from '../../mindset/mindset'

interface Props {
  profile: Profile
  startDate: string | undefined
  onOpen: () => void
}

/**
 * Home entry for the weekly mindset lesson + the persistent habit card.
 * Renders nothing until the first week unlocks. Calm and minimal — no confetti,
 * no stars, no counters. This is the quiet corner of the app.
 */
export function MindsetCard({ profile, startDate, onOpen }: Props) {
  const t = useTheme()
  const today = isoToday()
  const week = currentWeek(startDate, today)
  if (week === 0) return null

  const lesson = mindsetWeek(week)
  if (!lesson) return null
  const done = isWeekComplete(profile, week)

  return (
    <div className="mt-6">
      <button
        onClick={onOpen}
        className={`${t.card} flex w-full items-center gap-4 p-5 text-left transition-all hover:border-emerald-300`}
      >
        <span className="text-4xl">🧠</span>
        <span className="flex-1">
          <span className={`block text-xl font-extrabold ${t.heading}`}>Mindset lesson</span>
          <span className={`block font-bold ${t.sub}`}>
            Week {week}: {lesson.title}
          </span>
        </span>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
            done ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
          }`}
        >
          {done ? 'done ✓' : '5 min'}
        </span>
      </button>

      {/* the week's habit — present on Home all week once she's done the lesson */}
      {done && (
        <div className={`${t.card} mt-3 border-l-4 border-emerald-400 p-4`}>
          <span className={`text-xs font-bold uppercase tracking-wide ${t.sub}`}>This week</span>
          <p className={`mt-1 font-bold ${t.heading}`}>{lesson.habit}</p>
        </div>
      )}
    </div>
  )
}
