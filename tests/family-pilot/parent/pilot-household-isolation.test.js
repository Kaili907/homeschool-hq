import { describe, expect, it } from 'vitest'
import { createLocalDevelopmentStudyPorts } from '../../../src/study/localDevelopmentPorts'
import { StudyParentController } from '../../../src/study/parentController'
import { createSyntheticMathBlock } from '../../../src/study/testing/syntheticStudyFixtures'

// PILOT ACCEPTANCE: "not accidentally act on another household/learner."
//
// The pilot supervised adult is authorized for exactly one household. This
// smoke test pins the guard the pilot depends on: a verified adult for
// household A can act on their own pilot learner, but the same authorization
// is refused for a second household/learner pair even when the command shape
// is identical. Coverage for the underlying rule already lives in
// src/study/parentController.test.ts; this test exists only to state the
// pilot-facing consequence in pilot terms and catch a regression that would
// let a supervised adult reach across households.
describe('pilot parent cannot act outside their own household', () => {
  it('accepts a command scoped to the pilot household/learner, refuses the same command for another household', async () => {
    const { ports } = createLocalDevelopmentStudyPorts()
    const controller = new StudyParentController(ports)

    const { scope: pilotScope } = await createSyntheticMathBlock(ports, { suffix: 'pilot-household' })
    const pilotAuthorization = {
      householdRef: pilotScope.householdRef,
      actorRef: 'adult:pilot-guardian',
      role: 'parent',
      adultAuthorized: true,
    }

    // The pilot adult, acting on their own learner: allowed.
    await expect(
      controller.execute(pilotScope, pilotAuthorization, { type: 'hide-timer', hidden: true }),
    ).resolves.toMatchObject({ status: 'applied' })

    // The same verified pilot adult, pointed at a different household's
    // learner scope (e.g. a stale tab, a copy-pasted link, a second pilot
    // family sharing a device): refused before any state changes.
    const otherHouseholdScope = { householdRef: 'household:not-the-pilot-family', learnerRef: pilotScope.learnerRef }
    await expect(
      controller.execute(otherHouseholdScope, pilotAuthorization, { type: 'hide-timer', hidden: false }),
    ).rejects.toThrow(/authorization/i)

    // The refused attempt must not have mutated the pilot learner's own settings.
    const settingsAfter = await ports.parentSettings.read(pilotScope)
    expect(settingsAfter.timerHidden).toBe(true)
  })
})
