import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { emptyProfile } from '../../migration'
import { loadPlans } from '../../curriculum/loader'
import { defaultSchoolYear } from '../../curriculum/pacing'
import { PlansView } from './PlansView'

function renderPlans(grade: '3' | '4' | '5' | '7' | '8'): string {
  return renderToStaticMarkup(
    <PlansView
      profiles={[emptyProfile('p1', 'Kid', grade)]}
      docs={loadPlans()}
      sy={defaultSchoolYear('2026-08-31')}
      today="2026-09-28"
      onPatchProfile={() => {}}
    />,
  )
}

describe('PlansView awaiting-scope affordance', () => {
  it.each(['3', '4'] as const)('renders core awaiting scope plus the real Japanese plan for grade %s', (grade) => {
    const html = renderPlans(grade)

    for (const label of ['Math', 'Reading &amp; Spelling', 'Writing']) expect(html).toContain(label)
    expect(html).toContain('Awaiting placement results')
    expect(html).toContain('scope arrives once her assessment is scored')
    expect(html).toContain('Japanese — Year 1')
    expect(html).toContain("Competitor&#x27;s Mind")
    expect(html).toContain('AI Literacy')
  })

  it.each(['5', '7', '8'] as const)('renders core awaiting scope and shared plans for grade %s', (grade) => {
    const html = renderPlans(grade)

    for (const label of ['Math', 'Reading &amp; Spelling', 'Writing', 'Japanese — Year 1']) expect(html).toContain(label)
    expect(html).toContain('Awaiting placement results')
    expect(html).toContain("Competitor&#x27;s Mind")
    expect(html).toContain('AI Literacy')
  })
})
