import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultAppState } from '../../migration'
import { ParentHub } from './ParentHub'

describe('Parent Hub Schedule tab', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('offers the Schedule tab alongside the legacy four', () => {
    const html = renderToStaticMarkup(
      <ParentHub state={defaultAppState()} onStateChange={() => {}} onClose={() => {}} onOpenClassic={() => {}} />,
    )
    for (const tab of ['Today', 'Calendar', 'Schedule', 'Plans', 'Status']) {
      expect(html).toContain(`>${tab}</button>`)
    }
  })

  it('keeps Schedule when the Academy tab is enabled for an imported grade', () => {
    vi.stubEnv('VITE_ACADEMY_GRADE_5_ENABLED', 'true')
    const state = defaultAppState()
    state.profiles.p2.grade = '5'
    const html = renderToStaticMarkup(
      <ParentHub state={state} onStateChange={() => {}} onClose={() => {}} onOpenClassic={() => {}} />,
    )
    expect(html).toContain('>Schedule</button>')
    expect(html).toContain('>Academy</button>')
  })
})
