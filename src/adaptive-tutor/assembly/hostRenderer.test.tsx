import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ValidatedTutorResponse } from './types'
import {
  AdaptiveTutorFailureView,
  AdaptiveTutorResponseView,
  buildHostVisualPresentation,
  deriveHostTutorAction,
} from './hostRenderer'

const fallback = {
  missingVisualText: 'Use the displayed visual description.',
  missingAudioText: 'Voice is unavailable; read the displayed words.',
  lessonMayContinueWithoutMedia: true as const,
}
const capabilities = { visualsAvailable: true, voiceAvailable: true }

function response(overrides: Partial<ValidatedTutorResponse> = {}): ValidatedTutorResponse {
  return {
    id: 'response-001',
    phase: 'guided-practice',
    learnerMessage: 'What is the next step?',
    spokenTurn: { text: 'What is the next step?', fallbackText: 'Read the question.' },
    boardCommands: [],
    assessmentPrompt: 'What is the next step?',
    expectedInput: 'answer',
    uncertaintyStatement: 'This is instructional evidence, not a diagnosis.',
    alternateExplanationAvailable: true,
    escalationReason: null,
    ...overrides,
  }
}

describe('Adaptive Tutor host renderer', () => {
  it('maps every frozen Core v0.2 visual command kind or control explicitly', () => {
    const commands = [
      { kind: 'clear-board', ariaLabel: 'Clear', id: 'c', durationMs: 0 },
      { kind: 'set-title', ariaLabel: 'Title', text: 'Fractions', id: 't', durationMs: 0 },
      { kind: 'add-text', ariaLabel: 'Text', text: 'Compare these.', id: 'x', durationMs: 0 },
      { kind: 'draw-fraction', ariaLabel: 'One half', numerator: 1, denominator: 2, label: '1/2', id: 'f', durationMs: 0 },
      { kind: 'draw-number-line', ariaLabel: 'Line', min: 0, max: 10, step: 1, highlightedValues: [5], id: 'n', durationMs: 0 },
      { kind: 'show-sentence-parts', ariaLabel: 'Sentence', sentence: 'Birds fly.', subject: 'Birds', predicate: 'fly', id: 's', durationMs: 0 },
      { kind: 'highlight', ariaLabel: 'Highlight', token: 'Birds', reason: 'subject', id: 'h', durationMs: 0 },
      { kind: 'reveal-step', ariaLabel: 'Step', stepNumber: 1, text: 'Find a common denominator.', id: 'r', durationMs: 0 },
      { kind: 'compare', ariaLabel: 'Compare', leftLabel: '1/2', rightLabel: '2/4', relationship: 'equal', id: 'p', durationMs: 0 },
      { kind: 'aria-announce', ariaLabel: 'Announce', text: 'New step', priority: 'polite', id: 'a', durationMs: 0 },
    ]
    const presentation = buildHostVisualPresentation(commands, capabilities, fallback)
    expect(presentation.steps.map((step) => step.kind)).toEqual([
      'title', 'text', 'fraction', 'number-line', 'sentence-parts', 'highlight', 'reveal-step', 'compare',
    ])
    expect(presentation.announcements).toEqual([{ text: 'New step', assertive: false }])
  })

  it.each(['unknown-command', '__proto__', 'constructor', 'toString'])(
    'uses accessible text fallback for unknown kind %s',
    (kind) => {
      const result = buildHostVisualPresentation(
        [{ kind, ariaLabel: `Fallback for ${kind}` }],
        capabilities,
        fallback,
      )
      expect(result.steps[0]).toMatchObject({
        kind: 'text-fallback',
        text: `Fallback for ${kind}`,
      })
    },
  )

  it('bounds pathological visuals and command counts without throwing', () => {
    const commands = [
      { kind: 'draw-fraction', ariaLabel: 'Huge fraction', numerator: 1, denominator: 1_000_000 },
      { kind: 'draw-number-line', ariaLabel: 'Infinite line', min: 0, max: Infinity, step: NaN, highlightedValues: [] },
      ...Array.from({ length: 100 }, (_, index) => ({ kind: 'add-text', ariaLabel: 'Text', text: String(index) })),
    ]
    const result = buildHostVisualPresentation(commands, capabilities, fallback)
    expect(result.steps).toHaveLength(80)
    expect(result.steps[0].kind).toBe('text-fallback')
    expect(result.steps[1].kind).toBe('text-fallback')
  })

  it('keeps text usable when visual and voice media are unavailable', () => {
    const html = renderToStaticMarkup(
      <AdaptiveTutorResponseView
        response={response({ boardCommands: [{ kind: 'add-text', text: 'Visual' }] })}
        capabilities={{ visualsAvailable: false, voiceAvailable: false }}
        mediaFallback={fallback}
      />,
    )
    expect(html).toContain('Use the displayed visual description.')
    expect(html).toContain('Voice is unavailable; read the displayed words.')
    expect(html).toContain('What is the next step?')
    expect(html).toContain('role="status"')
  })

  it('renders subject text as escaped React text and never exposes answer keys', () => {
    const html = renderToStaticMarkup(
      <AdaptiveTutorResponseView
        response={response({
          learnerMessage: '<img src=x onerror=SECRET_HANDLER>',
          spokenTurn: { text: '<script>SECRET_SCRIPT</script>', fallbackText: 'fallback' },
        })}
        capabilities={capabilities}
        mediaFallback={fallback}
      />,
    )
    expect(html).toContain('&lt;img src=x onerror=SECRET_HANDLER&gt;')
    expect(html).toContain('&lt;script&gt;SECRET_SCRIPT&lt;/script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('correctOptionIds')
    expect(html).not.toContain('acceptedAnswers')
    expect(html).not.toContain('correctOrder')
  })

  it('presents only one active visual step with keyboard-native navigation', () => {
    const html = renderToStaticMarkup(
      <AdaptiveTutorResponseView
        response={response({ boardCommands: [
          { kind: 'add-text', ariaLabel: 'First', text: 'FIRST_VISIBLE' },
          { kind: 'add-text', ariaLabel: 'Second', text: 'SECOND_HIDDEN' },
        ] })}
        capabilities={capabilities}
        mediaFallback={fallback}
      />,
    )
    expect(html).toContain('FIRST_VISIBLE')
    expect(html).not.toContain('SECOND_HIDDEN')
    expect(html).toContain('<button')
    expect(html).toContain('Previous visual step')
    expect(html).toContain('Next visual step')
  })

  it('labels phases, reduced motion, focus target, status, and adult review accessibly', () => {
    const html = renderToStaticMarkup(
      <AdaptiveTutorResponseView
        response={response({
          phase: 'escalated',
          expectedInput: 'adult-review',
          assessmentPrompt: null,
        })}
        capabilities={capabilities}
        mediaFallback={fallback}
        reducedMotionOverride
      />,
    )
    expect(html).toContain('Adult-review notice')
    expect(html).toContain('tabindex="-1"')
    expect(html).toContain('data-motion="reduced"')
    expect(html).toContain('A parent or teacher review is available.')
    expect(html).toContain('aria-live="polite"')
  })

  it('derives host actions from phase plus assessment presence, including R1 teaching turns', () => {
    expect(deriveHostTutorAction(response())).toEqual({ kind: 'submit' })
    expect(deriveHostTutorAction(response({
      phase: 'teach-visually', expectedInput: 'answer', assessmentPrompt: null,
    }))).toEqual({ kind: 'participation-then-continue' })
    expect(deriveHostTutorAction(response({
      phase: 'reteach', expectedInput: 'continue', assessmentPrompt: null,
    }))).toEqual({ kind: 'continue' })
    expect(deriveHostTutorAction(response({
      phase: 'escalated', expectedInput: 'adult-review', assessmentPrompt: null,
    }))).toEqual({ kind: 'adult-review' })
    expect(deriveHostTutorAction(response({
      phase: 'teach-visually', expectedInput: 'adult-review', assessmentPrompt: null,
    }))).toEqual({ kind: 'adult-review' })
  })

  it('renders blocking failures as fixed accessible alerts', () => {
    const html = renderToStaticMarkup(<AdaptiveTutorFailureView failure={{
      stage: 'validation',
      code: 'CORE_VALIDATION_FAILED',
      safeMessage: 'This program could not be validated.',
    }} />)
    expect(html).toContain('role="alert"')
    expect(html).toContain('This program could not be validated.')
  })
})
