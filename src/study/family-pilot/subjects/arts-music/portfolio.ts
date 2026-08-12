/**
 * ARTS-MUSIC-1 — portfolio/project task representation for Arts & Music unit
 * capstones (units.json's `performance_task`, e.g. "Create an observation
 * portfolio showing purposeful use of visual elements.").
 *
 * BOUNDARIES (see the mission brief): a learner must never be required to
 * produce a voice recording, video, photograph, or public performance to
 * complete a portfolio task. Every presentation mode below is private by
 * construction — there is no "public" mode to opt into by mistake — and
 * every mode is completable with a plain written description, so a family
 * with no audio and no camera can always finish the task the same way as
 * any other family, not as a fallback.
 *
 * A submission stores only an opaque artifactRef, never raw content. This
 * mirrors the rest of Family Pilot (see core/schema.ts's
 * rawAnswerIncluded/transcriptIncluded: false invariant and
 * curriculumAdapter.ts's SAFE_REF): whatever the family used to represent
 * the work (a photo of a physical piece, a written file, nothing at all for
 * a live demonstration) lives outside this system. This module never
 * accepts or persists the work itself.
 */

export type ArtsMusicPresentationMode =
  | 'written-description'
  | 'private-demonstration'
  | 'private-discussion'
  | 'parent-facilitated-critique'

/** Every mode is private and requires no audio or camera capability — none
 * is a fallback; a family can pick any of these as their first choice. */
export const ARTS_MUSIC_PRESENTATION_MODES: readonly ArtsMusicPresentationMode[] = [
  'written-description',
  'private-demonstration',
  'private-discussion',
  'parent-facilitated-critique',
]

/** Always available: a typed or handwritten description, no recording of
 * any kind. The no-audio, no-camera path. */
export const DEFAULT_ARTS_MUSIC_PRESENTATION_MODE: ArtsMusicPresentationMode = 'written-description'

const ARTS_MUSIC_PRESENTATION_MODE_LABELS: Record<ArtsMusicPresentationMode, string> = {
  'written-description': 'Written or typed description',
  'private-demonstration': 'Shown live to a parent or teacher only, not recorded',
  'private-discussion': 'Explained live to a parent or teacher only, not recorded',
  'parent-facilitated-critique': 'A parent or teacher observes and notes completion against the rubric',
}

export function artsMusicPresentationModeLabel(mode: ArtsMusicPresentationMode): string {
  return ARTS_MUSIC_PRESENTATION_MODE_LABELS[mode]
}

export interface ArtsMusicPortfolioTask {
  readonly unitId: string
  readonly performanceTask: string
  readonly rubricDimensions: readonly string[]
}

export function portfolioTaskForUnit(
  unit: { readonly unitId: string; readonly performanceTask: string },
  rubricDimensions: readonly string[],
): ArtsMusicPortfolioTask {
  return { unitId: unit.unitId, performanceTask: unit.performanceTask, rubricDimensions }
}

/** Same opaque-reference contract src/study/curriculumAdapter.ts's SAFE_REF
 * enforces — a pointer, never inline content. */
const OPAQUE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/

export interface ArtsMusicPortfolioSubmission {
  readonly unitId: string
  readonly presentationMode: ArtsMusicPresentationMode
  /** null when the submission is a live demonstration/discussion with no
   * stored artifact at all — that is a complete, valid submission, not a
   * degraded one. */
  readonly artifactRef: string | null
  readonly completedAt: string
  readonly parentConfirmed: boolean
}

export type ArtsMusicPortfolioSubmissionRejection =
  | 'unsupported-presentation-mode'
  | 'artifact-ref-too-long'
  | 'invalid-artifact-ref'
  | 'parent-confirmation-required'

export type CreateArtsMusicPortfolioSubmissionResult =
  | { readonly status: 'accepted'; readonly submission: ArtsMusicPortfolioSubmission }
  | { readonly status: 'rejected'; readonly reason: ArtsMusicPortfolioSubmissionRejection }

export interface CreateArtsMusicPortfolioSubmissionInput {
  readonly unitId: string
  readonly presentationMode: ArtsMusicPresentationMode
  readonly artifactRef: string | null
  readonly completedAt: string
  readonly parentConfirmed: boolean
}

/**
 * Validates and records a portfolio submission. Rejects (never guesses or
 * silently drops) anything that isn't a stable opaque reference, so no raw
 * learner artifact — a description, a transcript, binary content — can ever
 * be persisted through this path.
 */
export function createArtsMusicPortfolioSubmission(
  input: CreateArtsMusicPortfolioSubmissionInput,
): CreateArtsMusicPortfolioSubmissionResult {
  if (!ARTS_MUSIC_PRESENTATION_MODES.includes(input.presentationMode)) {
    return { status: 'rejected', reason: 'unsupported-presentation-mode' }
  }
  if (input.artifactRef !== null) {
    if (input.artifactRef.length > 192) {
      return { status: 'rejected', reason: 'artifact-ref-too-long' }
    }
    if (!OPAQUE_REF.test(input.artifactRef)) {
      return { status: 'rejected', reason: 'invalid-artifact-ref' }
    }
  }
  // Study completion uses existing runtime authority, not this module's own
  // judgment — a submission only becomes a completion record once a parent
  // or teacher confirms it, the same requirement every other completion-only
  // Family Pilot activity carries.
  if (!input.parentConfirmed) {
    return { status: 'rejected', reason: 'parent-confirmation-required' }
  }
  return {
    status: 'accepted',
    submission: {
      unitId: input.unitId,
      presentationMode: input.presentationMode,
      artifactRef: input.artifactRef,
      completedAt: input.completedAt,
      parentConfirmed: input.parentConfirmed,
    },
  }
}
