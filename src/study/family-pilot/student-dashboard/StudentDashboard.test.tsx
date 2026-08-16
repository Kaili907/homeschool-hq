import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { JarvisDashboard } from './JarvisDashboard'
import { StudentDashboard } from './StudentDashboard'
import { STUDENT_DASHBOARD_FIXTURE_STATES, studentDashboardFixture } from './fixtures'
import type { StudentDashboardProps } from './types'

const noop = () => undefined
const callbacks: Pick<StudentDashboardProps, 'onOpenWork' | 'onOpenCourse' | 'onOpenSchedule' | 'onOpenTool' | 'onSignOut'> = {
  onOpenWork: noop,
  onOpenCourse: noop,
  onOpenSchedule: noop,
  onOpenTool: noop,
  onSignOut: noop,
}

function renderDashboard(state: Parameters<typeof studentDashboardFixture>[0] = 'lesson-ready'): string {
  return renderToStaticMarkup(<StudentDashboard model={studentDashboardFixture(state)} {...callbacks} />)
}

describe('StudentDashboard presentation', () => {
  it.each(STUDENT_DASHBOARD_FIXTURE_STATES)('renders the injected %s state honestly', (state) => {
    const fixture = studentDashboardFixture(state)
    const markup = renderDashboard(state)
    expect(markup).toContain(`data-mission-state="${state}"`)
    expect(markup).toContain(fixture.mission.title)
    expect(markup).toContain(fixture.mission.statusLabel)
    if (fixture.mission.description) expect(markup).toContain(fixture.mission.description)
  })

  it('keeps today primary and provides courses, upcoming, quick tools, and sign out', () => {
    const markup = renderDashboard()
    expect(markup).toContain('Skip to today')
    expect(markup).toContain('Today’s work')
    expect(markup).toContain('Your courses')
    expect(markup).toContain('Upcoming')
    expect(markup).toContain('Quick tools')
    expect(markup).toContain('Sign out')
    expect((markup.match(/<main\b/g) ?? [])).toHaveLength(1)
  })

  it('uses semantic buttons and complete accessible names for route intents', () => {
    const markup = renderDashboard()
    expect(markup).toContain('aria-label="Fractions in real-world situations, Mathematics · Grade 5, Ready"')
    expect(markup).toContain('aria-label="Open Mathematics, Working Grade 5, 50% complete"')
    expect(markup).toContain('aria-label="Mathematics progress"')
    expect(markup).not.toMatch(/<div[^>]+onclick=/i)
  })

  it('keeps an unavailable working-grade course card actionable instead of rendering dead UI', () => {
    const fixture = studentDashboardFixture('no-work')
    const model = { ...fixture, courses: fixture.courses.map((course) => ({ ...course, actionable: false })) }
    const markup = renderToStaticMarkup(<StudentDashboard model={model} {...callbacks} />)
    expect(markup).toContain('<button type="button" aria-label="Open')
    expect(markup).not.toContain('family-dashboard__course-card--unavailable')
  })

  it('does not synthesize empty-state explanations when none are provided', () => {
    const fixture = studentDashboardFixture('no-work')
    const model = { ...fixture, mission: { ...fixture.mission, description: undefined }, todayEmptyLabel: undefined }
    const markup = renderToStaticMarkup(<StudentDashboard model={model} {...callbacks} />)
    expect(markup).toContain('No work scheduled today')
    expect(markup).not.toContain('No assignments were supplied for today.')
    expect(markup).not.toContain('No work items were supplied for today.')
  })

  it('exposes the authoritative day state and factual required-item count without a percentage', () => {
    const fixture = studentDashboardFixture('day-complete')
    const model = {
      ...fixture,
      progressLabel: '2 of 2 required items complete today',
      dayStatus: {
        state: 'complete' as const, requiredCount: 2, completedCount: 2, remainingCount: 0,
        waitingOnParentCount: 0, carryForwardCount: 0, assessmentCount: 1,
      },
    }
    const markup = renderToStaticMarkup(<StudentDashboard model={model} {...callbacks} />)
    expect(markup).toContain('data-day-state="complete"')
    expect(markup).toContain('2 items')
    expect(markup).toContain('aria-describedby="family-dashboard-mission-status family-dashboard-mission-description"')
    expect(markup).not.toContain('2%')
  })
})

describe('JarvisDashboard presentation boundary', () => {
  it('defaults to an honest visual-only state with no Tutor callback', () => {
    const markup = renderDashboard()
    expect(markup).toContain('Visual only')
    expect(markup).toContain('Tutor is not connected in this release.')
    expect(markup).toContain('data-jarvis-mode="visual-only"')
    expect(markup).not.toMatch(/\b(?:microphone|transcript|chat input|send message)\b/i)
  })

  it('renders all visual layers inside one decorative core', () => {
    const markup = renderToStaticMarkup(<JarvisDashboard mode="visual-only" status="Display only." />)
    for (const layer of ['halo', 'outer-detail', 'secondary-orbit', 'primary-ring', 'nucleus', 'monogram']) {
      expect(markup).toContain(`family-dashboard__jarvis-${layer}`)
    }
    expect(markup).toContain('class="family-dashboard__jarvis-core" aria-hidden="true"')
  })

  it('accepts only the narrow future activation callback', () => {
    const onActivate = vi.fn()
    const element = <JarvisDashboard mode="tutor-v2" status="Host callback supplied." onActivate={onActivate} />
    expect(element.props).toEqual({ mode: 'tutor-v2', status: 'Host callback supplied.', onActivate })
  })
})

describe('dashboard CSS and import boundaries', () => {
  const directory = fileURLToPath(new URL('.', import.meta.url))
  const css = readFileSync(`${directory}/studentDashboard.css`, 'utf8')
  const sourceFiles = ['StudentDashboard.tsx', 'JarvisDashboard.tsx', 'types.ts', 'fixtures.ts', 'index.ts']
    .map((name) => readFileSync(`${directory}/${name}`, 'utf8'))
    .join('\n')

  it('limits animation to no-preference and disables every Jarvis tier for reduced motion', () => {
    const noPreferenceStart = css.indexOf('@media (prefers-reduced-motion: no-preference)')
    const reducedStart = css.indexOf('@media (prefers-reduced-motion: reduce)')
    const forcedColorsStart = css.indexOf('@media (forced-colors: active)')
    expect(noPreferenceStart).toBeGreaterThan(-1)
    expect(reducedStart).toBeGreaterThan(noPreferenceStart)
    const reduced = css.slice(reducedStart, forcedColorsStart)
    for (const layer of ['halo', 'outer-detail', 'secondary-orbit', 'primary-ring', 'nucleus', 'monogram']) {
      expect(reduced).toContain(`.family-dashboard__jarvis-${layer}`)
    }
    expect(reduced).toContain('animation: none')
  })

  it('contains explicit phone, tablet, and laptop breakpoints without a WebGL dependency', () => {
    expect(css).toContain('@media (max-width: 1050px)')
    expect(css).toContain('@media (max-width: 840px)')
    expect(css).toContain('@media (max-width: 540px)')
    expect(sourceFiles).not.toMatch(/\b(?:canvas|WebGL|three(?:\.js)?|lottie)\b/i)
  })

  it('has a presentation-only local dependency graph', () => {
    const imports = [...sourceFiles.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1])
    expect(imports.every((specifier) => specifier === 'react' || specifier.startsWith('./'))).toBe(true)
    expect(sourceFiles).not.toMatch(/legacy|profile.?sync|scor(?:e|ing)|transcript|curriculum|adult.?answer|fetch\s*\(|XMLHttpRequest|WebSocket/i)
  })
})
