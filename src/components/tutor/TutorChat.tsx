import { useMemo, useRef, useState } from 'react'
import type { Profile, TutorChat as TutorChatT, TutorMessage } from '../../types'
import type { SkillId } from '../../skills'
import { useTheme } from '../../theme'
import { getVoicePrefs, isTeen, type ResolvedVoicePrefs } from '../../tutor/tutorState'
import { speak } from '../../tutor/voice'
import {
  CLOSEOUT_REPLY,
  NAPPING_REPLY,
  SCRIPTED_FLAG_REPLY,
  buildSystemPrompt,
  isConcerning,
  sanitizeReply,
} from '../../tutor/tutorEngine'
import {
  ANTHROPIC_ENDPOINT_BASE,
  askTutor,
  defaultTutorApiDeps,
  hasTutorKey,
  type AnthropicMessage,
  type TutorApiDeps,
} from '../../tutor/tutorApi'
import {
  appendMessage,
  atDailyCap,
  atExchangeLimit,
  flagFromTutor,
  newTutorChat,
  recordCall,
  saveChat,
} from '../../tutor/tutorChat'
import { PushToTalkMic, micSupported } from './PushToTalkMic'

/** The one question a tutor chat is locked to. */
export interface TutorQuestionContext {
  skillId: SkillId
  problem: string
  correctAnswer: string
  herAnswer: string
}

interface TutorChatProps {
  profile: Profile
  question: TutorQuestionContext
  muted: boolean
  /** functional profile writer (CLAUDE.md rule 6) — chats/calls/flags persist through this. */
  onProfileChange: (update: (prev: Profile) => Profile) => void
  onClose: () => void
  // ---- test seams (default to real runtime) ----
  now?: () => number
  today?: string
  apiDeps?: TutorApiDeps
  makeId?: () => string
  /** override voice prefs in tests; defaults to the profile's mathTutor slot. */
  voice?: ResolvedVoicePrefs
}

const CAP_REPLY = "You've asked lots of great questions today! Let's check with Dad if you need more."

/** Map the transcript to Anthropic messages — only real exchanges (kid + api tutor). */
function toApiMessages(chat: TutorChatT): AnthropicMessage[] {
  const out: AnthropicMessage[] = []
  for (const m of chat.messages) {
    if (m.role === 'kid') out.push({ role: 'user', content: m.text })
    else if (m.source === 'api') out.push({ role: 'assistant', content: m.text })
  }
  return out
}

export function TutorChat({
  profile,
  question,
  muted,
  onProfileChange,
  onClose,
  now = () => Date.now(),
  today = todayISO(),
  apiDeps,
  makeId = () => `chat_${Math.random().toString(36).slice(2, 10)}`,
  voice,
}: TutorChatProps) {
  const t = useTheme()
  const deps = apiDeps ?? defaultTutorApiDeps()
  const prefs = voice ?? getVoicePrefs(profile)
  const grade = profile.grade
  const showMic = !isTeen(grade) && micSupported() // teens keep keyboard default

  const chatRef = useRef<TutorChatT>(
    newTutorChat(
      { ...question, grade },
      makeId(),
      now(),
      today,
    ),
  )
  const [messages, setMessages] = useState<TutorMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [ended, setEnded] = useState<null | 'flagged' | 'capped' | 'closed'>(null)

  const sayIfAllowed = (text: string) => {
    if (prefs.enabled && !muted) speak(text, { voiceURI: prefs.voiceURI, rate: prefs.rate })
  }

  /** Commit a message to the local transcript + persist the chat (optionally recording a call / flag). */
  const commit = (
    msg: TutorMessage,
    opts: { call?: boolean; flag?: boolean; outcome?: 'flagged' | 'closed'; reason?: string } = {},
  ) => {
    chatRef.current = appendMessage(chatRef.current, msg)
    if (opts.outcome) chatRef.current = { ...chatRef.current, outcome: opts.outcome }
    setMessages(chatRef.current.messages)
    const ts = msg.ts
    const chat = chatRef.current
    onProfileChange((prev) => {
      let next = opts.call ? recordCall(prev, ts) : prev
      if (opts.flag) next = flagFromTutor(next, question.skillId, opts.reason ?? 'tutor chat', today)
      return saveChat(next, chat, ts)
    })
  }

  async function send(raw: string) {
    const text = raw.trim()
    if (!text || busy || ended) return
    setInput('')

    // 1. concerning content → scripted flag reply, no API, raise Dad flag, end.
    if (isConcerning(text)) {
      commit({ role: 'kid', text, ts: now() })
      commit(
        { role: 'tutor', text: SCRIPTED_FLAG_REPLY, ts: now(), source: 'scripted' },
        { flag: true, outcome: 'flagged', reason: 'tutor chat: flagged for Dad' },
      )
      sayIfAllowed(SCRIPTED_FLAG_REPLY)
      setEnded('flagged')
      return
    }

    // 2. 6-exchange limit → warm close-out + Dad flag, no API.
    if (atExchangeLimit(chatRef.current)) {
      commit({ role: 'kid', text, ts: now() })
      commit(
        { role: 'tutor', text: CLOSEOUT_REPLY, ts: now(), source: 'scripted' },
        { flag: true, outcome: 'flagged', reason: 'tutor chat: 6 exchanges, needs Dad' },
      )
      sayIfAllowed(CLOSEOUT_REPLY)
      setEnded('flagged')
      return
    }

    // 3. daily cap → scripted cap line, no API, no flag.
    if (atDailyCap(profile, today)) {
      commit({ role: 'kid', text, ts: now() })
      commit({ role: 'tutor', text: CAP_REPLY, ts: now(), source: 'scripted' })
      setEnded('capped')
      return
    }

    // 4. real turn.
    commit({ role: 'kid', text, ts: now() })
    setBusy(true)
    const system = buildSystemPrompt({
      grade,
      problem: question.problem,
      correctAnswer: question.correctAnswer,
      herAnswer: question.herAnswer,
    })
    const result = await askTutor(deps, {
      system,
      messages: toApiMessages(chatRef.current),
      gateway: {
        mode: 'tutor',
        context: {
          grade,
          problem: question.problem,
          correctAnswer: question.correctAnswer,
          studentAnswer: question.herAnswer,
          graded: false,
        },
      },
    })
    setBusy(false)

    if (!result.ok) {
      // no key / offline / api error → napping, degrade gracefully (no call recorded).
      commit({ role: 'tutor', text: NAPPING_REPLY, ts: now(), source: 'scripted' })
      return
    }
    // answer-leak redaction runs on EVERY model reply.
    const safe = sanitizeReply(result.text, question.correctAnswer).text
    commit({ role: 'tutor', text: safe, ts: now(), source: 'api' }, { call: true })
    sayIfAllowed(safe)
  }

  const disabled = busy || ended !== null
  const keyless = useMemo(() => ANTHROPIC_ENDPOINT_BASE === '' && !hasTutorKey(), [])

  return (
    <div className={`${t.card} mt-6 flex flex-col p-5`}>
      <div className="flex items-center justify-between gap-2">
        <div className={`text-lg font-extrabold ${t.heading}`}>{t.bigEmoji ? '💬 ' : ''}Ask the tutor</div>
        <button onClick={onClose} className={`${t.secondaryBtn} px-3 py-2 text-sm`} aria-label="close tutor chat">
          Close ✕
        </button>
      </div>
      <div className={`mt-1 text-xs font-semibold ${t.sub}`}>
        About this problem only · the tutor gives hints, never the answer
      </div>

      {/* transcript */}
      <div className="mt-4 flex max-h-80 flex-col gap-2 overflow-y-auto">
        {messages.length === 0 && (
          <div className={`rounded-2xl border-2 border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900`}>
            Stuck? Tell me what part is tricky and I'll help you think it through. 💛
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === 'kid'
                ? 'self-end rounded-2xl bg-violet-500 px-4 py-2 text-white'
                : 'self-start rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-2 font-bold text-amber-900'
            }
          >
            {m.text}
          </div>
        ))}
        {busy && <div className={`self-start text-sm font-semibold ${t.sub}`}>the tutor is thinking…</div>}
      </div>

      {ended === 'flagged' && (
        <div className="mt-3 rounded-xl bg-rose-50 p-3 text-center text-sm font-bold text-rose-700">
          Flagged for Dad 💛 — he'll help you with this one.
        </div>
      )}
      {ended === 'capped' && (
        <div className="mt-3 rounded-xl bg-slate-100 p-3 text-center text-sm font-bold text-slate-600">
          That's all the tutor questions for today.
        </div>
      )}

      {/* input row */}
      {ended === null && (
        <div className="mt-3 flex items-end gap-2">
          {showMic && <PushToTalkMic onTranscript={(txt) => setInput(txt)} disabled={disabled} />}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send(input)
              }
            }}
            rows={2}
            disabled={disabled}
            placeholder={showMic ? 'Type, or hold the mic to talk…' : 'Type your question…'}
            aria-label="message to the tutor"
            className="min-w-0 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-base text-slate-800 disabled:opacity-50"
          />
          <button
            onClick={() => void send(input)}
            disabled={disabled || !input.trim()}
            className={`${t.primaryBtn} px-5 py-3 text-base disabled:opacity-40`}
          >
            Send ▶
          </button>
        </div>
      )}
      {keyless && ended === null && (
        <div className={`mt-2 text-center text-xs font-semibold ${t.sub}`}>
          The tutor needs Dad to add a key in the Grown-Ups panel.
        </div>
      )}
    </div>
  )
}

/** Local YYYY-MM-DD (family-calendar date, matching appState.isoToday). */
function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
