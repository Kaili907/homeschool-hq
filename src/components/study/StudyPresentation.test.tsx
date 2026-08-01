import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StudyDashboard } from './StudyDashboard'
import { StudySettings } from './StudySettings'
import { StudySessionRoute } from './StudySessionRoute'
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
    expect(html).not.toMatch(/rawAnswer|transcriptText|providerApiKey/i)
  })
})
