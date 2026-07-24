import { useState, type Dispatch, type SetStateAction } from 'react'
import type { AppState, Profile } from '../../types'
import { isoToday, updateProfile } from '../../appState'
import {
  DEFAULT_ASSISTANT_CAP,
  DEFAULT_ASSISTANT_NAME,
  assistantDailyCap,
  assistantName,
  assistantPersona,
  callsInMonth,
  callsOnDay,
  recentAssistantSessions,
  setAssistantDailyCap,
  setAssistantName,
  setAssistantPersona,
} from '../../assistant/assistantState'

/**
 * MJ HS-assistant — the ONE small tutor-adjacent Grown-Ups block (MP owns the wider
 * Grown-Ups rework, so this stays deliberately compact). Per-teen: assistant name,
 * persona line, daily cap (default 40) + month meter, and transcripts (flagged turns
 * highlighted). The `assistant` VOICE is set in the existing Tutor & Voice grid.
 * Teens (grades 10/12) only.
 */

const box = 'rounded-xl border border-slate-200 bg-white p-4'
const isTeen = (p: Profile) => p.grade === '10' || p.grade === '12'

export function AssistantGrownUps({
  state,
  onStateChange,
}: {
  state: AppState
  onStateChange: Dispatch<SetStateAction<AppState>>
}) {
  const today = isoToday()
  const [open, setOpen] = useState<string | null>(null)
  const teens = Object.values(state.profiles).filter(isTeen)

  const patch = (id: string, update: (p: Profile) => Profile) =>
    onStateChange((s) => (s.profiles[id] ? updateProfile(s, update(s.profiles[id])) : s))

  if (teens.length === 0) {
    return <div className={`${box} text-sm text-slate-500`}>No high-school profiles yet.</div>
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-500">
        The assistant shares the Anthropic key &amp; model with the AI Tutor above. Its voice is the
        <strong> HS assistant</strong> slot in Tutor &amp; Voice. It never writes submittable work or
        assessment answers, and every action needs her Confirm tap.
      </div>
      {teens.map((p) => {
        const expanded = open === p.id
        const sessions = recentAssistantSessions(p)
        return (
          <div key={p.id} className={box}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-28 font-bold text-slate-800">{p.name}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                Grade {p.grade}
              </span>
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                Name
                <input
                  value={p.assistant?.name ?? ''}
                  onChange={(e) => patch(p.id, (prev) => setAssistantName(prev, e.target.value))}
                  placeholder={DEFAULT_ASSISTANT_NAME}
                  className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-800"
                  aria-label={`assistant name for ${p.name}`}
                />
              </label>
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                Daily cap
                <input
                  type="number"
                  min={0}
                  value={assistantDailyCap(p)}
                  onChange={(e) => patch(p.id, (prev) => setAssistantDailyCap(prev, Number(e.target.value)))}
                  className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-800"
                  aria-label={`assistant daily cap for ${p.name}`}
                />
                <span className="text-slate-400">(default {DEFAULT_ASSISTANT_CAP})</span>
              </label>
              <button
                onClick={() => setOpen(expanded ? null : p.id)}
                className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                {expanded ? 'Hide transcripts' : 'Transcripts'}
              </button>
            </div>

            <label className="mt-2 block text-xs font-semibold text-slate-500">
              Persona line (tone only — never softens the rules)
              <input
                value={p.assistant?.persona ?? ''}
                onChange={(e) => patch(p.id, (prev) => setAssistantPersona(prev, e.target.value))}
                placeholder="dry, competent, encouraging — brief"
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-800"
                aria-label={`assistant persona for ${p.name}`}
              />
            </label>

            <div className="mt-2 text-xs text-slate-500">
              Today {callsOnDay(p, today)}/{assistantDailyCap(p)} · this month {callsInMonth(p, today)} ·
              using <strong>{assistantName(p)}</strong>
              {assistantPersona(p) ? ` — "${assistantPersona(p)}"` : ''}
            </div>

            {expanded && (
              <div className="mt-3 space-y-2">
                {sessions.length === 0 ? (
                  <div className="text-sm text-slate-400">No conversations yet.</div>
                ) : (
                  sessions.slice(0, 8).map((s) => (
                    <div key={s.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <div className="mb-1 text-xs font-bold text-slate-500">
                        {s.day}
                        {s.messages.some((m) => m.flagged) && (
                          <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                            ⚠ flagged — check in with her
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {s.messages.map((m, i) => (
                          <div
                            key={i}
                            className={`text-xs ${
                              m.role === 'girl'
                                ? 'text-slate-700'
                                : m.flagged
                                  ? 'font-semibold text-amber-800'
                                  : m.action
                                    ? 'font-semibold text-emerald-700'
                                    : 'text-slate-500'
                            }`}
                          >
                            <span className="font-bold">{m.role === 'girl' ? `${p.name}: ` : `${assistantName(p)}: `}</span>
                            {m.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
