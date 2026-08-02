import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AiSafetyCenter } from '../../app/features/ai-safety-center/AiSafetyCenter.tsx'
import type {
  AiSafetyCenterProps,
  SafetyCenterData,
} from '../../app/features/ai-safety-center/contracts.ts'
import {
  demoParentViewer,
  demoSafetyCenterData,
  demoStudent,
  demoStudentViewer,
} from '../../app/features/ai-safety-center/fixtures.ts'

const acceptedAction: AiSafetyCenterProps['onAction'] = async () => ({
  status: 'accepted',
  message: 'Accepted for static-test rendering.',
})

const parentSections = [
  'overview',
  'history',
  'safety',
  'controls',
  'data',
] as const
const studentSections = ['overview', 'history', 'safety', 'help'] as const

function renderCenter(
  role: 'parent' | 'student',
  initialSection: AiSafetyCenterProps['initialSection'],
  data: SafetyCenterData = demoSafetyCenterData,
): string {
  return renderToStaticMarkup(
    <AiSafetyCenter
      viewer={role === 'parent' ? demoParentViewer : demoStudentViewer}
      student={demoStudent}
      data={data}
      onAction={acceptedAction}
      initialSection={initialSection}
      onClose={() => undefined}
    />,
  )
}

function attributeValues(markup: string, attribute: string): readonly string[] {
  const expression = new RegExp(`\\s${attribute}="([^"]+)"`, 'g')
  return [...markup.matchAll(expression)].map((match) => match[1] ?? '')
}

function assertSemanticReferences(markup: string): void {
  const ids = attributeValues(markup, 'id')
  expect(new Set(ids).size, 'rendered IDs must be unique').toBe(ids.length)
  const idSet = new Set(ids)

  for (const references of attributeValues(markup, 'aria-labelledby')) {
    for (const reference of references.split(/\s+/)) {
      expect(idSet.has(reference), `missing aria-labelledby target #${reference}`).toBe(
        true,
      )
    }
  }
  for (const target of attributeValues(markup, 'for')) {
    expect(idSet.has(target), `missing label target #${target}`).toBe(true)
  }
  for (const href of attributeValues(markup, 'href')) {
    if (href.startsWith('#')) {
      expect(idSet.has(href.slice(1)), `missing fragment target ${href}`).toBe(true)
    }
  }
}

function assertFormControlsAreNamed(markup: string): void {
  const labels = [
    ...markup.matchAll(/<label\b[^>]*>[\s\S]*?<\/label>/g),
  ].map((match) => match[0])
  const explicitLabelTargets = new Set(attributeValues(markup, 'for'))
  const controls = [
    ...markup.matchAll(/<(?:input|select|textarea)\b[^>]*>/g),
  ].map((match) => match[0])

  for (const control of controls) {
    const id = /\sid="([^"]+)"/.exec(control)?.[1]
    const nested = labels.some((label) => label.includes(control))
    const directlyNamed =
      /\saria-label="[^"]+"/.test(control) ||
      /\saria-labelledby="[^"]+"/.test(control)
    expect(
      directlyNamed || nested || (id !== undefined && explicitLabelTargets.has(id)),
      `unnamed form control: ${control}`,
    ).toBe(true)
  }
}

function assertButtonsDeclareType(markup: string): void {
  const buttons = [...markup.matchAll(/<button\b[^>]*>/g)].map(
    (match) => match[0],
  )
  expect(buttons.length).toBeGreaterThan(0)
  for (const button of buttons) {
    expect(button, `button must declare type: ${button}`).toMatch(
      /\stype="(?:button|submit|reset)"/,
    )
  }
}

function luminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    )
  if (!channels || channels.length !== 3) {
    throw new TypeError(`Expected six-digit hex color, received ${hex}.`)
  }
  return (
    0.2126 * channels[0]! +
    0.7152 * channels[1]! +
    0.0722 * channels[2]!
  )
}

function contrast(foreground: string, background: string): number {
  const first = luminance(foreground)
  const second = luminance(background)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

function cssToken(css: string, token: string): string {
  const value = new RegExp(
    `--${token}:\\s*(#[0-9A-Fa-f]{6})\\s*;`,
  ).exec(css)?.[1]
  if (!value) throw new Error(`CSS token --${token} was not found.`)
  return value
}

describe('AI Safety Center static semantics', () => {
  it.each(parentSections)(
    'renders the parent %s screen with resolved names, labels, and button types',
    (section) => {
      const markup = renderCenter('parent', section)
      assertSemanticReferences(markup)
      assertFormControlsAreNamed(markup)
      assertButtonsDeclareType(markup)
      expect(markup).toContain('<main')
      expect(markup).toContain('id="masc-main"')
      expect(markup).toContain('tabindex="-1"')
      expect(markup).toContain('href="#masc-main"')
      expect(markup).toContain(
        'aria-label="AI safety center sections"',
      )
      expect(markup).toContain('aria-current="page"')
    },
  )

  it.each(studentSections)(
    'renders the student %s screen with resolved names, labels, and button types',
    (section) => {
      const markup = renderCenter('student', section)
      assertSemanticReferences(markup)
      assertFormControlsAreNamed(markup)
      assertButtonsDeclareType(markup)
      expect(markup).toContain('<main')
      expect(markup).toContain('id="masc-main"')
      expect(markup).toContain('aria-current="page"')
    },
  )

  it('keeps role-specific parent and student controls out of the other view', () => {
    const studentRequestingParentData = renderCenter('student', 'data')
    expect(studentRequestingParentData).toContain('Your tutor, your controls')
    expect(studentRequestingParentData).not.toContain('Request deletion')
    expect(studentRequestingParentData).not.toContain('Save permissions')

    const parentRequestingStudentHelp = renderCenter('parent', 'help')
    expect(parentRequestingStudentHelp).toContain('AI safety overview')
    expect(parentRequestingStudentHelp).not.toContain('Pause tutor now')
    expect(parentRequestingStudentHelp).not.toContain('Send report')
  })

  it('communicates severity and status with visible text, not color alone', () => {
    const markup = renderCenter('parent', 'safety')
    expect(markup).toContain('data-severity="low">Low</span>')
    expect(markup).toContain('data-severity="moderate">Moderate</span>')
    expect(markup).toContain(
      'data-severity="critical">Urgent adult check-in</span>',
    )
    expect(markup).toContain('Why the answer was withheld')
    expect(markup).toContain('Classification details')
  })

  it('exposes student report and pause controls without requiring a narrative', () => {
    const markup = renderCenter('student', 'help')
    expect(markup).toContain('Report or pause the tutor')
    expect(markup).toContain('You do not have to write an explanation')
    expect(markup).toContain('Anything else? (optional)')
    expect(markup).toContain('You can leave this blank.')
    expect(markup).toContain('Pause tutor now')
    expect(markup).toContain(
      'A parent or reviewer may read the report so they can help.',
    )
  })

  it('states the parent-review and safety-exception boundary in both views', () => {
    const parent = renderCenter('parent', 'safety')
    const student = renderCenter('student', 'safety')
    expect(parent).toContain(
      'Reflections entered inside a tutor conversation follow the same safety exception.',
    )
    expect(parent).toContain(
      'Separate mindset journal text is not collected or reviewed by this safety center.',
    )
    expect(student).toContain(
      'Your parent can review tutor conversations and safety events.',
    )
    expect(student).toContain(
      'A reflection typed in a tutor conversation follows the same rule.',
    )
    expect(student).toContain(
      'Your separate mindset journal is not collected here.',
    )
  })

  it('keeps transcript excerpts out of parent notifications as a fixed safeguard', () => {
    const markup = renderCenter('parent', 'controls')
    expect(
      demoSafetyCenterData.permissions.notifications.includeTranscriptExcerpt,
    ).toBe(false)
    expect(markup).toContain('Transcript excerpts stay out of notifications')
    expect(markup).toContain('This safeguard cannot be turned off.')
    expect(markup).toContain('Always off')
    expect(markup).not.toContain('Include a short transcript excerpt')
  })
})

describe('missing history and safety copy', () => {
  it('renders unavailable history as unknown rather than empty', () => {
    const unavailable: SafetyCenterData = {
      ...demoSafetyCenterData,
      instructionalHistory: {
        status: 'unavailable',
        code: 'temporarily_unavailable',
        retryable: true,
      },
    }
    const markup = renderCenter('parent', 'history', unavailable)
    expect(markup).toContain('Tutor history is not available')
    expect(markup).toContain(
      'We cannot confirm whether records exist right now',
    )
    expect(markup).toContain('Safety controls remain available.')
    expect(markup).toContain('role="status"')
    expect(markup).not.toContain('No tutor conversations yet')
  })

  it('uses trusted-adult copy without invented numbers, audio players, or service claims', () => {
    const parent = renderCenter('parent', 'safety')
    const student = renderCenter('student', 'help')
    const markup = `${parent}\n${student}`
    expect(markup).toContain('A trusted adult should check in now')
    expect(markup).toContain('This safety center is not an emergency service.')
    expect(markup).toContain('This screen is not an emergency service.')
    expect(markup).not.toMatch(/\b(?:9-?1-?1|9-?8-?8|hotline)\b/i)
    expect(markup).not.toContain('<audio')
    expect(markup).not.toMatch(/\.(?:wav|mp3|m4a|ogg)(?:["?])/i)
  })

  it('keeps text available when playback is unavailable or unsupported', () => {
    if (demoSafetyCenterData.instructionalHistory.status !== 'ready') {
      throw new Error('Demo instructional history must be ready.')
    }
    const noPlayback: SafetyCenterData = {
      ...demoSafetyCenterData,
      instructionalHistory: {
        status: 'ready',
        items: demoSafetyCenterData.instructionalHistory.items.map(
          (session, index) =>
            index === 0 ? { ...session, playback: 'unavailable' as const } : session,
        ),
      },
    }
    const markup = renderCenter('parent', 'history', noPlayback)
    expect(markup).toContain('Equivalent fractions')
    expect(markup).toContain('Compared fractions')
    expect(markup).not.toContain('<audio')
    const historySource = readFileSync(
      new URL(
        '../../app/features/ai-safety-center/SafetyCenterHistory.tsx',
        import.meta.url,
      ),
      'utf8',
    )
    expect(historySource).toContain('Playback is not available.')
  })
})

describe('CSS accessibility safeguards', () => {
  const css = readFileSync(
    new URL(
      '../../app/features/ai-safety-center/ai-safety-center.css',
      import.meta.url,
    ),
    'utf8',
  )

  it('provides visible focus, skip-link, reduced-motion, and forced-color rules', () => {
    expect(css).toContain(':focus-visible')
    expect(css).toMatch(/outline:\s*3px\s+solid/i)
    expect(css).toContain('.masc-skip-link:focus')
    expect(css).toMatch(
      /\.masc-main:focus\s*\{[^}]*outline:\s*3px\s+solid\s+#f5b82e;[^}]*outline-offset:\s*3px;/i,
    )
    expect(css).not.toMatch(/\.masc-main:focus\s*\{[^}]*outline:\s*none/i)
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('animation-duration: 0.01ms !important')
    expect(css).toContain('@media (forced-colors: active)')
    expect(css).toContain('border: 1px solid ButtonText')
  })

  it('keeps the smallest common interactive height at least 44 CSS pixels', () => {
    expect(css).toMatch(/\.masc-nav button[\s\S]*?min-height:\s*2\.75rem/)
    expect(css).toMatch(/\.masc-button[\s\S]*?min-height:\s*2\.75rem/)
    expect(css).toMatch(
      /\.masc-field input,\s*\.masc-field select,\s*\.masc-field textarea\s*\{[^}]*min-height:\s*2\.75rem/,
    )
  })

  it('keeps normal muted text at WCAG AA contrast on tinted surfaces', () => {
    const muted = cssToken(css, 'masc-muted')
    const backgrounds = [
      cssToken(css, 'masc-surface'),
      cssToken(css, 'masc-surface-soft'),
      cssToken(css, 'masc-canvas'),
      '#edf1f6',
    ]
    for (const background of backgrounds) {
      expect(
        contrast(muted, background),
        `${muted} on ${background}`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('includes responsive layouts without hiding safety controls', () => {
    expect(css).toContain('@media (max-width: 62rem)')
    expect(css).toContain('@media (max-width: 44rem)')
    expect(css).toContain('@media (max-width: 27rem)')
    expect(css).not.toMatch(
      /@media\s*\(max-width:[^)]+\)[\s\S]*?\.masc-student-tools-grid\s*\{[^}]*display:\s*none/,
    )
  })
})
