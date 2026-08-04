import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { defaultAppState } from '../../migration'
import { addExtension, DEFAULT_CORE_DAY } from '../../schedule/coreDay'
import { ScheduleView } from './ScheduleView'

// 2026-08-04 is a Tuesday; its week's Monday is 2026-08-03.
const TODAY = '2026-08-04'

const render = (mutate?: (profiles: ReturnType<typeof defaultAppState>['profiles']) => void) => {
  const state = defaultAppState()
  mutate?.(state.profiles)
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

describe('ScheduleView', () => {
  it('shows every girl and the full Mon–Fri Core Day', () => {
    const html = render()
    for (const name of ['3rd Grader', '4th Grader', '6th Grader', 'Sophomore', 'Senior']) {
      expect(html).toContain(name)
    }
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) expect(html).toContain(`>${day}</span>`)
    for (const label of ['Math', 'Reading', 'Break / movement', 'Shared read-aloud']) {
      expect(html).toContain(label)
    }
    expect(html).toContain('Writing')
    expect(html).toContain('Spelling')
    expect(html).toContain('Science')
    expect(html).toContain('Social Studies')
    expect(html).toContain('Flex:')
  })

  it('offers the editable Writing/Spelling alternation control', () => {
    const html = render()
    expect(html).toContain('Writing days')
    expect(html).toContain('Mon/Wed')
    expect(html).toContain('Tue/Thu')
    expect(html).toContain('(Spelling takes the other pair)')
  })

  it('shows the empty extension state by default', () => {
    expect(render()).toContain('No extra blocks yet.')
  })

  it('lists the selected girl’s extension blocks with a remove control', () => {
    const html = render((profiles) => {
      profiles.p1 = addExtension(profiles.p1, {
        label: 'Algebra practice',
        days: ['Mon', 'Wed'],
        start: '13:00',
        end: '13:30',
      })
    })
    expect(html).toContain('Algebra practice')
    expect(html).toContain('remove Algebra practice')
    expect(html).toContain('13:00–13:30')
  })
})
