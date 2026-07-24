import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Profile } from '../../types'
import { isoToday, downloadJson } from '../../appState'
import { useTheme } from '../../theme'
import { cancelSpeech, encodeVoiceRef, speak } from '../../tutor/voice'
import { defaultRate, resolveSlotRef } from '../../tutor/tutorState'
import { mindsetWeek } from '../../mindset/content'
import {
  bandReadAloud,
  bandUsesJournal,
  getUnlockedLesson,
  getWeekState,
  isWeekComplete,
  markReflected,
  markViewed,
  mindsetBand,
  openableWeeks,
  type MindsetBand,
} from '../../mindset/mindset'
import { getJournalText, serializeMyJournal, setJournalText } from '../../mindset/journalStore'

interface Props {
  profile: Profile
  /** global Dad-set start date (AppState.mindsetStartDate). */
  startDate: string | undefined
  /** family-wide voice mute (isMuted(state)). */
  muted: boolean
  onPatch: (update: (prev: Profile) => Profile) => void
  onExit: () => void
}

const EMOJIS = ['😀', '🙂', '😐', '😕', '😢', '💪', '🔥', '🌱', '⭐', '❤️']

/** Render `*word*` emphasis from the verbatim source as italics; text otherwise literal. */
function withEmphasis(text: string): ReactNode[] {
  return text.split(/(\*[^*]+\*)/g).map((seg, i) =>
    seg.length > 2 && seg.startsWith('*') && seg.endsWith('*') ? (
      <em key={i}>{seg.slice(1, -1)}</em>
    ) : (
      <span key={i}>{seg}</span>
    ),
  )
}

const plain = (text: string) => text.replace(/\*/g, '')

export function MindsetLesson({ profile, startDate, muted, onPatch, onExit }: Props) {
  const t = useTheme()
  const today = isoToday()
  const band = mindsetBand(profile)
  const journal = bandUsesJournal(band)
  const readAloud = bandReadAloud(band)
  const openable = openableWeeks(startDate, today)
  const latest = openable[openable.length - 1] ?? 0

  // The intro privacy screen shows until she's opened her first lesson ever.
  const everViewed = useMemo(
    () => Object.values(profile.mindset?.weeks ?? {}).some((w) => w.viewed),
    [profile.mindset],
  )
  const [intro, setIntro] = useState(!everViewed)
  const [week, setWeek] = useState(latest)
  const lesson = getUnlockedLesson(startDate, today, week) ?? (latest ? mindsetWeek(latest) : undefined)
  const ws = lesson ? getWeekState(profile, lesson.week) : {}
  const [reflecting, setReflecting] = useState(!!ws.viewed)
  // Reflection text comes from the LOCAL journal store, never from the profile/AppState.
  const [draft, setDraft] = useState(lesson ? getJournalText(profile.id, lesson.week) : '')
  const [speaking, setSpeaking] = useState(false)

  // Reset the per-week UI when she switches weeks (revisit).
  useEffect(() => {
    const s = lesson ? getWeekState(profile, lesson.week) : {}
    setReflecting(!!s.viewed)
    setDraft(lesson ? getJournalText(profile.id, lesson.week) : '')
    stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week])

  useEffect(() => () => cancelSpeech(), []) // stop audio on unmount

  function stop() {
    cancelSpeech()
    setSpeaking(false)
  }

  function toggleRead() {
    if (!lesson) return
    if (speaking) return stop()
    const rate = profile.tutor?.rate ?? defaultRate(profile.grade)
    const voiceURI = encodeVoiceRef(resolveSlotRef(profile, 'mindset'))
    const body = band === 'littles' ? lesson.littles : lesson.core
    speak(plain(`${lesson.title}. ${body}`), { voiceURI, rate })
    setSpeaking(true)
  }

  const complete = lesson ? isWeekComplete(profile, lesson.week) : false

  if (!lesson) {
    return (
      <Shell t={t} onExit={onExit}>
        <div className={`${t.card} p-6 text-center`}>
          <div className="text-4xl">🧠</div>
          <h1 className={`mt-2 text-2xl font-extrabold ${t.heading}`}>Mindset</h1>
          <p className={`mt-2 font-semibold ${t.sub}`}>
            Your first weekly lesson unlocks soon. Check back on Friday!
          </p>
        </div>
      </Shell>
    )
  }

  if (intro) {
    return (
      <Shell t={t} onExit={onExit}>
        <div className={`${t.card} p-6`}>
          <div className="text-center text-4xl">🧠</div>
          <h1 className={`mt-2 text-center text-2xl font-extrabold ${t.heading}`}>
            Your quiet corner
          </h1>
          <p className={`mt-4 text-lg font-semibold ${t.heading}`}>
            One short lesson a week. Never graded, never quizzed — there are no right answers here.
          </p>
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            <p className="font-extrabold">Your journal is yours.</p>
            <p className="mt-1 font-semibold">Dad sees that you finished, never what you wrote.</p>
          </div>
          <button
            onClick={() => setIntro(false)}
            className={`${t.primaryBtn} mt-6 w-full px-6 py-3 text-lg`}
          >
            Okay — let's begin
          </button>
        </div>
      </Shell>
    )
  }

  const bodyText = band === 'littles' ? lesson.littles : lesson.core
  const bigType = band === 'littles' ? 'text-2xl leading-relaxed' : 'text-lg leading-relaxed'

  return (
    <Shell t={t} onExit={onExit}>
      {/* week switcher — earlier weeks stay revisitable */}
      {openable.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {openable.map((w) => (
            <button
              key={w}
              onClick={() => setWeek(w)}
              className={`rounded-full px-3 py-1 text-sm font-bold ${
                w === week ? 'bg-slate-800 text-white' : `${t.statPill} text-slate-600`
              }`}
            >
              Week {w}
              {isWeekComplete(profile, w) ? ' ✓' : ''}
            </button>
          ))}
        </div>
      )}

      <div className={`${t.card} p-6`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className={`text-xs font-bold uppercase tracking-wide ${t.sub}`}>Week {lesson.week}</div>
            <h1 className={`text-2xl font-extrabold ${t.heading}`}>{lesson.title}</h1>
          </div>
          {readAloud && !muted && (
            <button
              onClick={toggleRead}
              className={`${t.secondaryBtn} shrink-0 px-4 py-2 text-sm`}
              aria-label={speaking ? 'Stop reading' : 'Read to me'}
            >
              {speaking ? '⏹ Stop' : '🔊 Read to me'}
            </button>
          )}
        </div>

        <p className={`mt-4 font-medium ${t.heading} ${bigType}`}>{withEmphasis(bodyText)}</p>

        {band === 'teens' && lesson.teensExtra && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Go deeper</div>
            <p className="mt-1 font-medium leading-relaxed text-slate-700">{withEmphasis(lesson.teensExtra)}</p>
          </div>
        )}

        {!reflecting ? (
          <button
            onClick={() => {
              onPatch((p) => markViewed(p, lesson.week, today))
              setReflecting(true)
              stop()
            }}
            className={`${t.primaryBtn} mt-6 w-full px-6 py-3 text-lg`}
          >
            Done reading — reflect ✍️
          </button>
        ) : (
          <Reflection
            band={band}
            lesson={lesson}
            complete={complete}
            draft={draft}
            setDraft={setDraft}
            onEmoji={(e) => {
              setJournalText(profile.id, lesson.week, e) // text → local store only
              onPatch((p) => markReflected(p, lesson.week, today)) // completion signal → profile
            }}
            onWord={(w) => {
              setJournalText(profile.id, lesson.week, w)
              onPatch((p) => markReflected(p, lesson.week, today))
            }}
            onDraftChange={(text) => {
              setDraft(text)
              setJournalText(profile.id, lesson.week, text) // autosave to the local store
            }}
            onDone={() => {
              setJournalText(profile.id, lesson.week, draft)
              onPatch((p) => markReflected(p, lesson.week, today))
            }}
          />
        )}
      </div>

      {/* habit card — shows after the lesson, present all week */}
      {complete && (
        <div className={`${t.card} mt-4 border-l-4 border-emerald-400 p-5`}>
          <div className={`text-xs font-bold uppercase tracking-wide ${t.sub}`}>This week</div>
          <p className={`mt-1 text-lg font-bold ${t.heading}`}>{lesson.habit}</p>
        </div>
      )}

      {/* the girl's OWN journal export — text included, only here in her signed-in view */}
      {journal && (
        <div className="mt-4 text-center">
          <button
            onClick={() => downloadJson(`my-mindset-journal-${today}.json`, serializeMyJournal(profile))}
            className={`${t.secondaryBtn} px-4 py-2 text-sm`}
          >
            ⬇️ Export MY journal
          </button>
          <p className={`mt-1 text-xs font-semibold ${t.sub}`}>Only you can do this — it's just for you.</p>
        </div>
      )}
    </Shell>
  )
}

function Shell({ t, onExit, children }: { t: ReturnType<typeof useTheme>; onExit: () => void; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className={`text-lg font-extrabold ${t.heading}`}>🧠 Mindset</h2>
        <button onClick={onExit} className={`${t.secondaryBtn} px-4 py-2 text-sm`}>
          Back home
        </button>
      </div>
      {children}
    </div>
  )
}

function Reflection({
  band,
  lesson,
  complete,
  draft,
  setDraft,
  onEmoji,
  onWord,
  onDraftChange,
  onDone,
}: {
  band: MindsetBand
  lesson: NonNullable<ReturnType<typeof mindsetWeek>>
  complete: boolean
  draft: string
  setDraft: (s: string) => void
  onEmoji: (e: string) => void
  onWord: (w: string) => void
  onDraftChange: (s: string) => void
  onDone: () => void
}) {
  const t = useTheme()

  if (band === 'littles') {
    const prompt = lesson.reflectLittles
    return (
      <div className="mt-6">
        <p className={`text-xl font-extrabold ${t.heading}`}>{prompt.prompt}</p>
        {prompt.kind === 'emoji' ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => onEmoji(e)}
                className="rounded-2xl border-2 border-slate-200 bg-white px-3 py-2 text-3xl transition-transform hover:scale-110"
                aria-label={`choose ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value.split(/\s+/)[0] ?? '')}
              placeholder="one word"
              maxLength={24}
              className="flex-1 rounded-2xl border-2 border-slate-200 px-4 py-3 text-xl font-bold text-slate-800"
              aria-label="one word answer"
            />
            <button
              onClick={() => draft.trim() && onWord(draft.trim())}
              disabled={!draft.trim()}
              className={`${t.primaryBtn} px-5 py-3 text-lg disabled:opacity-40`}
            >
              Done
            </button>
          </div>
        )}
        {complete && <p className="mt-4 font-extrabold text-emerald-600">All done for this week! 🌱</p>}
      </div>
    )
  }

  // 6th+ / teens: journal with autosave; Done completes even when empty.
  return (
    <div className="mt-6">
      <p className={`text-lg font-extrabold ${t.heading}`}>{lesson.reflect[0]}</p>
      <textarea
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        rows={6}
        placeholder="Write as much or as little as you like…"
        className="mt-3 w-full rounded-2xl border-2 border-slate-200 p-4 font-medium leading-relaxed text-slate-800"
        aria-label="journal entry"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className={`text-sm font-semibold ${t.sub}`}>
          Write it, or just think it — tapping done is enough.
        </p>
        <button onClick={onDone} className={`${t.primaryBtn} shrink-0 px-6 py-2`}>
          {complete ? 'Saved ✓' : 'Done'}
        </button>
      </div>
      <p className="mt-2 text-xs font-semibold text-emerald-600">Autosaves as you type · private to you.</p>
    </div>
  )
}
