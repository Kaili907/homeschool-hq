import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StudyEngineApp } from './StudyEngineApp'

describe('StudyEngineApp mount boundary', () => {
  it('renders an accessible, subject-neutral unavailable state for the active learner', () => {
    const html = renderToStaticMarkup(
      <StudyEngineApp learner={{ id: 'learner-1', displayName: 'Sam' }} onExit={() => {}} />,
    )

    expect(html).toContain('<main')
    expect(html).toContain('<h1')
    expect(html).toContain('tabindex="-1"')
    expect(html).toContain('Learning activities are not available yet')
    expect(html).toContain('Sam, this space is ready')
    expect(html).toContain('Back to home')
    expect(html).not.toMatch(/English|Math|Tutor Core|session|review/i)
  })
})
