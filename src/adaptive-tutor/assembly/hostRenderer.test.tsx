import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
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

function base(kind: string, id = `${kind}-command`) {
  return { kind, id, durationMs: 0, ariaLabel: `${kind} instruction` }
}

function addText(text = 'Compare these.') {
  return {
    ...base('add-text'),
    text,
    region: 'center',
    emphasis: 'normal',
  }
}

function announce(priority: 'polite' | 'assertive', text: string) {
  return { ...base('aria-announce', `announce-${priority}`), text, priority }
}

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
  it('maps every exact frozen Core v0.2 command variant or control explicitly', () => {
    const commands = [
      { ...base('clear-board'), },
      { ...base('set-title'), text: 'Fractions' },
      addText(),
      {
        ...base('draw-fraction'),
        numerator: 1,
        denominator: 2,
        label: '1/2',
        representation: 'bar',
      },
      {
        ...base('draw-number-line'),
        min: 0,
        max: 10,
        step: 1,
        highlightedValues: [5],
      },
      {
        ...base('show-sentence-parts'),
        sentence: 'Birds fly.',
        subject: 'Birds',
        predicate: 'fly',
      },
      {
        ...base('highlight'),
        targetCommandId: 'text-command',
        token: 'Birds',
        reason: 'subject',
      },
      { ...base('reveal-step'), stepNumber: 1, text: 'Find a common denominator.' },
      {
        ...base('compare'),
        leftLabel: '1/2',
        rightLabel: '2/4',
        relationship: 'equal',
      },
      announce('polite', 'New step'),
    ]
    const presentation = buildHostVisualPresentation(commands, capabilities, fallback)
    expect(presentation.steps.map((step) => step.kind)).toEqual([
      'title', 'text', 'fraction', 'number-line', 'sentence-parts', 'highlight', 'reveal-step', 'compare',
    ])
    expect(presentation.announcements).toEqual([{ text: 'New step', assertive: false }])
  })

  it('treats a valid clear-board as an explicit stateless no-op', () => {
    const result = buildHostVisualPresentation([{ ...base('clear-board') }], capabilities, fallback)
    expect(result.steps).toEqual([{
      kind: 'text-fallback',
      label: 'Visual unavailable',
      text: fallback.missingVisualText,
    }])
    expect(result.announcements).toEqual([])
  })

  it.each([
    ['missing discriminator', { id: 'bad-command', durationMs: 0, ariaLabel: 'Missing kind' }],
    ['missing command id', { kind: 'set-title', durationMs: 0, ariaLabel: 'Title', text: 'Title' }],
    ['missing base field', { kind: 'set-title', id: 'title-command', ariaLabel: 'Title', text: 'Title' }],
    ['wrong field type', { ...base('set-title'), text: { value: 'Title' } }],
    ['non-finite number', { ...base('draw-number-line'), min: 0, max: Infinity, step: 1, highlightedValues: [] }],
    ['out-of-range reveal step', { ...base('reveal-step'), stepNumber: 51, text: 'Too late' }],
    ['invalid comparison', { ...base('compare'), leftLabel: 'a', rightLabel: 'b', relationship: 'similar' }],
    ['missing add-text region', { ...base('add-text'), text: 'Text', emphasis: 'normal' }],
    ['missing fraction representation', { ...base('draw-fraction'), numerator: 1, denominator: 2, label: '1/2' }],
    ['missing highlight target', { ...base('highlight'), token: 'x', reason: 'reason' }],
    ['oversized title', { ...base('set-title'), text: 'X'.repeat(201) }],
    ['array substitution', { ...base('add-text'), text: ['not text'], region: 'center', emphasis: 'normal' }],
    ['unexpected extra field', { ...base('set-title'), text: 'Title', internal: 'diagnostic' }],
  ])('fails closed to a bounded fallback for %s', (_label, command) => {
    const result = buildHostVisualPresentation([command], capabilities, fallback)
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0]).toMatchObject({ kind: 'text-fallback' })
    if (result.steps[0]?.kind === 'text-fallback') {
      expect(result.steps[0].text.length).toBeLessThanOrEqual(1200)
      expect(result.steps[0].text).not.toContain('diagnostic')
    }
  })

  it.each([0, 51])('rejects reveal-step number %s', (stepNumber) => {
    const result = buildHostVisualPresentation(
      [{ ...base('reveal-step'), stepNumber, text: 'Out of range' }],
      capabilities,
      fallback,
    )
    expect(result.steps[0]?.kind).toBe('text-fallback')
  })

  it.each(['unknown-command', '__proto__', 'constructor', 'toString'])(
    'uses accessible text fallback for unknown kind %s',
    (kind) => {
      const result = buildHostVisualPresentation(
        [{ ...base(kind, `unknown-${kind.replace(/[^a-z0-9]+/g, 'x')}`), ariaLabel: `Fallback for ${kind}` }],
        capabilities,
        fallback,
      )
      expect(result.steps[0]).toMatchObject({
        kind: 'text-fallback',
        text: `Fallback for ${kind}`,
      })
    },
  )

  it('bounds empty, normal, oversized, multiline, and adversarial fallback text', () => {
    const unavailable = { kind: 'unknown-command' }
    const empty = buildHostVisualPresentation(
      [unavailable], capabilities, { ...fallback, missingVisualText: '' },
    )
    expect(empty.steps[0]).toMatchObject({ text: 'Use the displayed instructions.' })

    const normal = buildHostVisualPresentation([unavailable], capabilities, fallback)
    expect(normal.steps[0]).toMatchObject({ text: fallback.missingVisualText })

    const oversized = buildHostVisualPresentation(
      [unavailable], capabilities, { ...fallback, missingVisualText: 'X'.repeat(5_000) },
    )
    expect(oversized.steps[0]?.kind).toBe('text-fallback')
    if (oversized.steps[0]?.kind === 'text-fallback') {
      expect(oversized.steps[0].text).toHaveLength(1200)
      expect(oversized.steps[0].text.endsWith('…')).toBe(true)
    }

    const multiline = buildHostVisualPresentation(
      [unavailable],
      capabilities,
      { ...fallback, missingVisualText: 'Line one\r\nLine two\u0000<script>not html</script>' },
    )
    expect(multiline.steps[0]).toMatchObject({
      text: 'Line one\nLine two <script>not html</script>',
    })
  })

  it('does not split a surrogate pair when truncating fallback text', () => {
    const result = buildHostVisualPresentation(
      [{ kind: 'unknown-command' }],
      capabilities,
      { ...fallback, missingVisualText: `${'X'.repeat(1198)}😀TAIL` },
    )
    expect(result.steps[0]?.kind).toBe('text-fallback')
    if (result.steps[0]?.kind === 'text-fallback') {
      expect(result.steps[0].text.length).toBeLessThanOrEqual(1200)
      expect(result.steps[0].text).not.toMatch(/[\ud800-\udbff]…$/)
    }
  })

  it('rejects inherited commands, accessors, Proxies, and hostile command arrays without throwing', () => {
    const inherited = Object.create(addText())
    const getter = vi.fn(() => { throw new Error('HOSTILE_GETTER') })
    const accessor = { ...addText() }
    Object.defineProperty(accessor, 'kind', { enumerable: true, get: getter })
    const proxy = new Proxy({}, { ownKeys: () => { throw new Error('HOSTILE_PROXY') } })
    const revoked = Proxy.revocable({}, {})
    revoked.revoke()

    for (const command of [inherited, accessor, proxy, revoked.proxy]) {
      expect(() => buildHostVisualPresentation([command], capabilities, fallback)).not.toThrow()
      expect(buildHostVisualPresentation([command], capabilities, fallback).steps[0]?.kind)
        .toBe('text-fallback')
    }
    expect(getter).not.toHaveBeenCalled()

    const hostileArray = new Proxy([addText()], {
      getOwnPropertyDescriptor: () => { throw new Error('HOSTILE_ARRAY') },
    })
    expect(() => buildHostVisualPresentation(hostileArray, capabilities, fallback)).not.toThrow()
    expect(buildHostVisualPresentation(hostileArray, capabilities, fallback).steps[0]?.kind)
      .toBe('text-fallback')
  })

  it('bounds pathological visuals and command counts without throwing', () => {
    const commands = [
      { ...base('draw-fraction'), numerator: 1, denominator: 1_000_000, label: 'Huge', representation: 'bar' },
      { ...base('draw-number-line'), min: 0, max: Infinity, step: NaN, highlightedValues: [] },
      ...Array.from({ length: 100 }, (_, index) => ({
        ...addText(String(index)), id: `text-${index}`,
      })),
    ]
    const result = buildHostVisualPresentation(commands, capabilities, fallback)
    expect(result.steps).toHaveLength(80)
    expect(result.steps[0].kind).toBe('text-fallback')
    expect(result.steps[1].kind).toBe('text-fallback')
  })

  it.each([true, false])(
    'keeps polite and assertive announcements when visualsAvailable=%s without duplication',
    (visualsAvailable) => {
      const result = buildHostVisualPresentation(
        [addText('Visual step'), announce('polite', 'POLITE_TOKEN'), announce('assertive', 'ASSERTIVE_TOKEN')],
        { visualsAvailable, voiceAvailable: true },
        fallback,
      )
      expect(result.announcements).toEqual([
        { text: 'POLITE_TOKEN', assertive: false },
        { text: 'ASSERTIVE_TOKEN', assertive: true },
      ])
      if (!visualsAvailable) expect(result.steps).toHaveLength(1)

      const html = renderToStaticMarkup(
        <AdaptiveTutorResponseView
          response={response({ boardCommands: [
            addText('Visual step'),
            announce('polite', 'POLITE_TOKEN'),
            announce('assertive', 'ASSERTIVE_TOKEN'),
          ] })}
          capabilities={{ visualsAvailable, voiceAvailable: true }}
          mediaFallback={fallback}
        />,
      )
      expect((html.match(/POLITE_TOKEN/g) ?? [])).toHaveLength(1)
      expect((html.match(/ASSERTIVE_TOKEN/g) ?? [])).toHaveLength(1)
      expect(html).toContain('role="status" aria-live="polite"')
      expect(html).toContain('role="alert" aria-live="assertive"')
    },
  )

  it.each([true, false])(
    'fails malformed announcements closed when visualsAvailable=%s',
    (visualsAvailable) => {
      const malformed = [
        { ...base('aria-announce'), priority: 'polite' },
        { ...base('aria-announce'), text: 'Missing priority' },
        { ...base('aria-announce'), text: 'Bad priority', priority: 'urgent' },
        { ...base('aria-announce'), text: 'X'.repeat(801), priority: 'assertive' },
      ]
      const result = buildHostVisualPresentation(
        malformed,
        { visualsAvailable, voiceAvailable: true },
        fallback,
      )
      expect(result.announcements).toEqual([])
      expect(result.steps.every((step) => step.kind === 'text-fallback')).toBe(true)
    },
  )

  it('keeps transcript and bounded media text when visual and voice media are unavailable', () => {
    const html = renderToStaticMarkup(
      <AdaptiveTutorResponseView
        response={response({
          boardCommands: [addText('Visual')],
          spokenTurn: { text: 'TRANSCRIPT_REMAINS', fallbackText: 'F'.repeat(2_500) },
        })}
        capabilities={{ visualsAvailable: false, voiceAvailable: false }}
        mediaFallback={{ ...fallback, missingAudioText: '' }}
      />,
    )
    expect(html).toContain('Use the displayed visual description.')
    expect(html).toContain('TRANSCRIPT_REMAINS')
    expect(html).toContain('role="status"')
    expect(html).not.toContain('F'.repeat(1_201))
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
          { ...addText('FIRST_VISIBLE'), id: 'first-text' },
          { ...addText('SECOND_HIDDEN'), id: 'second-text' },
        ] })}
        capabilities={capabilities}
        mediaFallback={fallback}
      />,
    )
    expect(html).toContain('FIRST_VISIBLE')
    expect(html).not.toContain('SECOND_HIDDEN')
    expect(html).toContain('<button type="button"')
    expect(html).toContain('aria-label="Visual teaching steps"')
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
