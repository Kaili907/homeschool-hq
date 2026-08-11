import { useMemo } from 'react'
import type { HostStudyLifecycleSeam } from '../../study/composition/hostStudyLifecycle'
import type { StudyPortBundle } from '../../study/ports'
import { AcceptedRc1HostRuntime, type StudyTutorTurnResult } from '../../study/runtimeFacade'
import type { HostStudyLaunchContext, StudyCalendarEntry } from '../../study/types'
import {
  StudySessionSurface,
  type StudyHostTurnResult,
  type StudySessionTutorSeam,
} from './studySessionSurface'

/**
 * STUDY-A1-PRODUCTION-SAFE-CONTAINER — the PREVIEW Study container.
 *
 * The name is unchanged because App.tsx, StudySessionRoute and every preview
 * test already say it, and this card changes no mounted behaviour. What changed
 * is that the session body is no longer in this file: it is
 * ./studySessionSurface.tsx, which both containers render, so there is one
 * implementation of the launch ordering, the staleness checks, the safety-stop
 * mapping, the interruption mapping and the durable-write privacy footprint.
 *
 * This file is the preview HALF of the split, and it is the half that cannot
 * ship. `AcceptedRc1HostRuntime` below is the single measured reason: its import
 * closure is 90 files and carries the release-candidate learner sentinel, the
 * `LOCAL DEVELOPMENT ONLY` marker and the frozen Tutor content. Nothing about
 * that has been fixed here and nothing about it needs to be — the route that
 * mounts this is DEV-gated (App.tsx: `import.meta.env.DEV`) and production folds
 * it to null.
 *
 * A production host renders ./ProductionStudySessionContainer.tsx instead, which
 * requires an injected Tutor and reaches none of this.
 *
 * The preview-era exports below are re-exported so that the imports written
 * against this module keep resolving. They are surface constants and a
 * presentation component; they belong to the shared body and are defined there.
 */
export {
  STUDY_BUSY_RETRY_MESSAGE,
  STUDY_SESSION_UNAVAILABLE_MESSAGE,
  STUDY_TUTOR_OUTPUT_PENDING_MESSAGE,
  STUDY_UNAVAILABLE_RETRY_MESSAGE,
  StudyTutorSafetySurface,
  studyAccessibilityProjection,
} from './studySessionSurface'

/**
 * The preview facade's four-branch result, normalized to the host's one turn
 * shape.
 *
 * The facade and the production contract answer the same four questions with
 * two different shapes: the facade's accepted arm nests its prose under
 * `presentation`, and its stopped arm carries a `studentMessage` and a
 * `classification` the contract deliberately does not have.
 *
 * This is NOT the F4 crossing and must not be mistaken for one. F4 exists
 * because a production Tutor's result comes from out-of-process work the host
 * does not own; the facade's result is built in this process, by host code, in
 * a module this container already imports. There is nothing here for a parser
 * to establish that the type system has not already established.
 */
function previewTurnResult(result: StudyTutorTurnResult): StudyHostTurnResult {
  if (result.status === 'accepted') {
    return { status: 'accepted', eventRef: result.eventRef, visibleText: result.presentation.visibleText }
  }
  if (result.status === 'stopped') {
    return {
      status: 'stopped',
      reasonCode: result.reasonCode,
      deliveryStatus: result.deliveryStatus,
      studentMessage: result.studentMessage,
    }
  }
  if (result.status === 'interrupted') return { status: 'interrupted', interruption: result.interruption }
  return { status: 'quarantined' }
}

function createPreviewStudyTutorSeam(runtime: AcceptedRc1HostRuntime): StudySessionTutorSeam {
  return {
    launch: (binding) => runtime.launch(binding.context, binding.initialEntry, binding.sessionRef),
    submit: (binding, turn) => runtime.submit({
      context: binding.context,
      entry: binding.entry,
      scope: binding.scope,
      requestRef: turn.requestRef,
      segmentRef: turn.segmentRef,
      transientLearnerText: turn.transientLearnerText,
      expectedAnswer: 'ready',
      occurredAt: turn.occurredAt,
      isCurrentBinding: turn.isCurrentBinding,
    }).then(previewTurnResult),
  }
}

export function StudySessionContainer({ context, initialEntry, ports, studyLifecycle, onBack }: {
  context: HostStudyLaunchContext
  initialEntry: StudyCalendarEntry
  ports: Partial<StudyPortBundle>
  /**
   * STUDY-A1-COMP Phase 8 — the App's own Study lifecycle, the same object the
   * route received.
   */
  studyLifecycle: HostStudyLifecycleSeam
  onBack: () => void
}) {
  // Memoised on `ports`, exactly as the runtime it wraps always was: this is an
  // effect dependency of the shared surface, and a seam rebuilt on every render
  // would detach and re-attach the host surface on every render.
  const tutorSeam = useMemo(() => createPreviewStudyTutorSeam(new AcceptedRc1HostRuntime(ports)), [ports])
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
