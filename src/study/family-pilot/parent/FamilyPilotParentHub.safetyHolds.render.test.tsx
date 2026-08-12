import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createLocalDevelopmentStudyPorts } from '../../localDevelopmentPorts'
import { FamilyPilotParentHub } from './FamilyPilotParentHub'
import type { FamilyPilotLearnerOption, FamilyPilotSafetyHoldsView } from './types'

// FamilyPilotParentHub is stateful (learner/calendar/reviews/settings/holds all
// load via useEffect on mount), which renderToStaticMarkup never runs — so
// these checks are scoped to what a first, pre-effect render legitimately
// proves: whether the safety-hold section mounts at all, and its empty-state
// copy. The resolve workflow's actual correctness (create -> block -> resolve
// -> unblock, cross-student/session isolation, fail-closed) is proven at the
// bridge/controller level in safetyHolds.test.ts and
// safetyIntegration.controller.test.ts, which do not depend on a DOM.

const learner: FamilyPilotLearnerOption = { hostProfileRef: 'host:a', learnerRef: 'learner:a', displayName: 'Ada' }
const ports = createLocalDevelopmentStudyPorts().ports
const authorization = { householdRef: 'household:test', actorRef: 'family-pilot-parent', role: 'parent' as const, adultAuthorized: true }

function render(safetyHolds?: FamilyPilotSafetyHoldsView): string {
  return renderToStaticMarkup(
    <FamilyPilotParentHub
      householdRef="household:test"
      learners={[learner]}
      ports={ports}
      authorization={authorization}
      readSafetyLedger={() => ({ records: [], historyState: 'available' })}
      safetyHolds={safetyHolds}
    />,
  )
}

describe('FamilyPilotParentHub — Family Pilot safety-hold section', () => {
  it('renders nothing when no safety-hold bridge is wired, identical to before this integration', () => {
    const html = render(undefined)
    expect(html).not.toContain('family-pilot-safety-holds')
    expect(html).not.toContain('Resolve and let them resume')
  })

  it('mounts the section with empty-state copy when a bridge is wired and reports no holds', () => {
    const html = render({ openHoldsFor: () => [], resolveHold: () => ({ ok: true, message: 'ok' }) })
    expect(html).toContain('Family Pilot pause for review')
    expect(html).toContain('Nothing is paused for Ada right now.')
    // No resolve button without an actual open hold to attach it to.
    expect(html).not.toContain('Resolve and let them resume')
  })
})
