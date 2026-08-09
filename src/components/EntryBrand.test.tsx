import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { defaultAppState } from '../migration'
import { learnerPresentationForProfile } from '../entry/learnerPresentation'
import { ADMIN_ENTRY_HANDOFF, Picker } from './Picker'
import { PinPad } from './PinPad'

describe('Manuel Academy branded learner entry', () => {
  it('renders the exact five approved learner cards and intentional portrait fallbacks', () => {
    const html = renderToStaticMarkup(
      <Picker state={defaultAppState()} onPick={() => {}} onGrownUps={() => {}} />,
    )

    expect(html).toContain('Manuel Academy')
    expect(html).toContain('Private Education. Purpose Driven.')
    expect(html.match(/class="academy-learner-card"/g)).toHaveLength(5)
    for (const [name, grade, initials] of [
      ['Kaili Manuel', '12th Grade', 'KM'],
      ['Arianna Manuel', '10th Grade', 'AM'],
      ['Stephanie Manuel', '7th Grade', 'SM'],
      ['Lucia Manuel', '4th Grade', 'LM'],
      ['Aly Manuel', '3rd Grade', 'AM'],
    ]) {
      expect(html).toContain(name)
      expect(html).toContain(grade)
      expect(html).toContain(`>${initials}<`)
    }
    expect(html).toContain('Parent Login')
    expect(html).toContain('Admin Login')
    expect(html).toContain('aria-disabled="true"')
    expect(html).toContain('Admin entry awaiting approved setup')
    expect(html).not.toMatch(/href="\/admin|action="\/admin/i)
    expect(html).not.toContain('first sign-in')
  })

  it('marks Admin Login as pending without inventing a route or authentication handoff', () => {
    expect(ADMIN_ENTRY_HANDOFF).toEqual({ status: 'awaiting-admin-workstream' })
    expect(Object.keys(ADMIN_ENTRY_HANDOFF)).toEqual(['status'])
  })

  it('keeps the matching learner identity on the PIN screen with accessible controls', () => {
    const html = renderToStaticMarkup(
      <PinPad
        title="Welcome back, Kaili"
        subtitle="Enter your PIN"
        learner={learnerPresentationForProfile('p5')}
        onComplete={() => null}
        onCancel={() => {}}
      />,
    )

    expect(html).toContain('Welcome back, Kaili')
    expect(html).toContain('12th Grade')
    expect(html).toContain('0 of 4 PIN digits entered')
    expect(html).toContain('aria-label="Digit 1"')
    expect(html).toContain('aria-label="Delete last digit"')
    expect(html).toContain('Back to learners')
    expect(html).not.toContain('Parent Login')
    expect(html).not.toContain('Admin Login')
    expect(html).not.toMatch(/fingerprint|biometric/i)
  })
})
