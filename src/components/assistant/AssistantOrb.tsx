import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../../theme'
import { isoToday } from '../../appState'
import { PushToTalkMic } from '../tutor/PushToTalkMic'
import { speak, cancelSpeech, encodeVoiceRef } from '../../tutor/voice'
import { getVoicePrefs, resolveSlotRef } from '../../tutor/tutorState'
import { defaultTutorApiDeps } from '../../tutor/tutorApi'
import type { AssistantMessage, AssistantSession, Profile } from '../../types'
import {
  appendAssistantMessage,
  assistantDailyCap,
  assistantName,
  callsInMonth,
  newAssistantSession,
  recordAssistantCall,
  saveAssistantSession,
} from '../../assistant/assistantState'
import { runAssistantTurn } from '../../assistant/engine'
import { actionLogLabel, type AssistantAction } from '../../assistant/actions'

/**
 * MJ HS-assistant — the teen-home orb.
 *
 * Tap-and-hold the orb to talk (reuses MT-3 push-to-talk: the transcript lands in
 * the box for her to review before Send — no auto-send, no wake word), or type.
 * Replies come back in text and, if she has voice on, spoken through the MT-V
 * `assistant` slot. Proposed actions appear as a Confirm chip — nothing executes
 * until she taps it. Offline → the orb is disabled ("Assistant is offline").
 */

const rid = () => Math.random().toString(36).slice(2, 9)

interface Props {
  profile: Profile
  muted: boolean
  onProfileChange: (update: (prev: Profile) => Profile) => void
  onCheckMission: (itemId: string) => void
  onMarkCollegeTask: (taskId: string) => void
  onStartSession: (target: string) => void
}

export function AssistantOrb({
  profile,
  muted,
  onProfileChange,
  onCheckMission,
  onMarkCollegeTask,
  onStartSession,
}: Props) {
  const t = useTheme()
  const name = assistantName(profile)
  const today = isoToday()

  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const available = online

  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [session, setSession] = useState<AssistantSession>(() => newAssistantSession(rid(), Date.now(), today))
  const [pending, setPending] = useState<AssistantAction | null>(null)

  const voice = getVoicePrefs(profile)
  const canSpeak = !muted && voice.enabled
  const assistantVoiceRef = encodeVoiceRef(resolveSlotRef(profile, 'assistant'))

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
      cancelSpeech()
    }
  }, [])

  const say = (text: string) => {
    if (canSpeak) speak(text, { voiceURI: assistantVoiceRef, rate: voice.rate })
  }

  /** Append a message to the live session AND persist it (composing on prev). */
  const commit = (msg: AssistantMessage, opts: { call?: boolean } = {}) => {
    setSession((prev) => {
      const next = appendAssistantMessage(prev, msg)
      const now = msg.ts
      onProfileChange((p) => {
        const saved = saveAssistantSession(p, next, now)
        return opts.call ? recordAssistantCall(saved, now) : saved
      })
      return next
    })
  }

  const send = async (raw: string) => {
    const userText = raw.trim()
    if (!userText || sending || !available) return
    setInput('')
    setPending(null)
    const now = Date.now()
    commit({ role: 'girl', text: userText, ts: now })
    setSending(true)
    try {
      const res = await runAssistantTurn(defaultTutorApiDeps(), {
        profile,
        today,
        history: session.messages,
        userText,
      })
      const ts = Date.now()
      if (res.kind === 'flagged') {
        commit({ role: 'assistant', text: res.text, ts, source: 'scripted', flagged: true })
        say(res.text)
      } else if (res.kind === 'reply') {
        commit({ role: 'assistant', text: res.text, ts, source: 'api' }, { call: true })
        if (res.action) setPending(res.action)
        say(res.text)
      } else {
        // capped / offline — a local scripted line, no call recorded
        commit({ role: 'assistant', text: res.text, ts, source: 'scripted' })
      }
    } finally {
      setSending(false)
    }
  }

  const confirmAction = (action: AssistantAction) => {
    // execute the real effect (mutation lives in the parent surface)…
    if (action.kind === 'check_mission') onCheckMission(action.target)
    else if (action.kind === 'mark_college_task') onMarkCollegeTask(action.target)
    else if (action.kind === 'start_session') onStartSession(action.target)
    // …and log it into the transcript
    const ts = Date.now()
    commit({
      role: 'assistant',
      text: actionLogLabel(action),
      ts,
      source: 'scripted',
      action: { kind: action.kind, label: action.label, targetKey: action.key, ts },
    })
    setPending(null)
  }

  const monthCount = callsInMonth(profile, today)
  const cap = assistantDailyCap(profile)

  // ---------- disabled (offline) ----------
  if (!available) {
    return (
      <div className={`${t.card} mt-2 flex items-center gap-3 p-4 opacity-80`}>
        <span className="text-2xl grayscale" aria-hidden>
          🔵
        </span>
        <div>
          <div className={`font-bold ${t.heading}`}>{name} is offline</div>
          <div className={`text-xs ${t.sub}`}>
            No connection right now.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`${t.card} mt-2 p-4`}>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2"
          aria-expanded={open}
        >
          <span className="text-2xl" aria-hidden>
            🔵
          </span>
          <span className={`font-bold ${t.heading}`}>{name}</span>
        </button>
        <span className={`text-xs ${t.sub}`}>your school-day assistant</span>
        <span className="ml-auto text-[11px] font-semibold text-slate-400">{monthCount} used this month</span>
      </div>

      {/* transcript */}
      {open && session.messages.length > 0 && (
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
          {session.messages.map((m, i) => (
            <div key={i} className={m.role === 'girl' ? 'text-right' : 'text-left'}>
              <span
                className={`inline-block max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${
                  m.role === 'girl'
                    ? 'bg-slate-800 text-white'
                    : m.flagged
                      ? 'bg-amber-100 font-semibold text-amber-900'
                      : m.action
                        ? 'bg-emerald-100 font-semibold text-emerald-900'
                        : 'bg-white text-slate-800 shadow-sm'
                }`}
              >
                {m.text}
              </span>
            </div>
          ))}
          {sending && <div className="text-left text-xs italic text-slate-400">{name} is thinking…</div>}
        </div>
      )}

      {/* confirm chip for a proposed action */}
      {pending && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-2">
          <span className="flex-1 text-sm font-semibold text-emerald-900">{pending.label}?</span>
          <button
            onClick={() => confirmAction(pending)}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
          >
            Confirm
          </button>
          <button
            onClick={() => setPending(null)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            No
          </button>
        </div>
      )}

      {/* input row: type or tap-and-hold to talk */}
      <div className="mt-3 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send(input)
            }
          }}
          onFocus={() => setOpen(true)}
          placeholder={`Ask ${name}…`}
          disabled={sending}
          className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800"
          aria-label={`message ${name}`}
        />
        <PushToTalkMic
          onTranscript={(text) => {
            setOpen(true)
            setInput((cur) => (cur ? `${cur} ${text}` : text))
          }}
          disabled={sending}
        />
        <button
          onClick={() => void send(input)}
          disabled={sending || !input.trim()}
          className={`${t.primaryBtn} px-4 py-2 text-sm disabled:opacity-40`}
        >
          Send
        </button>
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        Coaches, never completes — daily limit {cap}. Hold 🎤 to talk; you review before sending.
      </p>
    </div>
  )
}
