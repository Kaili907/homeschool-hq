import { useMemo } from 'react'
import type { HostStudyLifecycleSeam } from '../../study/composition/hostStudyLifecycle'
import type { StudyPortBundle } from '../../study/ports'
import type { StudyTutorRuntime } from '../../study/contracts/tutor'
import type { HostStudyLaunchContext, StudyCalendarEntry } from '../../study/types'
import { createProductionStudyTutorSeam } from './productionTutorSeam'
import { StudySessionSurface } from './studySessionSurface'

/**
 * STUDY-A1-PRODUCTION-SAFE-CONTAINER — the production-safe Study container.
 *
 * Same session, same body, same rules. The difference from
 * ./StudySessionContainer.tsx is one prop and one import list:
 *
 *   `tutorRuntime` is REQUIRED. There is no fallback, because the only fallback
 *   that exists is the preview facade, and reaching it is precisely what makes a
 *   container unshippable. A production host without a Tutor does not render a
 *   degraded Study session; it does not render this.
 *
 *   Nothing reachable from here is preview-bound. The measured contamination was
 *   ONE edge — `src/study/runtimeFacade.ts` at the old container's line 8 — whose
 *   90-file closure carries the release-candidate learner sentinel, the
 *   `LOCAL DEVELOPMENT ONLY` marker and the frozen Tutor content. That import is
 *   in the preview container and only there.
 *
 * The claim in the paragraph above is not made by reading this file's imports.
 * ./productionContainerImportClosure.test.ts starts here, follows every static
 * and dynamic edge it can see, reports every edge it CANNOT see, and holds the
 * whole reachable set to a pinned size — so a preview module arriving three
 * imports down is a test failure rather than a bundle nobody measured again.
 *
 * PRODUCTION_ROUTE_NOT_MOUNTED. This card mounts nothing: App.tsx is untouched,
 * StudySessionRoute still renders the preview container behind the DEV gate, and
 * no feature flag changed. The only callers are tests.
 */
export function ProductionStudySessionContainer({
  context,
  initialEntry,
  ports,
  studyLifecycle,
  tutorRuntime,
  onBack,
}: {
  context: HostStudyLaunchContext
  initialEntry: StudyCalendarEntry
  ports: Partial<StudyPortBundle>
  studyLifecycle: HostStudyLifecycleSeam
  /** Required. See the note above on why there is no optional form. */
  tutorRuntime: StudyTutorRuntime
  onBack: () => void
}) {
  // Memoised on the runtime, for the same reason the preview container memoises
  // on its ports: the seam is an effect dependency of the shared surface.
  const tutorSeam = useMemo(() => createProductionStudyTutorSeam(tutorRuntime), [tutorRuntime])
  return (
    <StudySessionSurface
      context={context}
      initialEntry={initialEntry}
      ports={ports}
      studyLifecycle={studyLifecycle}
      tutorSeam={tutorSeam}
      onBack={onBack}
    />
  )
}
