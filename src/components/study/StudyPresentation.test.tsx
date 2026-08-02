import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { StudyDashboard } from './StudyDashboard'
import { StudySettings } from './StudySettings'
import { StudySessionRoute } from './StudySessionRoute'
import { studyAccessibilityProjection } from './StudySessionContainer'
import { createLocalDevelopmentStudyPorts } from '../../study/localDevelopmentPorts'
import { syntheticGrade5StudyContext } from '../../study/demonstrations'

describe('Study host accessibility presentation', () => {
  const context = syntheticGrade5StudyContext('math')
  const { ports } = createLocalDevelopmentStudyPorts()

  it('provides a skip target, main landmark, loading status, and 44px host controls', () => {
    const html = renderToStaticMarkup(
      <StudyDashboard context={context} ports={ports} onLaunch={() => {}} onSettings={() => {}} onBack={() => {}} />,
    )
    expect(html).toContain('href="#study-plan"')
    expect(html).toContain('<main')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('Preparing your Study plan')
    expect(html).toContain('study-runtime-host')
  })

  it('renders all learner accessibility preferences with native labeled controls', () => {
    const html = renderToStaticMarkup(<StudySettings context={context} ports={ports} onBack={() => {}} />)
    for (const label of ['Large text', 'Reduced motion', 'No audio', 'Captions', 'Transient Jarvis transcript', 'High contrast', 'One task at a time', 'Hide the countdown timer']) {
      expect(html).toContain(label)
    }
    expect(html.match(/type="checkbox"/g)?.length).toBe(8)
  })

  it('fails into a cancellable learner-bound loading state without exposing raw data', () => {
    const html = renderToStaticMarkup(
      <StudySessionRoute context={context} ports={ports} blockRef="block:synthetic" learnerRef={context.learnerRef} onBack={() => {}} />,
    )
    expect(html).toContain('Loading Study Session')
    expect(html).toContain('Cancel')
    expect(html).toContain('tabindex="-1"')
    expect(html).toContain('type="button"')
    expect(html).not.toMatch(/rawAnswer|transcriptText|providerApiKey/i)
  })

  it('keeps captions visible while projecting reduced motion and no-audio mode', () => {
    expect(studyAccessibilityProjection({
      ...context.accessibility,
      reducedMotion: true,
      noAudio: true,
      captions: false,
    })).toEqual({
      motionMode: 'none',
      voiceMode: 'no-audio',
      captionsAlwaysVisible: true,
    })
  })

  it('honors OS reduced motion and constrains interactive controls on narrow screens', () => {
    const studyHostCss = readFileSync(new URL('./study-host.css', import.meta.url), 'utf8')
    expect(studyHostCss).toContain('@media (prefers-reduced-motion: reduce)')
    expect(studyHostCss).toContain('animation-duration: 0.001ms !important')
    expect(studyHostCss).toContain('min-height: 44px')
    expect(studyHostCss).toContain('max-inline-size: 100%')
    expect(studyHostCss).toContain('touch-action: manipulation')
  })
})
