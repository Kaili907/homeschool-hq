import { Suspense, lazy } from 'react'
import type { StudyPortBundle } from '../../ports'
import { FamilyPilotShell } from '../FamilyPilotShell'
import type { FamilyPilotStoreOptions } from '../core'
import type { FamilyPilotCurriculumPort } from './curriculum'
import type { FamilyPilotSafetyPort } from './safety'
import type { FamilyPilotCompletionPolicyPort } from '../completion/policy'

// FAMILY-PILOT-INTEGRATION: the routed pilot entry point.
//
// PRODUCTION BOUNDARY. This file must not import the pilot's Study path, even
// transitively. IntegratedPilotSurface pulls the Study runtime facade and the
// local Study ports, and src/study/production/providerBundleSecurity.test.ts
// fails the build if either reaches a production client bundle — the local
// ports' safety classifier returns a forced 'clear' outcome and must never
// ship. The development gate below is what keeps that chunk out, following the
// same shape App.tsx uses for its own Study preview routes.
//
// Family Pilot Core sits OUTSIDE that boundary: the shell, every learner
// record, and the household's saved progress load in any build. Only the Study
// surface is development-gated.
const IntegratedPilotSurface = import.meta.env.DEV
  ? lazy(() => import('./IntegratedPilotSurface').then((module) => ({
      default: module.IntegratedPilotSurface,
    })))
  : null

export interface FamilyPilotHostProps {
  readonly onExit: () => void
  readonly enabled?: boolean
  readonly ports?: StudyPortBundle
  readonly curriculum?: FamilyPilotCurriculumPort
  readonly store?: FamilyPilotStoreOptions
  /** Not installed in C1. The pilot is required to work without it. */
  readonly safety?: FamilyPilotSafetyPort
  /**
   * Which work needs a household adult's sign-off before it counts. Absent
   * means the curriculum port decides — a student-work package's own authored
   * `completionAuthority` is the intended source, and this prop is the seam for
   * a host that resolves it some other way.
   */
  readonly completionPolicy?: FamilyPilotCompletionPolicyPort
  readonly now?: () => Date
  readonly householdTimeZone?: string
}

export function FamilyPilotHost({
  onExit,
  enabled,
  ports,
  curriculum,
  store,
  safety,
  completionPolicy,
  now,
  householdTimeZone,
}: FamilyPilotHostProps) {
  return (
    <FamilyPilotShell onExit={onExit} enabled={enabled} store={store}>
      {(context) => (IntegratedPilotSurface ? (
        <Suspense fallback={<p className="mt-6 font-semibold" role="status">Getting Study ready.</p>}>
          <IntegratedPilotSurface
            context={context}
            ports={ports}
            curriculum={curriculum}
            store={store}
            safety={safety}
            completionPolicy={completionPolicy}
            now={now}
            householdTimeZone={householdTimeZone}
          />
        </Suspense>
      ) : (
        <p
          className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-3 font-semibold"
          role="status"
          data-testid="family-pilot-study-unavailable"
        >
          Study is not available in this build. Learner records on this device are safe.
        </p>
      ))}
    </FamilyPilotShell>
  )
}
