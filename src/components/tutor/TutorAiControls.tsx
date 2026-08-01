import { useState, type Dispatch, type SetStateAction } from 'react'
import type { AppState, Profile } from '../../types'
import { isoToday, updateProfile } from '../../appState'
import {
  getTutorModel,
  setTutorModel,
  type TutorModelChoice,
} from '../../tutor/tutorApi'
import { DEFAULT_DAILY_CAP } from '../../tutor/tutorEngine'
import { dailyCap, setDailyCap } from '../../tutor/tutorChat'
import { TutorChatsView } from './TutorChatsView'

const box = 'rounded-xl border border-slate-200 bg-white p-4'

/** Grown-Ups controls for the secured gateway tier, local caps, and transcripts. */
export function TutorAiControls({
  state,
  onStateChange,
}: {
  state: AppState
  onStateChange: Dispatch<SetStateAction<AppState>>
}) {
  const today = isoToday()
  const [open, setOpen] = useState<string | null>(null)
  const [model, setModel] = useState<TutorModelChoice>(getTutorModel())

  const chooseModel = (choice: TutorModelChoice) => {
    setTutorModel(choice)
    setModel(choice)
  }
  const setCap = (profile: Profile, value: number) =>
    onStateChange((current) =>
      current.profiles[profile.id]
        ? updateProfile(current, setDailyCap(current.profiles[profile.id], value))
        : current,
    )

  return (
    <div className="space-y-3">
      <div className={box}>
        <div className="font-bold text-slate-800">Academy AI gateway</div>
        <div className="mt-0.5 text-xs text-slate-500">
          Provider credentials and spending limits are enforced server-side. This browser never stores or sends a provider key.
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
          <span className="text-sm font-semibold text-slate-700">Tutor model</span>
          <label className="flex items-center gap-1.5 text-sm text-slate-700">
            <input
              type="radio"
              name="tutor-model"
              checked={model === 'sonnet'}
              onChange={() => chooseModel('sonnet')}
            />
            Sonnet — best at following the safety rules <span className="text-slate-400">(recommended)</span>
          </label>
          <label className="flex items-center gap-1.5 text-sm text-slate-700">
            <input
              type="radio"
              name="tutor-model"
              checked={model === 'haiku'}
              onChange={() => chooseModel('haiku')}
            />
            Haiku — faster &amp; cheaper
          </label>
        </div>
      </div>

      {Object.values(state.profiles).map((profile) => {
        const expanded = open === profile.id
        return (
          <div key={profile.id} className={box}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-32 font-bold text-slate-800">{profile.name}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                Grade {profile.grade}
              </span>
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                Daily tutor cap
                <input
                  type="number"
                  min={0}
                  value={dailyCap(profile)}
                  onChange={(event) => setCap(profile, Number(event.target.value))}
                  className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-800"
                  aria-label={`daily tutor cap for ${profile.name}`}
                />
                <span className="text-slate-400">(default {DEFAULT_DAILY_CAP})</span>
              </label>
              <button
                onClick={() => setOpen(expanded ? null : profile.id)}
                className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                {expanded ? 'Hide chats' : 'Tutor chats'}
              </button>
            </div>
            {expanded && (
              <div className="mt-3">
                <TutorChatsView profile={profile} today={today} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
