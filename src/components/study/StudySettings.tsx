import { useEffect, useState } from 'react'
import type { StudySettingsPorts } from '../../study/ports'
import type { HostStudyLaunchContext, StudyLearnerPreferences } from '../../study/types'
import './study-host.css'

export function StudySettings({ context, ports, onBack }: {
  context: HostStudyLaunchContext
  ports: StudySettingsPorts
  onBack: () => void
}) {
  const scope = { householdRef: context.householdRef, learnerRef: context.learnerRef }
  const [preferences, setPreferences] = useState<StudyLearnerPreferences>({
    accessibility: context.accessibility,
    timerPreference: context.timerPreference,
  })
  const [status, setStatus] = useState('')
  useEffect(() => { ports.persistence.loadPreferences(scope).then(setPreferences).catch(() => setStatus('Settings could not be loaded safely.')) }, [context.learnerRef, ports])

  const toggle = (key: keyof StudyLearnerPreferences['accessibility']) => {
    setPreferences((current) => ({
      ...current,
      accessibility: { ...current.accessibility, [key]: !current.accessibility[key] },
    }))
  }
  const save = async () => {
    try {
      await ports.persistence.savePreferences(scope, preferences)
      setStatus('Study settings saved for this local session. They are not durable yet.')
    } catch {
      setStatus('Settings were not saved.')
    }
  }
  return (
    <div className="study-runtime-host min-h-screen bg-slate-50" data-large-text={preferences.accessibility.largeText} data-high-contrast={preferences.accessibility.highContrast} data-reduced-motion={preferences.accessibility.reducedMotion}>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <button className="rounded-lg border border-slate-300 bg-white px-4 py-2" onClick={onBack}>Back to Study plan</button>
        <h1 className="mt-5 text-3xl font-bold">Learner Study settings</h1>
        <p className="mt-2 text-slate-600">These preferences are scoped to the selected learner and remain inside the provisional in-memory port.</p>
        <fieldset className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <legend className="px-2 text-lg font-bold">Accessibility</legend>
          {([
            ['largeText', 'Large text'],
            ['reducedMotion', 'Reduced motion'],
            ['noAudio', 'No audio'],
            ['captions', 'Captions'],
            ['transientTranscript', 'Transient Jarvis transcript'],
            ['highContrast', 'High contrast'],
            ['oneTaskAtATime', 'One task at a time'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 p-3">
              <input type="checkbox" checked={preferences.accessibility[key]} onChange={() => toggle(key)} />
              <span className="font-semibold">{label}</span>
            </label>
          ))}
          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 p-3">
            <input
              type="checkbox"
              checked={preferences.timerPreference.visibility === 'hidden'}
              onChange={(event) => setPreferences((current) => ({
                ...current,
                timerPreference: {
                  visibility: event.target.checked ? 'hidden' : 'shown',
                  milestonesOnly: event.target.checked,
                },
              }))}
            />
            <span className="font-semibold">Hide the countdown timer</span>
          </label>
        </fieldset>
        <button className="mt-5 w-full rounded-lg bg-cyan-700 px-5 py-3 font-bold text-white sm:w-auto" onClick={save}>Save Study settings</button>
        {status && <p className="mt-3" role="status">{status}</p>}
      </main>
    </div>
  )
}
