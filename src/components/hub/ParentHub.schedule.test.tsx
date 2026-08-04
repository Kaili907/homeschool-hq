import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { defaultAppState } from '../../migration'
import { ParentHub } from './ParentHub'

describe('Parent Hub Schedule tab', () => {
  it('offers the Schedule tab alongside the legacy four', () => {
    const html = renderToStaticMarkup(
      <ParentHub state={defaultAppState()} onStateChange={() => {}} onClose={() => {}} onOpenClassic={() => {}} />,
    )
    for (const tab of ['Today', 'Calendar', 'Schedule', 'Plans', 'Status']) {
      expect(html).toContain(`>${tab}</button>`)
    }
  })
})
