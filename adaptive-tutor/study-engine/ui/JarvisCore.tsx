import { useId, type ReactNode } from 'react'
import './jarvis-core.css'

export type JarvisActivity =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'paused'
  | 'offline'

export type JarvisMotionMode = 'full' | 'minimal' | 'none'

export type JarvisVoiceMode = 'available' | 'no-audio' | 'unavailable'

export interface JarvisCoreProps {
  /** Student-facing assistant name. */
  name?: string
  /** Drives the visual state and the default accessible status text. */
  activity?: JarvisActivity
  /** Overrides the default text for the current activity. */
  statusText?: string
  /** Exact on-screen equivalent of the current spoken guidance. */
  currentUtterance?: ReactNode
  /** Visible label for the current-utterance region. */
  captionLabel?: string
  /** Full motion, a deliberately quieter animation, or no animation. */
  motionMode?: JarvisMotionMode
  /** Describes whether audio is available, intentionally off, or unsupported. */
  voiceMode?: JarvisVoiceMode
  /** Optional override for the visible voice fallback message. */
  voiceFallbackMessage?: string
  /** Parent-owned transcript content. */
  transcript?: ReactNode
  /** Controlled expanded state for the transcript region. */
  transcriptOpen?: boolean
  /** Controlled transcript toggle callback. Supplying it displays the toggle. */
  onTranscriptOpenChange?: (open: boolean) => void
  /** Accessible label for the transcript region. */
  transcriptLabel?: string
  /** Additional class for layout integration. */
  className?: string
}

const ACTIVITY_LABELS: Readonly<Record<JarvisActivity, string>> = {
  idle: 'Ready',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
  paused: 'Paused',
  offline: 'Text support is offline',
}

const VOICE_FALLBACKS: Readonly<
  Record<Exclude<JarvisVoiceMode, 'available'>, string>
> = {
  'no-audio': 'Audio is off. Jarvis will keep every instruction on screen.',
  unavailable:
    'Voice is unavailable on this device. You can keep learning with captions and text.',
}

export function JarvisCore({
  name = 'Jarvis',
  activity = 'idle',
  statusText,
  currentUtterance,
  captionLabel = 'Jarvis captions',
  motionMode = 'full',
  voiceMode = 'available',
  voiceFallbackMessage,
  transcript,
  transcriptOpen = false,
  onTranscriptOpenChange,
  transcriptLabel = 'Session transcript',
  className,
}: JarvisCoreProps) {
  const instanceId = useId()
  const nameId = `${instanceId}-name`
  const transcriptId = `${instanceId}-transcript`
  const resolvedStatus = statusText ?? ACTIVITY_LABELS[activity]
  const fallbackMessage =
    voiceMode === 'available'
      ? undefined
      : (voiceFallbackMessage ?? VOICE_FALLBACKS[voiceMode])
  const showTranscriptToggle =
    transcript !== undefined && transcript !== null && onTranscriptOpenChange !== undefined
  const rootClassName = ['jarvis-core', className].filter(Boolean).join(' ')

  return (
    <section
      className={rootClassName}
      data-activity={activity}
      data-motion={motionMode}
      data-voice={voiceMode}
      aria-labelledby={nameId}
    >
      <div className="jarvis-core__header">
        <div className="jarvis-core__identity">
          <span className="jarvis-core__name" id={nameId}>
            {name}
          </span>
          <span
            className="jarvis-core__status"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="jarvis-core__status-dot" aria-hidden="true" />
            <span className="jarvis-core__status-text">
              <span className="jarvis-core__sr-only">{name} status: </span>
              {resolvedStatus}
            </span>
          </span>
        </div>

        {showTranscriptToggle ? (
          <button
            className="jarvis-core__transcript-toggle"
            type="button"
            aria-expanded={transcriptOpen}
            aria-controls={transcriptId}
            onClick={() => onTranscriptOpenChange(!transcriptOpen)}
          >
            {transcriptOpen ? 'Hide transcript' : 'Show transcript'}
          </button>
        ) : null}
      </div>

      <div className="jarvis-core__stage">
        <div
          className="jarvis-core__visual"
          role="img"
          aria-label={`${name} visual core. ${resolvedStatus}.`}
        >
          <span
            className="jarvis-core__halo jarvis-core__halo--outer"
            aria-hidden="true"
          />
          <span
            className="jarvis-core__ring jarvis-core__ring--outer"
            aria-hidden="true"
          />
          <span
            className="jarvis-core__ring jarvis-core__ring--primary"
            aria-hidden="true"
          />
          <span
            className="jarvis-core__ring jarvis-core__ring--inner"
            aria-hidden="true"
          />
          <span className="jarvis-core__orbit" aria-hidden="true">
            <span className="jarvis-core__orbit-node" />
          </span>
          <span className="jarvis-core__disc" aria-hidden="true">
            <span className="jarvis-core__energy" />
            <span className="jarvis-core__monogram">{name.slice(0, 1)}</span>
          </span>
        </div>
      </div>

      <div
        className="jarvis-core__captions"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="jarvis-core__caption-label">{captionLabel}</span>
        <div className="jarvis-core__utterance">
          {currentUtterance ?? 'Guidance will appear here.'}
        </div>
      </div>

      {fallbackMessage ? (
        <p
          className="jarvis-core__voice-fallback"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="jarvis-core__voice-icon" aria-hidden="true">
            {voiceMode === 'no-audio' ? 'AUDIO OFF' : 'TEXT MODE'}
          </span>
          <span>{fallbackMessage}</span>
        </p>
      ) : null}

      {transcript !== undefined && transcript !== null && transcriptOpen ? (
        <div
          className="jarvis-core__transcript"
          id={transcriptId}
          role="region"
          aria-label={transcriptLabel}
          tabIndex={0}
        >
          {transcript}
        </div>
      ) : null}
    </section>
  )
}

export default JarvisCore
