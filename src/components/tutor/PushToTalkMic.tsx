import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTheme } from '../../theme'

/**
 * MT-3 push-to-talk mic.
 *
 * A hold-to-record button that transcribes the child's speech with the browser
 * SpeechRecognition API and hands the transcript UP to the parent via
 * `onTranscript` so she can review/edit it in the text input before sending.
 *
 * It NEVER sends anything itself and NEVER records without the button held.
 */

/** Minimal local shape of a SpeechRecognition instance (no DOM lib types by default). */
interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  // `any` is acceptable ONLY for the event object — SpeechRecognitionEvent isn't in lib.dom.
  onresult: ((e: any) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition
}

/** True when the browser exposes a SpeechRecognition constructor. */
export function micSupported(): boolean {
  return getSpeechRecognitionCtor() !== undefined
}

export function PushToTalkMic({
  onTranscript,
  disabled,
}: {
  onTranscript: (text: string) => void
  disabled?: boolean
}) {
  const t = useTheme()
  const [recording, setRecording] = useState(false)
  const [interim, setInterim] = useState('')

  // Live recognition instance + the best transcript captured so far this hold.
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const finalRef = useRef('')
  // Guard so we only start once per hold and only emit once per session.
  const activeRef = useRef(false)

  // Clean up on unmount: stop + null out the recognition instance.
  useEffect(() => {
    return () => {
      const rec = recognitionRef.current
      if (rec) {
        try {
          rec.onresult = null
          rec.onerror = null
          rec.onend = null
          rec.stop()
        } catch {
          /* ignore — nothing to surface to the child */
        }
      }
      recognitionRef.current = null
      activeRef.current = false
    }
  }, [])

  // Graceful hide: if the API is absent the parent still shows typing.
  if (!micSupported()) return null

  const resetToIdle = () => {
    activeRef.current = false
    setRecording(false)
    setInterim('')
  }

  const emitAndReset = () => {
    const text = finalRef.current.trim()
    finalRef.current = ''
    resetToIdle()
    // Hand the transcript up for the parent's approval — the mic never sends.
    if (text) onTranscript(text)
  }

  const startRecording = () => {
    if (disabled || activeRef.current) return
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) return

    let rec: SpeechRecognitionLike
    try {
      rec = new Ctor()
    } catch {
      resetToIdle()
      return
    }

    rec.continuous = false
    rec.interimResults = true
    rec.lang = 'en-US'
    finalRef.current = ''

    rec.onresult = (e: any) => {
      let finalText = ''
      let interimText = ''
      const results = e?.results
      if (results) {
        for (let i = 0; i < results.length; i++) {
          const res = results[i]
          const transcript: string = res?.[0]?.transcript ?? ''
          if (res?.isFinal) finalText += transcript
          else interimText += transcript
        }
      }
      if (finalText) finalRef.current = finalText
      setInterim(interimText || finalText)
    }

    rec.onerror = () => {
      // On any recognition error just reset to idle — never throw, never surface.
      resetToIdle()
    }

    rec.onend = () => {
      // Recognition ended (final result arrived or hold released) — emit once.
      if (activeRef.current) emitAndReset()
    }

    activeRef.current = true
    setRecording(true)
    setInterim('')
    try {
      rec.start()
      recognitionRef.current = rec
    } catch {
      // start() can throw if invoked in a bad state — reset silently.
      resetToIdle()
      recognitionRef.current = null
    }
  }

  const stopRecording = () => {
    const rec = recognitionRef.current
    if (!rec) {
      // Nothing running — but if we were flagged active, still flush.
      if (activeRef.current) emitAndReset()
      return
    }
    try {
      rec.stop()
      // onend fires next and calls emitAndReset(); nothing else to do here.
    } catch {
      emitAndReset()
    }
  }

  // Keyboard a11y: Space/Enter act as press-and-hold.
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      if (!e.repeat) startRecording()
    }
  }

  const onKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      stopRecording()
    }
  }

  return (
    <span className="inline-flex flex-col items-center">
      <button
        type="button"
        disabled={disabled}
        aria-label="hold to talk"
        aria-pressed={recording}
        className={`flex h-11 w-11 shrink-0 items-center justify-center text-xl ${t.secondaryBtn} ${
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        } ${recording ? 'ring-2 ring-rose-400' : ''}`}
        onPointerDown={(e) => {
          e.preventDefault()
          startRecording()
        }}
        onPointerUp={(e) => {
          e.preventDefault()
          stopRecording()
        }}
        onPointerLeave={() => {
          if (recording) stopRecording()
        }}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
      >
        <span aria-hidden="true">{recording ? '🔴' : '🎤'}</span>
      </button>
      {recording ? (
        <span className={`mt-1 max-w-[10rem] truncate text-xs ${t.sub}`} aria-live="polite">
          {interim ? interim : 'listening…'}
        </span>
      ) : null}
    </span>
  )
}
