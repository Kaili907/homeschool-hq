import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { defaultAppState } from '../../migration'
import { ParentHub } from './ParentHub'

describe('Parent Hub Study feature gate', () => {
  it('preserves the legacy four tabs when disabled', () => {
    const html = renderToStaticMarkup(
      <ParentHub state={defaultAppState()} onStateChange={() => {}} onClose={() => {}} onOpenClassic={() => {}} />,
    )
    expect(html).not.toContain('>Study</button>')
    for (const tab of ['Today', 'Calendar', 'Plans', 'Status']) expect(html).toContain(tab)
  })

  it('adds the Study tab only when explicitly enabled', () => {
    const html = renderToStaticMarkup(
      <ParentHub state={defaultAppState()} onStateChange={() => {}} onClose={() => {}} onOpenClassic={() => {}} studyEnabled />,
    )
    expect(html).toContain('>Study</button>')
  })
})
