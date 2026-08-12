import type { FamilyPilotStudySnapshot } from '../study'

/**
 * UI status for the player, supplied by the host. It is intentionally not
 * derived from FamilyPilotStudyResult/-ActionResult here: the host already
 * has to interpret those unions to drive its own data flow, and duplicating
 * that interpretation inside a display component would be a second place a
 * status mapping could drift out of sync with the runtime.
 */
export type FamilyPilotLessonPlayerStatus = 'loading' | 'active' | 'paused' | 'completed' | 'error'

export interface FamilyPilotLessonPlayerChoice {
  readonly id: string
  readonly label: string
}

/**
 * Optional instructional content for the current segment. The Study runtime's
 * own snapshot carries only opaque references and no lesson content by design
 * (see FamilyPilotStudySnapshot), so this is assembled by the host from
 * wherever lesson content actually lives. Every field is optional: the player
 * renders sensibly with none of them present.
 */
export interface FamilyPilotLessonSegmentContent {
  /** The current segment's own display title (distinct from the lesson title on the snapshot). */
  readonly title?: string
  readonly instruction?: string
  readonly prompt?: string
  readonly example?: string
  /** Defaults to 'text' when omitted. */
  readonly responseKind?: 'text' | 'choice' | 'none'
  readonly choices?: readonly FamilyPilotLessonPlayerChoice[]
}

export interface FamilyPilotLessonPlayerProps {
  readonly status: FamilyPilotLessonPlayerStatus
  readonly snapshot: FamilyPilotStudySnapshot | null
  readonly segmentContent?: FamilyPilotLessonSegmentContent
  readonly errorMessage?: string | null
  /** Supplied by the host; not derived from the snapshot. */
  readonly tutorHelpAvailable?: boolean
  /** True while a host action triggered by a callback below is in flight. */
  readonly busy?: boolean
  /** A typed or structured learner response. Never persisted by this component. */
  readonly onSubmitAction: (responseText: string) => void
  readonly onPause: () => void
  readonly onResume: () => void
  /** Advances past a segment that needs no learner response. */
  readonly onNext: () => void
  readonly onCompleteSegment: () => void
  readonly onOpenTutor: () => void
  readonly onExit: () => void
}
