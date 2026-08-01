import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import type { AssemblyFailure, ValidatedTutorResponse } from './types'

export interface RendererMediaFallback {
  readonly missingVisualText: string
  readonly missingAudioText: string
  readonly lessonMayContinueWithoutMedia: true
}

export interface TutorMediaCapabilities {
  readonly visualsAvailable: boolean
  readonly voiceAvailable: boolean
}

export type HostVisualStep =
  | { readonly kind: 'title'; readonly label: string; readonly text: string }
  | { readonly kind: 'text'; readonly label: string; readonly text: string }
  | {
      readonly kind: 'fraction'
      readonly label: string
      readonly numerator: number
      readonly denominator: number
      readonly displayLabel: string
    }
  | {
      readonly kind: 'number-line'
      readonly label: string
      readonly min: number
      readonly max: number
      readonly step: number
      readonly highlightedValues: readonly number[]
    }
  | {
      readonly kind: 'sentence-parts'
      readonly label: string
      readonly sentence: string
      readonly subject: string
      readonly predicate: string
      readonly dependentMarker?: string
    }
  | {
      readonly kind: 'highlight'
      readonly label: string
      readonly token: string
      readonly reason: string
    }
  | {
      readonly kind: 'reveal-step'
      readonly label: string
      readonly stepNumber: number
      readonly text: string
    }
  | {
      readonly kind: 'compare'
      readonly label: string
      readonly leftLabel: string
      readonly rightLabel: string
      readonly relationship: string
    }
  | { readonly kind: 'text-fallback'; readonly label: string; readonly text: string }

export interface HostVisualPresentation {
  readonly steps: readonly HostVisualStep[]
  readonly announcements: readonly { readonly text: string; readonly assertive: boolean }[]
}

export type HostTutorAction =
  | { readonly kind: 'none' }
  | { readonly kind: 'submit' }
  | { readonly kind: 'continue' }
  | { readonly kind: 'participation-then-continue' }
  | { readonly kind: 'adult-review' }

export function deriveHostTutorAction(response: ValidatedTutorResponse): HostTutorAction {
  if (response.expectedInput === 'adult-review') return { kind: 'adult-review' }
  if (
    response.phase === 'teach-visually' &&
    response.expectedInput === 'answer' &&
    response.assessmentPrompt === null
  ) return { kind: 'participation-then-continue' }
  if (
    response.expectedInput === 'answer' &&
    response.assessmentPrompt !== null &&
    ['assessment', 'guided-practice', 'independent-attempt', 'reassess']
      .includes(response.phase)
  ) return { kind: 'submit' }
  if (response.expectedInput === 'continue') return { kind: 'continue' }
  return { kind: 'none' }
}

function phaseLabel(response: ValidatedTutorResponse): string {
  switch (response.phase) {
    case 'assessment': return 'Assessment question'
    case 'identify-missing-concept': return 'Learning check'
    case 'teach-visually': return 'Visual teaching step'
    case 'guided-practice': return 'Guided-practice question'
    case 'independent-attempt': return 'Independent-mastery question'
    case 'reassess': return 'Reassessment question'
    case 'advance': return 'Next-step review'
    case 'reteach': return 'Reteaching step'
    case 'escalated': return 'Adult-review notice'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function boundedText(value: unknown, fallback: string, maximum = 1200): string {
  return typeof value === 'string' && value.length > 0
    ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, maximum)
    : fallback
}

function labelFor(command: Record<string, unknown>): string {
  return boundedText(command.ariaLabel, 'A visual teaching step is available.', 500)
}

type CommandRenderer = (command: Record<string, unknown>) => HostVisualStep | undefined

const commandRenderers: Readonly<Record<string, CommandRenderer>> = Object.freeze({
  'set-title': (command) => typeof command.text === 'string'
    ? { kind: 'title', label: labelFor(command), text: boundedText(command.text, 'Tutor board') }
    : undefined,
  'add-text': (command) => typeof command.text === 'string'
    ? { kind: 'text', label: labelFor(command), text: boundedText(command.text, labelFor(command)) }
    : undefined,
  'draw-fraction': (command) =>
    typeof command.numerator === 'number' &&
    typeof command.denominator === 'number' &&
    Number.isInteger(command.numerator) &&
    Number.isInteger(command.denominator) &&
    command.numerator >= 0 &&
    command.numerator <= 100 &&
    command.denominator > 0 &&
    command.denominator <= 100 &&
    typeof command.label === 'string'
      ? {
          kind: 'fraction',
          label: labelFor(command),
          numerator: command.numerator,
          denominator: command.denominator,
          displayLabel: boundedText(command.label, `${command.numerator}/${command.denominator}`, 100),
        }
      : undefined,
  'draw-number-line': (command) =>
    typeof command.min === 'number' &&
    typeof command.max === 'number' &&
    typeof command.step === 'number' &&
    Number.isFinite(command.min) &&
    Number.isFinite(command.max) &&
    Number.isFinite(command.step) &&
    command.max > command.min &&
    command.step > 0 &&
    Array.isArray(command.highlightedValues) &&
    command.highlightedValues.length <= 30 &&
    command.highlightedValues.every((value) =>
      typeof value === 'number' && Number.isFinite(value))
      ? {
          kind: 'number-line',
          label: labelFor(command),
          min: command.min,
          max: command.max,
          step: command.step,
          highlightedValues: Object.freeze([...command.highlightedValues]),
        }
      : undefined,
  'show-sentence-parts': (command) =>
    typeof command.sentence === 'string' &&
    typeof command.subject === 'string' &&
    typeof command.predicate === 'string'
      ? {
          kind: 'sentence-parts',
          label: labelFor(command),
          sentence: boundedText(command.sentence, labelFor(command), 500),
          subject: boundedText(command.subject, 'Subject', 300),
          predicate: boundedText(command.predicate, 'Predicate', 300),
          ...(typeof command.dependentMarker === 'string'
            ? { dependentMarker: boundedText(command.dependentMarker, 'Marker', 100) }
            : {}),
        }
      : undefined,
  highlight: (command) => typeof command.token === 'string' && typeof command.reason === 'string'
    ? {
        kind: 'highlight',
        label: labelFor(command),
        token: boundedText(command.token, 'Highlighted part', 200),
        reason: boundedText(command.reason, labelFor(command), 500),
      }
    : undefined,
  'reveal-step': (command) =>
    typeof command.stepNumber === 'number' &&
    Number.isInteger(command.stepNumber) &&
    typeof command.text === 'string'
      ? {
          kind: 'reveal-step',
          label: labelFor(command),
          stepNumber: command.stepNumber,
          text: boundedText(command.text, labelFor(command), 800),
        }
      : undefined,
  compare: (command) =>
    typeof command.leftLabel === 'string' &&
    typeof command.rightLabel === 'string' &&
    typeof command.relationship === 'string'
      ? {
          kind: 'compare',
          label: labelFor(command),
          leftLabel: boundedText(command.leftLabel, 'First representation', 300),
          rightLabel: boundedText(command.rightLabel, 'Second representation', 300),
          relationship: boundedText(command.relationship, 'comparison', 40),
        }
      : undefined,
})

function fallbackStep(command: Record<string, unknown>, fallbackText: string): HostVisualStep {
  const label = labelFor(command)
  return {
    kind: 'text-fallback',
    label,
    text: label === 'A visual teaching step is available.' ? fallbackText : label,
  }
}

export function buildHostVisualPresentation(
  commands: readonly unknown[],
  capabilities: TutorMediaCapabilities,
  fallback: RendererMediaFallback,
): HostVisualPresentation {
  if (!capabilities.visualsAvailable) {
    return Object.freeze({
      steps: Object.freeze([{
        kind: 'text-fallback' as const,
        label: 'Visual unavailable',
        text: boundedText(fallback.missingVisualText, 'Use the displayed instructions.'),
      }]),
      announcements: Object.freeze([]),
    })
  }

  const steps: HostVisualStep[] = []
  const announcements: { text: string; assertive: boolean }[] = []
  for (const candidate of commands.slice(0, 80)) {
    if (!isRecord(candidate)) {
      steps.push({
        kind: 'text-fallback',
        label: 'Visual unavailable',
        text: boundedText(fallback.missingVisualText, 'Use the displayed instructions.'),
      })
      continue
    }
    if (candidate.kind === 'clear-board') continue
    if (candidate.kind === 'aria-announce') {
      announcements.push({
        text: boundedText(candidate.text, labelFor(candidate), 800),
        assertive: candidate.priority === 'assertive',
      })
      continue
    }
    const renderer = typeof candidate.kind === 'string' && Object.hasOwn(commandRenderers, candidate.kind)
      ? commandRenderers[candidate.kind]
      : undefined
    steps.push(renderer?.(candidate) ?? fallbackStep(candidate, fallback.missingVisualText))
  }
  if (steps.length === 0) {
    steps.push({
      kind: 'text-fallback',
      label: 'Displayed instruction',
      text: boundedText(fallback.missingVisualText, 'Use the displayed instructions.'),
    })
  }
  return Object.freeze({
    steps: Object.freeze(steps),
    announcements: Object.freeze(announcements),
  })
}

function VisualStep({ step }: { readonly step: HostVisualStep }) {
  switch (step.kind) {
    case 'fraction': {
      const filled = Math.max(0, Math.min(step.numerator, step.denominator))
      return (
        <figure role="img" aria-label={step.label}>
          <div className="flex flex-wrap gap-1" aria-hidden="true">
            {Array.from({ length: step.denominator }, (_, index) => (
              <span
                key={index}
                className={`h-8 w-8 border border-slate-700 ${index < filled ? 'bg-blue-300' : 'bg-white'}`}
              />
            ))}
          </div>
          <figcaption className="mt-2 font-semibold">{step.displayLabel}</figcaption>
        </figure>
      )
    }
    case 'number-line':
      return (
        <figure role="img" aria-label={step.label}>
          <div className="flex items-center gap-2 font-mono" aria-hidden="true">
            <span>{step.min}</span><span className="grow border-t-2 border-slate-700" />
            {step.highlightedValues.map((value) => <strong key={value}>{value}</strong>)}
            <span className="grow border-t-2 border-slate-700" /><span>{step.max}</span>
          </div>
          <figcaption className="sr-only">{step.label}</figcaption>
        </figure>
      )
    case 'sentence-parts':
      return (
        <div role="group" aria-label={step.label}>
          <p>{step.sentence}</p>
          <dl><dt>Subject</dt><dd>{step.subject}</dd><dt>Predicate</dt><dd>{step.predicate}</dd></dl>
          {step.dependentMarker && <p>Dependent marker: {step.dependentMarker}</p>}
        </div>
      )
    case 'highlight':
      return <p aria-label={step.label}><mark>{step.token}</mark> — {step.reason}</p>
    case 'reveal-step':
      return <p aria-label={step.label}><strong>Step {step.stepNumber}:</strong> {step.text}</p>
    case 'compare':
      return <p aria-label={step.label}>{step.leftLabel} ↔ {step.rightLabel}: {step.relationship}</p>
    case 'title':
      return <h3 aria-label={step.label}>{step.text}</h3>
    case 'text':
    case 'text-fallback':
      return <p aria-label={step.label}>{step.text}</p>
  }
}

export interface AdaptiveTutorResponseViewProps {
  readonly response: ValidatedTutorResponse
  readonly capabilities: TutorMediaCapabilities
  readonly mediaFallback: RendererMediaFallback
  readonly reducedMotionOverride?: boolean
}

export function AdaptiveTutorResponseView({
  response,
  capabilities,
  mediaFallback,
  reducedMotionOverride,
}: AdaptiveTutorResponseViewProps) {
  const presentation = useMemo(
    () => buildHostVisualPresentation(response.boardCommands, capabilities, mediaFallback),
    [response.boardCommands, capabilities, mediaFallback],
  )
  const [stepIndex, setStepIndex] = useState(0)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const reducedMotion = reducedMotionOverride ?? (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  const safeStepIndex = Math.min(stepIndex, presentation.steps.length - 1)

  useEffect(() => {
    setStepIndex(0)
    headingRef.current?.focus({ preventScroll: reducedMotion })
  }, [response.id, reducedMotion])

  return (
    <section
      aria-labelledby={`tutor-response-${response.id}`}
      data-motion={reducedMotion ? 'reduced' : 'standard'}
      className="space-y-4"
    >
      <h2 id={`tutor-response-${response.id}`} ref={headingRef} tabIndex={-1}>
        {phaseLabel(response)}
      </h2>
      <p>{response.learnerMessage}</p>
      <div aria-label="Tutor visual board">
        <VisualStep step={presentation.steps[safeStepIndex]} />
      </div>
      {presentation.steps.length > 1 && (
        <nav aria-label="Visual teaching steps" className="flex gap-2">
          <button
            type="button"
            onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
            disabled={safeStepIndex === 0}
          >Previous visual step</button>
          <button
            type="button"
            onClick={() => setStepIndex((index) => Math.min(presentation.steps.length - 1, index + 1))}
            disabled={safeStepIndex === presentation.steps.length - 1}
          >Next visual step</button>
        </nav>
      )}
      <aside aria-label="Spoken turn transcript">
        <p>{response.spokenTurn.text}</p>
        {!capabilities.voiceAvailable && (
          <p role="status">{boundedText(mediaFallback.missingAudioText, response.spokenTurn.fallbackText)}</p>
        )}
      </aside>
      <p role="status" aria-live="polite">{response.uncertaintyStatement}</p>
      {response.expectedInput === 'adult-review' && (
        <p role="status">A parent or teacher review is available.</p>
      )}
      {presentation.announcements.map((announcement, index) => (
        <p
          key={`${response.id}-announcement-${index}`}
          role={announcement.assertive ? 'alert' : 'status'}
          aria-live={announcement.assertive ? 'assertive' : 'polite'}
          className="sr-only"
        >{announcement.text}</p>
      ))}
    </section>
  )
}

export function AdaptiveTutorFailureView({ failure }: { readonly failure: AssemblyFailure }) {
  return (
    <section role="alert" aria-live="assertive" className="rounded border border-amber-500 p-4">
      <h2>Tutor unavailable</h2>
      <p>{failure.safeMessage}</p>
      <p>Return to the student home screen or ask an adult to try again.</p>
    </section>
  )
}

interface AdaptiveTutorRenderErrorBoundaryProps {
  readonly children: ReactNode
  readonly onFailure?: () => void
}

interface AdaptiveTutorRenderErrorBoundaryState {
  readonly failed: boolean
}

/** Host-owned render containment; raw errors and subject content are never displayed. */
export class AdaptiveTutorRenderErrorBoundary extends Component<
  AdaptiveTutorRenderErrorBoundaryProps,
  AdaptiveTutorRenderErrorBoundaryState
> {
  state: AdaptiveTutorRenderErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): AdaptiveTutorRenderErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    this.props.onFailure?.()
  }

  render() {
    if (this.state.failed) {
      return <AdaptiveTutorFailureView failure={{
        stage: 'renderer',
        code: 'RENDER_RESPONSE_INVALID',
        safeMessage: 'The tutor display could not show this step safely.',
      }} />
    }
    return this.props.children
  }
}
