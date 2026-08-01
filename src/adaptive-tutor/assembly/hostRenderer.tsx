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

const HOST_FALLBACK_TEXT_MAXIMUM = 1200
const HOST_COMMAND_MAXIMUM = 80
const DEFAULT_VISUAL_LABEL = 'A visual teaching step is available.'
const DEFAULT_VISUAL_FALLBACK = 'Use the displayed instructions.'
const STABLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function cleanReadableText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .trim()
}

function truncateReadableText(value: string, maximum: number): string {
  if (value.length <= maximum) return value
  let prefix = value.slice(0, Math.max(0, maximum - 1))
  const finalCodeUnit = prefix.charCodeAt(prefix.length - 1)
  if (finalCodeUnit >= 0xd800 && finalCodeUnit <= 0xdbff) prefix = prefix.slice(0, -1)
  return `${prefix}…`
}

/** Every subject-provided fallback crosses this single 1,200-code-unit boundary. */
function boundedFallbackText(value: unknown, fallback: string): string {
  const primary = typeof value === 'string' ? cleanReadableText(value) : ''
  const secondary = cleanReadableText(fallback)
  return truncateReadableText(primary || secondary || DEFAULT_VISUAL_FALLBACK, HOST_FALLBACK_TEXT_MAXIMUM)
}

function fallbackField(
  fallback: RendererMediaFallback,
  field: 'missingVisualText' | 'missingAudioText',
  defaultText: string,
): string {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(fallback, field)
    return boundedFallbackText(
      descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined,
      defaultText,
    )
  } catch {
    return boundedFallbackText(undefined, defaultText)
  }
}

function displayText(value: string, maximum: number): string {
  return truncateReadableText(cleanReadableText(value), maximum)
}

function isLengthBoundedString(
  value: unknown,
  minimum: number,
  maximum: number,
): value is string {
  return typeof value === 'string' && value.length >= minimum && value.length <= maximum
}

function isReadableString(
  value: unknown,
  minimum: number,
  maximum: number,
): value is string {
  return isLengthBoundedString(value, minimum, maximum) &&
    (minimum === 0 || cleanReadableText(value).length > 0)
}

function isStableId(value: unknown): value is string {
  return isLengthBoundedString(value, 3, 120) && STABLE_ID.test(value)
}

function snapshotOwnDataRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const snapshot: Record<string, unknown> = Object.create(null) as Record<string, unknown>
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') return undefined
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return undefined
    snapshot[key] = descriptor.value
  }
  return snapshot
}

function hasExactKeys(
  command: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const keys = Object.keys(command)
  const allowed = new Set([...required, ...optional])
  return required.every((key) => Object.hasOwn(command, key)) &&
    keys.every((key) => allowed.has(key)) &&
    keys.length >= required.length &&
    keys.length <= required.length + optional.length
}

const BASE_KEYS = ['kind', 'id', 'durationMs', 'ariaLabel'] as const

function hasValidBase(
  command: Record<string, unknown>,
  kind: string,
  requiredFields: readonly string[],
  optionalFields: readonly string[] = [],
): boolean {
  return hasExactKeys(command, [...BASE_KEYS, ...requiredFields], optionalFields) &&
    command.kind === kind &&
    isStableId(command.id) &&
    typeof command.durationMs === 'number' &&
    Number.isFinite(command.durationMs) &&
    Number.isInteger(command.durationMs) &&
    command.durationMs >= 0 &&
    command.durationMs <= 30_000 &&
    isReadableString(command.ariaLabel, 1, 500)
}

function snapshotFiniteNumberArray(value: unknown): readonly number[] | undefined {
  if (!Array.isArray(value)) return undefined
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length')
  if (
    !lengthDescriptor ||
    !Object.hasOwn(lengthDescriptor, 'value') ||
    typeof lengthDescriptor.value !== 'number' ||
    !Number.isInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0 ||
    lengthDescriptor.value > 30
  ) return undefined
  const result: number[] = []
  for (let index = 0; index < lengthDescriptor.value; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
    if (
      !descriptor ||
      !Object.hasOwn(descriptor, 'value') ||
      typeof descriptor.value !== 'number' ||
      !Number.isFinite(descriptor.value)
    ) return undefined
    result.push(descriptor.value)
  }
  const allowedKeys = new Set(['length', ...result.map((_, index) => String(index))])
  if (Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !allowedKeys.has(key))) {
    return undefined
  }
  return Object.freeze(result)
}

type ContainedCommand =
  | { readonly kind: 'clear-board' }
  | { readonly kind: 'visual'; readonly step: HostVisualStep }
  | { readonly kind: 'announcement'; readonly text: string; readonly assertive: boolean }

interface CommandContainmentResult {
  readonly command?: ContainedCommand
  readonly fallbackLabel?: string
}

function containCommandUnsafe(candidate: unknown): CommandContainmentResult {
  const command = snapshotOwnDataRecord(candidate)
  if (!command) return {}
  const fallbackLabel = isReadableString(command.ariaLabel, 1, 500)
    ? displayText(command.ariaLabel, 500)
    : undefined
  if (typeof command.kind !== 'string') return { fallbackLabel }
  const label = fallbackLabel ?? DEFAULT_VISUAL_LABEL

  switch (command.kind) {
    case 'clear-board':
      return hasValidBase(command, command.kind, [])
        ? { command: { kind: 'clear-board' }, fallbackLabel }
        : { fallbackLabel }
    case 'set-title':
      return hasValidBase(command, command.kind, ['text']) &&
        isReadableString(command.text, 1, 200)
        ? { command: { kind: 'visual', step: {
            kind: 'title', label, text: displayText(command.text, 200),
          } }, fallbackLabel }
        : { fallbackLabel }
    case 'add-text':
      return hasValidBase(command, command.kind, ['text', 'region', 'emphasis']) &&
        isReadableString(command.text, 1, 1200) &&
        ['top', 'center', 'bottom', 'side'].includes(command.region as string) &&
        ['normal', 'strong', 'muted'].includes(command.emphasis as string)
        ? { command: { kind: 'visual', step: {
            kind: 'text', label, text: displayText(command.text, 1200),
          } }, fallbackLabel }
        : { fallbackLabel }
    case 'draw-fraction':
      return hasValidBase(
        command,
        command.kind,
        ['numerator', 'denominator', 'label', 'representation'],
      ) &&
        typeof command.numerator === 'number' &&
        Number.isInteger(command.numerator) &&
        command.numerator >= 0 && command.numerator <= 100 &&
        typeof command.denominator === 'number' &&
        Number.isInteger(command.denominator) &&
        command.denominator >= 1 && command.denominator <= 100 &&
        isReadableString(command.label, 1, 100) &&
        ['bar', 'circle', 'set'].includes(command.representation as string)
        ? { command: { kind: 'visual', step: {
            kind: 'fraction',
            label,
            numerator: command.numerator,
            denominator: command.denominator,
            displayLabel: displayText(command.label, 100),
          } }, fallbackLabel }
        : { fallbackLabel }
    case 'draw-number-line': {
      const highlightedValues = snapshotFiniteNumberArray(command.highlightedValues)
      return hasValidBase(
        command,
        command.kind,
        ['min', 'max', 'step', 'highlightedValues'],
      ) &&
        typeof command.min === 'number' && Number.isFinite(command.min) &&
        typeof command.max === 'number' && Number.isFinite(command.max) &&
        typeof command.step === 'number' && Number.isFinite(command.step) && command.step > 0 &&
        command.max > command.min &&
        highlightedValues !== undefined
        ? { command: { kind: 'visual', step: {
            kind: 'number-line',
            label,
            min: command.min,
            max: command.max,
            step: command.step,
            highlightedValues,
          } }, fallbackLabel }
        : { fallbackLabel }
    }
    case 'show-sentence-parts':
      return hasValidBase(
        command,
        command.kind,
        ['sentence', 'subject', 'predicate'],
        ['dependentMarker'],
      ) &&
        isReadableString(command.sentence, 1, 500) &&
        isLengthBoundedString(command.subject, 0, 300) &&
        isLengthBoundedString(command.predicate, 0, 300) &&
        (!Object.hasOwn(command, 'dependentMarker') ||
          isLengthBoundedString(command.dependentMarker, 0, 100))
        ? { command: { kind: 'visual', step: {
            kind: 'sentence-parts',
            label,
            sentence: displayText(command.sentence, 500),
            subject: displayText(command.subject, 300),
            predicate: displayText(command.predicate, 300),
            ...(typeof command.dependentMarker === 'string'
              ? { dependentMarker: displayText(command.dependentMarker, 100) }
              : {}),
          } }, fallbackLabel }
        : { fallbackLabel }
    case 'highlight':
      return hasValidBase(command, command.kind, ['targetCommandId', 'token', 'reason']) &&
        isStableId(command.targetCommandId) &&
        isReadableString(command.token, 1, 200) &&
        isReadableString(command.reason, 1, 500)
        ? { command: { kind: 'visual', step: {
            kind: 'highlight',
            label,
            token: displayText(command.token, 200),
            reason: displayText(command.reason, 500),
          } }, fallbackLabel }
        : { fallbackLabel }
    case 'reveal-step':
      return hasValidBase(command, command.kind, ['stepNumber', 'text']) &&
        typeof command.stepNumber === 'number' &&
        Number.isInteger(command.stepNumber) &&
        command.stepNumber >= 1 && command.stepNumber <= 50 &&
        isReadableString(command.text, 1, 800)
        ? { command: { kind: 'visual', step: {
            kind: 'reveal-step',
            label,
            stepNumber: command.stepNumber,
            text: displayText(command.text, 800),
          } }, fallbackLabel }
        : { fallbackLabel }
    case 'compare':
      return hasValidBase(command, command.kind, ['leftLabel', 'rightLabel', 'relationship']) &&
        isReadableString(command.leftLabel, 1, 300) &&
        isReadableString(command.rightLabel, 1, 300) &&
        ['equal', 'not-equal', 'part-whole', 'complete-incomplete']
          .includes(command.relationship as string)
        ? { command: { kind: 'visual', step: {
            kind: 'compare',
            label,
            leftLabel: displayText(command.leftLabel, 300),
            rightLabel: displayText(command.rightLabel, 300),
            relationship: command.relationship as string,
          } }, fallbackLabel }
        : { fallbackLabel }
    case 'aria-announce':
      return hasValidBase(command, command.kind, ['text', 'priority']) &&
        isReadableString(command.text, 1, 800) &&
        (command.priority === 'polite' || command.priority === 'assertive')
        ? { command: {
            kind: 'announcement',
            text: displayText(command.text, 800),
            assertive: command.priority === 'assertive',
          }, fallbackLabel }
        : { fallbackLabel }
    default:
      return { fallbackLabel }
  }
}

function containCommand(candidate: unknown): CommandContainmentResult {
  try {
    return containCommandUnsafe(candidate)
  } catch {
    return {}
  }
}

function snapshotCommandArray(commands: readonly unknown[]): readonly unknown[] | undefined {
  try {
    if (!Array.isArray(commands)) return undefined
    const lengthDescriptor = Object.getOwnPropertyDescriptor(commands, 'length')
    if (
      !lengthDescriptor ||
      !Object.hasOwn(lengthDescriptor, 'value') ||
      typeof lengthDescriptor.value !== 'number' ||
      !Number.isInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0
    ) return undefined
    const candidates: unknown[] = []
    const length = Math.min(lengthDescriptor.value, HOST_COMMAND_MAXIMUM)
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(commands, String(index))
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) return undefined
      candidates.push(descriptor.value)
    }
    return candidates
  } catch {
    return undefined
  }
}

function fallbackStep(fallbackText: unknown, label?: string): HostVisualStep {
  const safeLabel = label || 'Visual unavailable'
  return {
    kind: 'text-fallback',
    label: safeLabel,
    text: boundedFallbackText(label, typeof fallbackText === 'string'
      ? fallbackText
      : DEFAULT_VISUAL_FALLBACK),
  }
}

export function buildHostVisualPresentation(
  commands: readonly unknown[],
  capabilities: TutorMediaCapabilities,
  fallback: RendererMediaFallback,
): HostVisualPresentation {
  const steps: HostVisualStep[] = []
  const announcements: { text: string; assertive: boolean }[] = []
  const candidates = snapshotCommandArray(commands)
  const missingVisualText = fallbackField(
    fallback,
    'missingVisualText',
    DEFAULT_VISUAL_FALLBACK,
  )

  for (const candidate of candidates ?? []) {
    const contained = containCommand(candidate)
    if (!contained.command) {
      if (capabilities.visualsAvailable) {
        steps.push(fallbackStep(missingVisualText, contained.fallbackLabel))
      }
      continue
    }
    if (contained.command.kind === 'announcement') {
      announcements.push({
        text: contained.command.text,
        assertive: contained.command.assertive,
      })
      continue
    }
    if (contained.command.kind === 'clear-board') {
      // The host board is a stateless one-step projection, so a valid clear is an intentional no-op.
      continue
    }
    if (capabilities.visualsAvailable) {
      steps.push(contained.command.step)
    }
  }

  if (!capabilities.visualsAvailable || steps.length === 0) {
    steps.push(fallbackStep(missingVisualText))
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
          <p role="status">{
            fallbackField(mediaFallback, 'missingAudioText', response.spokenTurn.fallbackText)
          }</p>
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
