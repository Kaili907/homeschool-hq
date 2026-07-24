import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../../theme'
import { isoToday } from '../../appState'
import { speak, cancelSpeech } from '../../tutor/voice'
import { getVoicePrefs } from '../../tutor/tutorState'
import {
  browserRecognitionSupported,
  createRecognition,
  type ReadingRecognition,
} from '../../reading/recognition'
import { alignReading } from '../../reading/align'
import { manualSession, sessionFromAlignment } from '../../reading/fluency'
import { syllableHyphenate, syllableSpeech } from '../../reading/syllable'
import type { Passage } from '../../reading/passages'
import type { Profile, ReadingSessionLog } from '../../types'

/**
 * MR reading fluency — one read-aloud session.
 *
 * ONLINE (recognition supported): 🎙 Start streams continuous SpeechRecognition;
 * a 🔴 indicator shows whenever the mic is live; ⏹ Stop aligns the transcript
 * against the passage to an ESTIMATED WCPM + gentle practice words. No audio is
 * ever stored — only the transcript text is aligned, then discarded.
 *
 * OFFLINE (or unsupported / Dad-forced): recognition UI is hidden; the session is
 * a timer + tap-to-pronounce, and Dad enters a hand-counted words-correct so
 * travel reading never breaks.
 *
 * Any word is tappable to hear it in the tutor's voice (slow); tap the SAME word
 * again for syllable-paced ("won-der-ful"). Everything routes through the shared
 * speak adapter (ElevenLabs when mapped, browser otherwise).
 */

const FLUENCY_SECONDS = 60

interface Props {
  passage: Passage
  profile: Profile
  muted: boolean
  /** fluency-check day → a fresh passage + a fixed 1-minute timer. */
  fluencyCheck: boolean
  onComplete: (log: ReadingSessionLog) => void
  onExit: () => void
}

type Phase = 'ready' | 'reading' | 'manual'

function clock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Strip surrounding punctuation for speaking / alignment; keep inner apostrophes. */
function cleanWord(display: string): string {
  return display.replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, '')
}

export default function ReadingSession({
  passage,
  profile,
  muted,
  fluencyCheck,
  onComplete,
  onExit,
}: Props) {
  const t = useTheme()
  const voice = getVoicePrefs(profile)
  const canSpeak = !muted && voice.enabled

  const recognitionAvailable = browserRecognitionSupported()
  // Dad can force the offline (timer + manual) flow even when recognition works.
  const [manualForced, setManualForced] = useState(false)
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const usingRecognition = recognitionAvailable && online && !manualForced

  const [phase, setPhase] = useState<Phase>('ready')
  const [elapsed, setElapsed] = useState(0)
  const [live, setLive] = useState(false)
  const [interim, setInterim] = useState('')
  const [tappedKey, setTappedKey] = useState<string | null>(null)

  const recRef = useRef<ReadingRecognition | null>(null)
  const transcriptRef = useRef('')
  const startTsRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const finishedRef = useRef(false)
  // last-tapped word (surface key) + time, to escalate a repeat tap to syllables.
  const lastTapRef = useRef<{ key: string; ts: number } | null>(null)

  // keep the online flag fresh
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  // cleanup on unmount: stop mic + any speech.
  useEffect(() => {
    return () => {
      recRef.current?.stop()
      if (timerRef.current) clearInterval(timerRef.current)
      cancelSpeech()
    }
  }, [])

  function beginTimer() {
    startTsRef.current = Date.now()
    setElapsed(0)
    timerRef.current = setInterval(() => {
      const secs = startTsRef.current ? Math.floor((Date.now() - startTsRef.current) / 1000) : 0
      setElapsed(secs)
      if (fluencyCheck && secs >= FLUENCY_SECONDS) stop()
    }, 250)
  }

  function start() {
    finishedRef.current = false
    transcriptRef.current = ''
    setInterim('')
    setPhase('reading')
    beginTimer()
    if (usingRecognition) {
      const rec = createRecognition('browser')
      recRef.current = rec
      rec.start({
        onTranscript: (full, isFinal) => {
          transcriptRef.current = full
          setLive(true)
          setInterim(isFinal ? '' : full.slice(-60))
        },
        onError: () => {
          // never surface a recognition hiccup to the child; the timer keeps running.
          setLive(false)
        },
        onEnd: () => setLive(false),
      })
    }
  }

  function durationSec(): number {
    const raw = startTsRef.current ? (Date.now() - startTsRef.current) / 1000 : 0
    // fluency-check is always scored over the fixed minute.
    return fluencyCheck ? Math.min(raw, FLUENCY_SECONDS) : Math.max(1, Math.round(raw))
  }

  function stop() {
    if (finishedRef.current) return
    finishedRef.current = true
    if (timerRef.current) clearInterval(timerRef.current)
    setLive(false)
    const dur = durationSec()

    if (usingRecognition) {
      recRef.current?.stop()
      recRef.current = null
      const align = alignReading(passage.text, transcriptRef.current)
      onComplete(sessionFromAlignment(isoToday(), passage.id, align, Math.round(dur)))
    } else {
      // offline: collect Dad's hand count next.
      setPhase('manual')
    }
  }

  function submitManual(wordsCorrect: number) {
    const dur = fluencyCheck ? FLUENCY_SECONDS : Math.max(1, Math.round(durationSec()))
    onComplete(manualSession(isoToday(), passage.id, wordsCorrect, dur))
  }

  function tapWord(display: string) {
    const word = cleanWord(display)
    if (!word) return
    if (!canSpeak) return
    const key = word.toLowerCase()
    const now = Date.now()
    const prev = lastTapRef.current
    const repeat = prev && prev.key === key && now - prev.ts < 5000
    lastTapRef.current = { key, ts: now }
    setTappedKey(key)
    // normal tap: whole word, slow. repeat tap: syllable-paced, slower.
    const rate = repeat ? 0.55 : 0.75
    const text = repeat ? syllableSpeech(word) : word
    speak(text, { voiceURI: voice.voiceURI, rate })
  }

  const bigEmoji = t.id === 'playful'
  const countdown = fluencyCheck ? Math.max(0, FLUENCY_SECONDS - elapsed) : elapsed

  // ---------- manual (offline) entry ----------
  if (phase === 'manual') {
    return <ManualEntry passage={passage} onSubmit={submitManual} onCancel={onExit} />
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={`text-2xl font-extrabold sm:text-3xl ${t.heading}`}>
            {bigEmoji ? '📖 ' : ''}
            {passage.title}
          </h1>
          <p className={`text-sm font-bold ${t.sub}`}>
            {fluencyCheck ? 'Fluency check — read for one minute' : 'Read aloud — take your time'}
            {' · '}
            {passage.wordCount} words
          </p>
        </div>
        <button onClick={onExit} className={`${t.secondaryBtn} px-4 py-2 text-sm`}>
          Back
        </button>
      </div>

      {/* status row */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={`${t.statPill} px-3 py-1.5 text-sm font-semibold`}>⏱ {clock(countdown)}</span>
        {phase === 'reading' && usingRecognition && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${
              live ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'
            }`}
            aria-live="polite"
          >
            <span className={`text-base ${live ? 'animate-pulse' : ''}`} aria-hidden="true">
              🔴
            </span>
            {live ? 'reading…' : 'listening…'}
          </span>
        )}
        {!usingRecognition && (
          <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-700">
            {online ? 'Read-aloud mode' : 'Offline'} · timer + Dad scores
          </span>
        )}
        <span className={`ml-auto text-xs font-semibold ${t.sub}`}>tap any word to hear it 🔊</span>
      </div>

      {/* passage — every word tappable */}
      <div className={`${t.card} p-5 sm:p-7`}>
        <div className={`leading-loose ${bigEmoji ? 'text-2xl' : 'text-xl'} ${t.heading}`}>
          {passage.paragraphs.map((para, pi) => (
            <p key={pi} className={pi > 0 ? 'mt-4' : ''}>
              {para.split(/(\s+)/).map((tok, wi) => {
                if (/^\s+$/.test(tok)) return <span key={wi}>{tok}</span>
                const key = cleanWord(tok).toLowerCase()
                const isTapped = key !== '' && key === tappedKey
                return (
                  <button
                    key={wi}
                    type="button"
                    onClick={() => tapWord(tok)}
                    title={key ? `hear "${cleanWord(tok)}" — tap again to sound it out (${syllableHyphenate(cleanWord(tok))})` : undefined}
                    className={`rounded px-0.5 transition-colors ${
                      canSpeak ? 'hover:bg-amber-100 active:bg-amber-200' : 'cursor-default'
                    } ${isTapped ? 'bg-amber-200' : ''}`}
                  >
                    {tok}
                  </button>
                )
              })}
            </p>
          ))}
        </div>
      </div>

      {/* first-run privacy + controls */}
      {phase === 'ready' ? (
        <>
          {usingRecognition && (
            <p className={`mt-4 rounded-2xl bg-sky-50 p-3 text-center text-sm font-semibold text-sky-800`}>
              🎙 The microphone only listens while you are reading, and stops the moment you tap
              done. <strong>We never save any sound</strong> — only the words help us cheer you on.
            </p>
          )}
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button onClick={start} className={`${t.primaryBtn} px-8 py-4 text-xl`}>
              {usingRecognition ? '🎙 Start reading' : '▶️ Start timer'}
            </button>
            {recognitionAvailable && online && (
              <button
                onClick={() => setManualForced((v) => !v)}
                className={`${t.secondaryBtn} px-5 py-4 text-sm`}
                title="Skip the microphone — read together and Dad enters the count"
              >
                {manualForced ? '🎙 Use microphone' : '✍️ Score by hand'}
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="mt-4 flex justify-center">
          <button onClick={stop} className={`${t.primaryBtn} px-8 py-4 text-xl`}>
            ⏹ I&apos;m done reading
          </button>
        </div>
      )}
    </div>
  )
}

// ---------- offline manual entry (Dad counts) ----------

function ManualEntry({
  passage,
  onSubmit,
  onCancel,
}: {
  passage: Passage
  onSubmit: (wordsCorrect: number) => void
  onCancel: () => void
}) {
  const t = useTheme()
  const [value, setValue] = useState<string>(String(passage.wordCount))
  const n = Number(value)
  const valid = Number.isFinite(n) && n >= 0 && n <= passage.wordCount + 50

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <div className={`${t.card} p-6`}>
        <h2 className={`text-xl font-extrabold ${t.heading}`}>Nice reading! 🌟</h2>
        <p className={`mt-1 text-sm font-semibold ${t.sub}`}>
          Grown-up: how many words did she read correctly? (Passage has {passage.wordCount} words.)
        </p>
        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          min={0}
          className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-lg font-bold text-slate-800"
          aria-label="words read correctly"
        />
        <div className="mt-4 flex gap-3">
          <button
            disabled={!valid}
            onClick={() => onSubmit(Math.round(n))}
            className={`${t.primaryBtn} flex-1 px-4 py-3 disabled:opacity-40`}
          >
            Save
          </button>
          <button onClick={onCancel} className={`${t.secondaryBtn} px-4 py-3`}>
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
