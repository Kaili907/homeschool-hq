import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { defaultAppState } from '../../migration'
import { DEFAULT_CORE_DAY, MAX_SCHEDULE_EXTENSIONS } from '../../schedule/coreDay'
import type { ScheduleExtension } from '../../types'
import { ScheduleView } from './ScheduleView'

// 2026-08-04 is a Tuesday; matches ScheduleView.test.tsx conventions.
const TODAY = '2026-08-04'

/** S1 UI — at the sync-layer cap, Add is disabled and the reason is visible. */
const renderWithCount = (count: number) => {
  const state = defaultAppState()
  state.profiles.p1 = {
    ...state.profiles.p1,
    scheduleExtensions: Array.from(
      { length: count },
      (_, i): ScheduleExtension => ({
        id: `sx-${i}`,
        label: 'x',
        days: ['Mon'],
        start: '09:00',
        end: '09:30',
      }),
    ),
  }
  return renderToStaticMarkup(
    <ScheduleView
      profiles={Object.values(state.profiles)}
      today={TODAY}
      config={DEFAULT_CORE_DAY}
      onConfigChange={() => {}}
      onPatchProfile={() => {}}
    />,
  )
}

describe('ScheduleView at the extension cap', () => {
  it('disables Add and shows a visible reason at the cap', () => {
    const html = renderWithCount(MAX_SCHEDULE_EXTENSIONS)
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Add block<\/button>/)
    expect(html).toContain('Block limit reached')
  })

  it('shows no cap notice below the cap', () => {
    const html = renderWithCount(1)
    expect(html).not.toContain('Block limit reached')
  })
})
