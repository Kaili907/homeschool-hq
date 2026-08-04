import type { AppState, Grade, Profile } from '../types'

const GRADE_EMOJI: Record<Grade, string> = {
  '3': '🦄',
  '4': '🦊',
  '5': '🦉',
  '6': '🎨',
  '7': '🚀',
  '8': '🔬',
  '10': '📘',
  '12': '🎓',
}

const GRADE_LABEL: Record<Grade, string> = {
  '3': '3rd grade',
  '4': '4th grade',
  '5': '5th grade',
  '6': '6th grade',
  '7': '7th grade',
  '8': '8th grade',
  '10': '10th grade',
  '12': '12th grade',
}

const CARD_ACCENT: Record<Profile['theme'], string> = {
  playful:
    'rounded-3xl border-b-8 border-fuchsia-700 bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white shadow-xl hover:scale-[1.03] active:translate-y-1 active:border-b-4',
  cool: 'rounded-2xl border-b-8 border-cyan-800 bg-gradient-to-br from-cyan-500 to-indigo-500 text-white shadow-xl hover:scale-[1.03] active:translate-y-1 active:border-b-4',
  clean:
    'rounded-xl border border-slate-300 bg-white text-slate-800 shadow-md hover:border-slate-500 hover:shadow-lg',
}

interface PickerProps {
  state: AppState
  migrationBanner?: { onDownload: () => void; onDismiss: () => void }
  onPick: (profileId: string) => void
  onGrownUps: () => void
}

export function Picker({ state, migrationBanner, onPick, onGrownUps }: PickerProps) {
  const profiles = Object.values(state.profiles)
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-10"
      style={{
        background: 'linear-gradient(160deg, #ede9fe 0%, #e0f2fe 45%, #fef9c3 100%)',
        fontFamily: '"Comic Sans MS", "Comic Neue", "Segoe UI", system-ui, sans-serif',
      }}
    >
      {migrationBanner && (
        <div className="mb-6 flex w-full max-w-2xl flex-wrap items-center justify-between gap-2 rounded-2xl bg-green-100 p-3 text-sm font-bold text-green-800 shadow">
          <span>✅ Your old progress was moved over safely. A backup was saved.</span>
          <span className="flex gap-2">
            <button
              onClick={migrationBanner.onDownload}
              className="rounded-xl bg-green-600 px-3 py-1 text-white hover:bg-green-700"
            >
              Download backup
            </button>
            <button
              onClick={migrationBanner.onDismiss}
              className="rounded-xl bg-white px-3 py-1 text-green-700 hover:bg-green-50"
            >
              OK
            </button>
          </span>
        </div>
      )}

      <h1 className="text-4xl font-extrabold text-violet-900 sm:text-5xl">🏠 Homeschool HQ</h1>
      <p className="mt-1 text-lg font-bold text-violet-600">Who's learning today?</p>

      <div className="mt-8 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {profiles.map((p) => (
          <button
            key={p.id}
            onClick={() => onPick(p.id)}
            className={`p-5 text-left transition-all ${CARD_ACCENT[p.theme]}`}
          >
            <div className="text-4xl">{GRADE_EMOJI[p.grade]}</div>
            <div className="mt-1 truncate text-2xl font-extrabold">{p.name}</div>
            <div className={`text-sm font-bold ${p.theme === 'clean' ? 'text-slate-500' : 'text-white/80'}`}>
              {GRADE_LABEL[p.grade]}
              {p.pin === '' && ' · first sign-in'}
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={onGrownUps}
        className="mt-10 rounded-2xl bg-white/80 px-6 py-3 font-extrabold text-slate-600 shadow hover:bg-white"
      >
        🔒 Grown-Ups
      </button>
    </div>
  )
}
