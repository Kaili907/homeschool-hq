import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createLocalDevelopmentStudyPorts } from '../../../src/study/localDevelopmentPorts'
import { createSyntheticMathBlock } from '../../../src/study/testing/syntheticStudyFixtures'
import { StudyParentPanel } from '../../../src/components/hub/StudyParentPanel'
import { StudyLocalSafetyStopsSurface } from '../../../src/components/hub/StudyLocalSafetyStopsPanel'

// PILOT ACCEPTANCE: "not need email/SMS."
//
// The pilot's core loop (see learner, see status, observe a safety hold) must
// not require the supervised adult to configure an email or phone contact
// channel first. This pins that neither Study panel used in the pilot asks
// for an email or phone number, and that the Study panel is explicit that its
// requests are local-only and not delivered anywhere — so there is nothing
// for the pilot adult to configure.
describe('pilot does not require an email/SMS contact channel', () => {
  it('renders the Study parent panel without any email or phone input', async () => {
    const { ports } = createLocalDevelopmentStudyPorts()
    const { scope } = await createSyntheticMathBlock(ports, { suffix: 'pilot-no-contact-channel' })
    const authorization = { householdRef: scope.householdRef, actorRef: 'adult:pilot-guardian', role: 'parent', adultAuthorized: true }

    const html = renderToStaticMarkup(createElement(StudyParentPanel, {
      householdRef: scope.householdRef,
      learners: [{ hostProfileRef: scope.learnerRef, learnerRef: scope.learnerRef, displayName: 'Pilot Learner' }],
      ports,
      authorization,
    }))

    expect(html).not.toMatch(/type="email"/)
    expect(html).not.toMatch(/type="tel"/)
    expect(html.toLowerCase()).not.toContain('phone number')
    expect(html.toLowerCase()).not.toContain('email address')
    expect(html).toContain('Adult review delivery is not enabled.')
  })

  it('renders the Safety panel without any email or phone input', () => {
    const html = renderToStaticMarkup(createElement(StudyLocalSafetyStopsSurface, { records: [] }))
    expect(html).not.toMatch(/type="email"/)
    expect(html).not.toMatch(/type="tel"/)
  })
})
