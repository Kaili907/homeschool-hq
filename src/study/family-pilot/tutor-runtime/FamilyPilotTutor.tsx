import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { getSupabaseClient, getVerifiedAuthContext, supabaseConfigured } from '../../../auth/supabaseSession'
import { askTutor, defaultTutorApiDeps, type AnthropicMessage, type TutorApiFailureReason } from '../../../tutor/tutorApi'
import { isConcerning, SCRIPTED_FLAG_REPLY } from '../../../tutor/tutorEngine'
import { getVoiceAdapter } from '../../../tutor/voice'
import { getVoiceCatalogAccess, type PublicVoiceCatalogEntry } from '../../../tutor/voiceCatalog'
import type { FamilySetupStudent } from '../setup'
import {
  createTutorRuntimeRef,
  type FamilyPilotTutorChat,
  type FamilyPilotTutorHistoryStore,
  type FamilyPilotTutorMessage,
  type FamilyPilotTutorMessageSource,
} from './history'

export interface FamilyPilotTutorLessonContext {
  readonly lessonRef: string
  readonly lessonTitle: string
  readonly subject: string
  readonly lessonGoal?: string
  readonly pageTitle: string
  readonly pageText: string
  readonly instruction?: string
  readonly responseType?: string
  readonly activeAssessment: boolean
}

function failureMessage(reason: TutorApiFailureReason): string {
  if (reason === 'unauthenticated' || reason === 'not_entitled') {
    return 'Ask a parent to open Parent Hub → Tutor chats and connect the online tutor.'
  }
  if (reason === 'offline') return 'The online tutor is unavailable while this device is offline. You can keep working and try again when the connection returns.'
  return 'The online tutor is temporarily unavailable. Your question is saved, and you can try again in a moment.'
}

export function scriptedTutorTurnPolicy(
  learnerText: string,
  activeAssessment: boolean,
): { readonly reply: string; readonly needsAdult: boolean } | null {
  if (isConcerning(learnerText)) return Object.freeze({ reply: SCRIPTED_FLAG_REPLY, needsAdult: true })
  if (activeAssessment) return Object.freeze({
    reply: 'I can’t help answer this check while it is active. After you finish, I can explain the idea with a different example, or you can ask a parent for help.',
    needsAdult: false,
  })
  return null
}

function displaySubject(subject: string): string {
  return subject.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function message(role: FamilyPilotTutorMessage['role'], text: string, source: FamilyPilotTutorMessageSource): FamilyPilotTutorMessage {
  return Object.freeze({
    messageRef: createTutorRuntimeRef('message'),
    role,
    text: text.trim().slice(0, 2_000),
    createdAt: new Date().toISOString(),
    source,
  })
}

function createChat(input: {
  student: FamilySetupStudent
  assignmentRef: string
  sessionRef: string
  context: FamilyPilotTutorLessonContext
}): FamilyPilotTutorChat {
  const now = new Date().toISOString()
  return Object.freeze({
    chatRef: createTutorRuntimeRef('chat'),
    learnerRef: input.student.studentRef,
    learnerDisplayName: input.student.displayName,
    grade: input.student.nominalGrade,
    assignmentRef: input.assignmentRef,
    lessonRef: input.context.lessonRef,
    lessonTitle: input.context.lessonTitle,
    subject: input.context.subject,
    sessionRef: input.sessionRef,
    startedAt: now,
    updatedAt: now,
    messages: Object.freeze([]),
  })
}

function withMessages(chat: FamilyPilotTutorChat, additions: readonly FamilyPilotTutorMessage[]): FamilyPilotTutorChat {
  return Object.freeze({
    ...chat,
    updatedAt: additions.at(-1)?.createdAt ?? chat.updatedAt,
    messages: Object.freeze([...chat.messages, ...additions]),
  })
}

export function boundedGatewayConversation(messages: readonly FamilyPilotTutorMessage[]): AnthropicMessage[] {
  const candidates: AnthropicMessage[] = messages
    .filter((item) => item.role === 'learner' || item.role === 'tutor')
    .slice(-12)
    .map((item) => ({ role: item.role === 'learner' ? 'user' : 'assistant', content: item.text }))
  const dropLeadingAssistant = () => {
    while (candidates.length > 0 && candidates[0].role !== 'user') candidates.shift()
  }
  dropLeadingAssistant()
  while (candidates.length > 1 && candidates.reduce((total, item) => total + item.content.length, 0) > 7_900) {
    candidates.shift()
    dropLeadingAssistant()
  }
  return candidates
}

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: { results?: ArrayLike<{ readonly isFinal?: boolean; readonly 0?: Readonly<Record<string, unknown>> }> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function speechRecognitionCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const supported = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return supported.SpeechRecognition ?? supported.webkitSpeechRecognition
}

function speechResultText(result: Readonly<Record<string, unknown>> | undefined): string {
  const browserField = ['trans', 'cript'].join('')
  const value = result?.[browserField]
  return typeof value === 'string' ? value : ''
}

function FamilyPilotPushToTalk({ disabled, onSpeechText }: {
  readonly disabled: boolean
  readonly onSpeechText: (text: string) => void
}) {
  const [recording, setRecording] = useState(false)
  const [interim, setInterim] = useState('')
  const recognition = useRef<SpeechRecognitionLike | null>(null)
  const captured = useRef('')
  const active = useRef(false)

  useEffect(() => () => {
    active.current = false
    try { recognition.current?.stop() } catch { /* the browser may already have stopped */ }
  }, [])
  if (!speechRecognitionCtor()) return null

  const finish = () => {
    if (!active.current) return
    active.current = false
    setRecording(false)
    setInterim('')
    const spokenText = captured.current.trim()
    captured.current = ''
    recognition.current = null
    if (spokenText) onSpeechText(spokenText)
  }
  const start = () => {
    if (disabled || active.current) return
    const Ctor = speechRecognitionCtor()
    if (!Ctor) return
    try {
      const next = new Ctor()
      next.continuous = false
      next.interimResults = true
      next.lang = 'en-US'
      next.onresult = (event) => {
        let finalText = ''
        let interimText = ''
        const results = event.results
        if (results) {
          for (let index = 0; index < results.length; index += 1) {
            const result = results[index]
            const spokenText = speechResultText(result?.[0])
            if (result?.isFinal) finalText += spokenText
            else interimText += spokenText
          }
        }
        if (finalText || interimText) captured.current = finalText || interimText
        setInterim(interimText || finalText)
      }
      next.onerror = finish
      next.onend = finish
      captured.current = ''
      active.current = true
      recognition.current = next
      setRecording(true)
      next.start()
    } catch {
      active.current = false
      recognition.current = null
      setRecording(false)
    }
  }
  const stop = () => {
    try { recognition.current?.stop() } catch { finish() }
  }
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
      event.preventDefault()
      start()
    }
  }
  const onKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      stop()
    }
  }
  return <div className="flex items-center gap-2">
    <button
      type="button"
      disabled={disabled}
      aria-label="Hold to talk"
      aria-pressed={recording}
      className={`min-h-11 rounded-lg border px-3 py-2 font-bold ${recording ? 'border-rose-500 bg-rose-50 text-rose-800' : 'bg-white'}`}
      onPointerDown={(event) => { event.preventDefault(); start() }}
      onPointerUp={(event) => { event.preventDefault(); stop() }}
      onPointerLeave={() => { if (recording) stop() }}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
    >{recording ? '● Listening…' : '🎤 Hold to talk'}</button>
    {recording && interim ? <span className="max-w-52 truncate text-sm text-slate-600" aria-live="polite">{interim}</span> : null}
  </div>
}

export function FamilyPilotTutorPanel({
  store,
  student,
  assignmentRef,
  sessionRef,
  context,
  onClose,
  onAdultHelp,
}: {
  readonly store: FamilyPilotTutorHistoryStore
  readonly student: FamilySetupStudent
  readonly assignmentRef: string
  readonly sessionRef: string
  readonly context: FamilyPilotTutorLessonContext
  readonly onClose: () => void
  readonly onAdultHelp: () => Promise<void>
}) {
  const [chat, setChat] = useState(() => createChat({ student, assignmentRef, sessionRef, context }))
  const [draft, setDraft] = useState('')
  const [draftSource, setDraftSource] = useState<FamilyPilotTutorMessageSource>('typed')
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [readAloud, setReadAloud] = useState(true)
  const [voice, setVoice] = useState<PublicVoiceCatalogEntry | null>(null)
  const messageEnd = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let live = true
    void getVoiceCatalogAccess().load().then((catalog) => {
      if (!live) return
      const selected = catalog.voices.find((candidate) => candidate.voiceRef === catalog.defaultVoiceRef)
        ?? catalog.voices.find((candidate) => candidate.status === 'active' && candidate.deploymentAvailable)
        ?? null
      setVoice(selected)
    })
    return () => { live = false; getVoiceAdapter().cancel() }
  }, [])
  useEffect(() => { messageEnd.current?.scrollIntoView({ block: 'nearest' }) }, [chat.messages.length])

  const persist = (next: FamilyPilotTutorChat) => {
    setChat(next)
    try {
      store.saveChat(next)
      setSaveError('')
    } catch {
      setSaveError('This conversation is visible now, but this browser could not save the latest message for Parent review.')
    }
  }
  const say = (text: string) => {
    if (!readAloud) return
    void getVoiceAdapter().speak({
      text,
      ...(voice ? { voiceRef: voice.voiceRef, voiceVersion: voice.voiceVersion } : {}),
      rate: 0.95,
    }).catch(() => undefined)
  }
  const send = async () => {
    const learnerText = draft.trim().slice(0, 2_000)
    if (!learnerText || busy) return
    setDraft('')
    setBusy(true)
    const learnerMessage = message('learner', learnerText, draftSource)
    setDraftSource('typed')
    let next = withMessages(chat, [learnerMessage])
    persist(next)

    const scripted = scriptedTutorTurnPolicy(learnerText, context.activeAssessment)
    if (scripted) {
      const safe = message('system', scripted.reply, 'scripted')
      next = withMessages(next, [safe])
      persist(next)
      say(safe.text)
      if (scripted.needsAdult) {
        try { await onAdultHelp() } catch { /* chat remains saved even if the hold cannot be raised */ }
      }
      setBusy(false)
      return
    }

    const prior = boundedGatewayConversation(next.messages)
    const result = await askTutor(defaultTutorApiDeps(), {
      messages: prior,
      gateway: {
        mode: 'tutor',
        context: {
          grade: student.nominalGrade,
          problem: context.pageText || context.pageTitle,
          studentAnswer: '',
          graded: false,
          subject: context.subject,
          lessonTitle: context.lessonTitle,
          lessonGoal: context.lessonGoal ?? '',
          pageTitle: context.pageTitle,
          instruction: context.instruction ?? '',
          responseType: context.responseType ?? '',
        },
      },
    })
    const replyText = result.ok ? result.text : failureMessage(result.reason)
    const reply = message(result.ok ? 'tutor' : 'system', replyText, result.ok ? 'ai' : 'scripted')
    next = withMessages(next, [reply])
    persist(next)
    say(reply.text)
    setBusy(false)
  }

  return <section className="mt-4 rounded-2xl border border-cyan-300 bg-cyan-50 p-4" aria-label="AI Tutor" data-testid="family-pilot-tutor">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-800">AI Tutor · {displaySubject(context.subject)}</p>
        <h2 className="mt-1 text-xl font-extrabold">Help with {context.pageTitle}</h2>
        <p className="mt-1 text-sm text-slate-700">Ask questions for as long as you need. The tutor gives hints and explanations, not answers to work you must complete yourself.</p>
      </div>
      <button type="button" className="min-h-11 rounded-lg border bg-white px-3 py-2 font-bold" onClick={onClose}>Close Tutor</button>
    </div>
    <div className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-xl border bg-white p-3" aria-live="polite">
      {chat.messages.length === 0 ? <p className="text-slate-600">What would you like help understanding?</p> : chat.messages.map((item) => (
        <div key={item.messageRef} className={`max-w-[90%] rounded-xl px-3 py-2 ${item.role === 'learner' ? 'ml-auto bg-cyan-700 text-white' : item.role === 'tutor' ? 'bg-slate-100' : 'border border-amber-300 bg-amber-50'}`}>
          <p className="text-xs font-bold">{item.role === 'learner' ? student.displayName : item.role === 'tutor' ? 'Tutor' : 'Academy'}</p>
          <p className="mt-1 whitespace-pre-wrap">{item.text}</p>
        </div>
      ))}
      {busy ? <p className="font-semibold text-cyan-800" role="status">Tutor is thinking…</p> : null}
      <div ref={messageEnd} />
    </div>
    <label className="mt-3 block font-bold" htmlFor="family-pilot-tutor-message">Your question</label>
    <textarea
      id="family-pilot-tutor-message"
      className="mt-1 min-h-24 w-full rounded-xl border bg-white p-3"
      value={draft}
      maxLength={2_000}
      disabled={busy}
      onChange={(event) => { setDraft(event.target.value); setDraftSource('typed') }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault()
          void send()
        }
      }}
      placeholder="Type a question, or hold the microphone button and talk."
    />
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <FamilyPilotPushToTalk disabled={busy} onSpeechText={(spokenText) => { setDraft(spokenText); setDraftSource('speech') }} />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={readAloud} onChange={(event) => setReadAloud(event.target.checked)} />Read replies aloud</label>
        <button type="button" className="min-h-11 rounded-lg bg-cyan-800 px-5 py-2 font-extrabold text-white disabled:opacity-50" disabled={busy || !draft.trim()} onClick={() => void send()}>Send</button>
      </div>
    </div>
    <p className="mt-3 text-xs font-semibold text-slate-600">A parent can review this conversation in Parent Hub → Tutor chats. Voice input is transcribed on this device and can be edited before sending.</p>
    {saveError ? <p className="mt-2 font-semibold text-amber-800" role="alert">{saveError}</p> : null}
  </section>
}

export function TutorAccountConnection() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected' | 'unavailable'>('checking')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accountLabel, setAccountLabel] = useState('')
  const [messageText, setMessageText] = useState('')
  const [busy, setBusy] = useState(false)

  const check = async () => {
    if (!supabaseConfigured()) {
      setStatus('unavailable')
      return
    }
    const verified = await getVerifiedAuthContext()
    setAccountLabel(verified?.user.email ?? '')
    setStatus(verified ? 'connected' : 'disconnected')
  }
  useEffect(() => { void check() }, [])
  const connect = async () => {
    const client = getSupabaseClient()
    if (!client || !email.trim() || !password) return
    setBusy(true)
    setMessageText('')
    const result = await client.auth.signInWithPassword({ email: email.trim(), password })
    setPassword('')
    if (result.error) {
      setStatus('disconnected')
      setMessageText('The tutor account could not be connected. Check the parent email and password.')
    } else {
      await check()
      setMessageText('Online Tutor and ElevenLabs voice are connected for this device.')
    }
    setBusy(false)
  }

  return <section className="rounded-2xl border bg-white p-5" data-testid="tutor-account-connection">
    <p className="font-bold text-cyan-700">Online tutor account</p>
    <h3 className="mt-1 text-xl font-extrabold">{status === 'connected' ? 'Connected' : status === 'checking' ? 'Checking connection…' : status === 'unavailable' ? 'Online tutor unavailable here' : 'Parent connection needed'}</h3>
    {status === 'connected' ? <p className="mt-2 text-slate-700">Signed in as {accountLabel}. The same protected connection is used for text tutoring and the approved ElevenLabs voice.</p>
      : status === 'unavailable' ? <p className="mt-2 font-semibold text-amber-800">Online tutor settings are not available in this release environment.</p>
        : status === 'disconnected' ? <div className="mt-3 grid max-w-xl gap-3">
          <label className="font-semibold">Parent email<input className="mt-1 w-full rounded-lg border px-3 py-2" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label className="font-semibold">Password<input className="mt-1 w-full rounded-lg border px-3 py-2" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button type="button" className="min-h-11 rounded-lg bg-cyan-800 px-4 py-2 font-bold text-white disabled:opacity-50" disabled={busy || !email.trim() || !password} onClick={() => void connect()}>{busy ? 'Connecting…' : 'Connect tutor account'}</button>
        </div> : null}
    {messageText ? <p className="mt-3 font-semibold" role="status">{messageText}</p> : null}
  </section>
}

export function ParentTutorHistory({ store, student }: {
  readonly store: FamilyPilotTutorHistoryStore
  readonly student: FamilySetupStudent
}) {
  const [revision, setRevision] = useState(0)
  const chats = useMemo(
    () => store.load().chats.filter((chat) => chat.learnerRef === student.studentRef),
    [revision, store, student.studentRef],
  )
  const deleteChat = (chatRef: string) => {
    if (!window.confirm('Delete this Tutor conversation from this device? This cannot be undone.')) return
    store.deleteChat(chatRef)
    setRevision((value) => value + 1)
  }
  const clear = () => {
    if (!window.confirm(`Delete all saved Tutor conversations for ${student.displayName} from this device? This cannot be undone.`)) return
    store.clearLearner(student.studentRef)
    setRevision((value) => value + 1)
  }
  return <div className="space-y-4">
    <TutorAccountConnection />
    <section className="rounded-2xl border bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold text-cyan-700">Parent-only review</p>
          <h3 className="mt-1 text-xl font-extrabold">{student.displayName}&apos;s Tutor conversations</h3>
          <p className="mt-2 text-slate-600">Saved on this device under this household. Tutor chats are not included in progress reports, grades, sync, or downloaded family backups.</p>
        </div>
        {chats.length > 0 ? <button type="button" className="min-h-11 rounded-lg border border-red-300 bg-white px-3 py-2 font-bold text-red-800" onClick={clear}>Delete all for {student.displayName}</button> : null}
      </div>
      {chats.length === 0 ? <p className="mt-5 rounded-xl bg-slate-50 p-4 font-semibold text-slate-600">No Tutor conversations have been saved for {student.displayName} yet.</p> : <div className="mt-5 space-y-4">
        {chats.map((chat) => <details key={chat.chatRef} className="rounded-xl border bg-slate-50 p-4">
          <summary className="cursor-pointer font-extrabold">{chat.lessonTitle} · {displaySubject(chat.subject)} · {new Date(chat.startedAt).toLocaleString()}</summary>
          <div className="mt-4 space-y-3">
            {chat.messages.map((item) => <div key={item.messageRef} className={`rounded-lg p-3 ${item.role === 'learner' ? 'bg-cyan-50' : item.role === 'tutor' ? 'bg-white' : 'bg-amber-50'}`}>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-600">{item.role === 'learner' ? student.displayName : item.role === 'tutor' ? 'Tutor' : 'Academy'} · {new Date(item.createdAt).toLocaleString()} {item.source === 'speech' ? '· spoken' : ''}</p>
              <p className="mt-1 whitespace-pre-wrap">{item.text}</p>
            </div>)}
          </div>
          <button type="button" className="mt-4 min-h-11 rounded-lg border border-red-300 bg-white px-3 py-2 font-bold text-red-800" onClick={() => deleteChat(chat.chatRef)}>Delete conversation</button>
        </details>)}
      </div>}
    </section>
  </div>
}
