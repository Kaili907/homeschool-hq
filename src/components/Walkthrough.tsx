import { useEffect, useState } from 'react'
import type { Question } from '../types'
import type { Explanation } from '../explain'
import { VisualView } from './Viz'
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
}

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
}: WalkthroughProps) {
  const t = useTheme()
  const [i, setI] = useState(0)
  const stepList = explanation.steps
  const step = stepList[Math.min(i, stepList.length - 1)]
  const last = i >= stepList.length - 1
  const canHear = voice.enabled && !muted

  const speakOpts: SpeakOptions = { voiceURI: voice.voiceURI, rate: voice.rate }

  // Speak the current step (text is always shown regardless). Never autoplays
  // ahead — one line per tap. Cancels on unmount.
  useEffect(() => {
    if (canHear) speak(step.say, speakOpts)
    return () => cancelSpeech()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, canHear])

  const advance = () => {
    cancelSpeech()
    if (last) onDone()
    else setI((n) => n + 1)
  }

  return (
    <div className={`${t.card} mt-6 p-6`}>
      <div className="flex items-center justify-between gap-2">
        <div className={`text-lg font-extrabold ${t.heading}`}>
          {t.bigEmoji ? '🧑‍🏫 ' : ''}Let's work it out together
        </div>
        <div className="flex items-center gap-2">
          {voice.enabled && (
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
        {question.visual && (
          <div className="mt-3">
            <VisualView visual={question.visual} />
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

      <button onClick={advance} className={`${t.primaryBtn} mt-5 w-full px-6 py-4 text-xl`}>
        {last ? (mode === 'retry' ? 'Try one like it! ✏️' : 'Got it! ✅') : 'Next ▶'}
      </button>
      <div className={`mt-2 text-center text-xs font-semibold ${t.sub}`}>
        Step {Math.min(i + 1, stepList.length)} of {stepList.length}
      </div>
    </div>
  )
}
