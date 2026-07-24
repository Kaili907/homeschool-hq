/**
 * MR reading fluency — the RecognitionProvider seam.
 *
 * v1 wires ONLY the browser SpeechRecognition engine (continuous, so a whole
 * passage read streams in). The `azure` provider is a declared seam for the
 * future Azure Pronunciation Assessment engine (Voice-Addendum pattern, like
 * MT-V): the type exists and `createRecognition('azure')` resolves cleanly, but
 * until Dad creates the free Azure resource it silently falls back to browser.
 *
 * PRIVACY — LOAD-BEARING: this module transcribes speech to TEXT and nothing
 * else. It NEVER records, buffers, or persists audio — no MediaRecorder, no
 * getUserMedia, no Blob, no object URL. Only alignment-ready transcript strings
 * leave here. (The `reading` no-audio test asserts this by scanning the source.)
 */

export type RecognitionProviderId = 'browser' | 'azure'

export interface RecognitionHandlers {
  /** the growing transcript (final + interim) so the UI can show a live indicator. */
  onTranscript: (fullText: string, isFinal: boolean) => void
  onError?: () => void
  onEnd?: () => void
}

export interface ReadingRecognition {
  readonly provider: RecognitionProviderId
  supported(): boolean
  /** begin continuous recognition; safe to call once per session. */
  start(handlers: RecognitionHandlers): void
  /** stop recognition; `onEnd` fires. Idempotent. */
  stop(): void
}

// ---------- minimal SpeechRecognition typings (not in lib.dom by default) ----------

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: any) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition
}

/** True when this browser exposes a SpeechRecognition constructor. */
export function browserRecognitionSupported(): boolean {
  return getCtor() !== undefined
}

/**
 * Continuous browser recognizer. Accumulates finalized result segments into a
 * running transcript and reports interim text for the live indicator. Transcript
 * text only — audio is never touched.
 */
export function createBrowserRecognition(): ReadingRecognition {
  let rec: SpeechRecognitionLike | null = null
  let finalText = ''
  let stopped = false

  return {
    provider: 'browser',
    supported: browserRecognitionSupported,
    start(handlers) {
      const Ctor = getCtor()
      if (!Ctor) {
        handlers.onError?.()
        return
      }
      stopped = false
      finalText = ''
      try {
        rec = new Ctor()
      } catch {
        handlers.onError?.()
        return
      }
      rec.continuous = true
      rec.interimResults = true
      rec.lang = 'en-US'

      rec.onresult = (e: any) => {
        let interim = ''
        const results = e?.results
        if (results) {
          for (let i = e.resultIndex ?? 0; i < results.length; i++) {
            const res = results[i]
            const txt: string = res?.[0]?.transcript ?? ''
            if (res?.isFinal) finalText += (finalText ? ' ' : '') + txt.trim()
            else interim += txt
          }
        }
        const full = (finalText + ' ' + interim).trim()
        handlers.onTranscript(full, interim === '')
      }

      rec.onerror = () => {
        // Recognition hiccups (no-speech, network) must never surface to the child;
        // the session keeps its timer and she can stop whenever she likes.
        handlers.onError?.()
      }

      rec.onend = () => {
        // Chrome ends continuous recognition periodically; restart unless we stopped.
        if (!stopped) {
          try {
            rec?.start()
            return
          } catch {
            /* fall through to end */
          }
        }
        handlers.onEnd?.()
      }

      try {
        rec.start()
      } catch {
        handlers.onError?.()
      }
    },
    stop() {
      stopped = true
      const r = rec
      rec = null
      if (r) {
        try {
          r.stop()
        } catch {
          /* ignore */
        }
      }
    },
  }
}

/**
 * A no-op recognizer used when no engine is available (e.g. offline mode hides the
 * recognition UI, but callers can still construct a provider safely).
 */
export function createNullRecognition(provider: RecognitionProviderId = 'browser'): ReadingRecognition {
  return {
    provider,
    supported: () => false,
    start(handlers) {
      handlers.onError?.()
    },
    stop() {},
  }
}

/**
 * Resolve a recognizer for the requested provider. `azure` is not wired this cycle
 * and silently falls back to the browser engine (the seam is real; the wiring is a
 * follow-up micro-cycle once the free Azure resource exists).
 */
export function createRecognition(provider: RecognitionProviderId = 'browser'): ReadingRecognition {
  // azure → browser fallback (seam present, engine deferred).
  if (browserRecognitionSupported()) return createBrowserRecognition()
  return createNullRecognition(provider)
}
