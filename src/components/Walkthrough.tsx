import { useEffect, useState } from 'react'
import type { Question } from '../types'
import type { Explanation } from '../explain'
import { VisualView } from './Viz'
import { StepViz } from './StepViz'
import { useTheme } from '../theme'
import { cancelSpeech, speak, type SpeakOptions } from '../tutor/voice'
import type { ResolvedVoicePrefs } from '../tutor/tutorState'

interface WalkthroughProps {
  question: Question
  explanation: Explanation
  /** 'retry' ends with "try one like it"; 'review' ends with "got it". */
  mode: 'retry' | 'review'
  voice: ResolvedVoicePrefs
  muted: boolean
  onToggleMute: () => void
  onDone: () => void
  /**
   * MT-1V beat 2: auto-advance through every step (visuals + voice, no taps) and
   * call onDone at the end. Used for the "Watch another" worked example.
   */
  autoplay?: boolean
  /**
   * MT-1V beat 2 offer: shown on the last step of a 'retry' walkthrough. Lets her
   * watch a fresh worked example before her own turn. Absent in review/autoplay.
   */
  onWatchAnother?: () => void
}

/** Auto-advance dwell time for one step: long enough to read/hear it. */
const dwellMs = (say: string) => Math.min(6500, Math.max(1900, 1500 + say.length * 45))

/** Highlight the step's `show` substring inside the displayed prompt. */
function PromptWithHighlight({ prompt, show }: { prompt: string; show?: string }) {
  if (!show || !prompt.includes(show)) return <>{prompt}</>
  const idx = prompt.indexOf(show)
  return (
    <>
      {prompt.slice(0, idx)}
      <mark className="rounded-lg bg-amber-200 px-1 text-inherit">{show}</mark>
      {prompt.slice(idx + show.length)}
    </>
  )
}

export function Walkthrough({
  question,
  explanation,
  mode,
  voice,
  muted,
  onToggleMute,
  onDone,
  autoplay = false,
  onWatchAnother,
}: WalkthroughProps) {
  const t = useTheme()
  const [i, setI] = useState(0)
  const stepList = explanation.steps
  const step = stepList[Math.min(i, stepList.length - 1)]
  const last = i >= stepList.length - 1
  const canHear = voice.enabled && !muted

  const speakOpts: SpeakOptions = { voiceURI: voice.voiceURI, rate: voice.rate }

  // Speak the current step (text is always shown regardless). Cancels on unmount.
  useEffect(() => {
    if (canHear) speak(step.say, speakOpts)
    return () => cancelSpeech()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, canHear])

  // Beat 2: auto-advance on a timer synced to the step's dwell time. No input.
  useEffect(() => {
    if (!autoplay) return
    const id = window.setTimeout(() => {
      cancelSpeech()
      if (last) onDone()
      else setI((n) => n + 1)
    }, dwellMs(step.say))
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, autoplay, last])

  const advance = () => {
    cancelSpeech()
    if (last) onDone()
    else setI((n) => n + 1)
  }

  return (
    <div className={`${t.card} mt-6 p-6`}>
      <div className="flex items-center justify-between gap-2">
        <div className={`text-lg font-extrabold ${t.heading}`}>
          {t.bigEmoji ? (autoplay ? '👀 ' : '🧑‍🏫 ') : ''}
          {autoplay ? 'Watch this one' : "Let's work it out together"}
        </div>
        <div className="flex items-center gap-2">
          {voice.enabled && !autoplay && (
            <button
              onClick={() => speak(step.say, speakOpts)}
              disabled={muted}
              className={`${t.secondaryBtn} px-3 py-2 text-sm disabled:opacity-40`}
              aria-label="replay voice"
              title="Hear it again"
            >
              🔁
            </button>
          )}
          <button
            onClick={onToggleMute}
            className={`${t.secondaryBtn} px-3 py-2 text-sm`}
            aria-label={muted ? 'unmute voice' : 'mute voice'}
            title={muted ? 'Voice is muted' : 'Mute voice'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>

      {/* the problem, with the active step's highlight */}
      <div className={`mt-4 rounded-2xl bg-black/5 p-4`}>
        <p className={`whitespace-pre-line text-center text-xl font-extrabold leading-snug ${t.heading}`}>
          <PromptWithHighlight prompt={question.prompt} show={step.show} />
        </p>
        {/* the question's own visual — hidden when the step supplies its own picture */}
        {question.visual && !step.viz && (
          <div className="mt-3">
            <VisualView visual={question.visual} />
          </div>
        )}
        {/* MT-1V per-step visual, rendered above the step text */}
        {step.viz && (
          <div className="mt-3 flex justify-center overflow-x-auto">
            <StepViz viz={step.viz} />
          </div>
        )}
      </div>

      {/* current step text (always visible, spoken when unmuted) */}
      <div className={`mt-4 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 text-lg font-bold text-amber-900`}>
        {step.say}
      </div>

      {/* step progress dots */}
      <div className="mt-4 flex items-center justify-center gap-1.5">
        {stepList.map((_, n) => (
          <span
            key={n}
            className={`h-2.5 rounded-full transition-all ${
              n === i ? 'w-6 bg-violet-500' : n < i ? 'w-2.5 bg-violet-300' : 'w-2.5 bg-slate-200'
            }`}
          />
        ))}
      </div>

      {autoplay ? (
        <button onClick={onDone} className={`${t.secondaryBtn} mt-5 w-full px-6 py-3 text-base`}>
          Skip ▶
        </button>
      ) : last && mode === 'retry' && onWatchAnother ? (
        // Beat-2 offer: watch a fresh worked example, or go straight to her turn.
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button onClick={onWatchAnother} className={`${t.secondaryBtn} px-6 py-4 text-lg`}>
            Watch another ▶
          </button>
          <button onClick={onDone} className={`${t.primaryBtn} px-6 py-4 text-xl`}>
            Your turn ✏️
          </button>
        </div>
      ) : (
        <button onClick={advance} className={`${t.primaryBtn} mt-5 w-full px-6 py-4 text-xl`}>
          {last ? (mode === 'retry' ? 'Try one like it! ✏️' : 'Got it! ✅') : 'Next ▶'}
        </button>
      )}
      <div className={`mt-2 text-center text-xs font-semibold ${t.sub}`}>
        Step {Math.min(i + 1, stepList.length)} of {stepList.length}
      </div>
    </div>
  )
}
