/**
 * FF-M5 — completion-evidence metadata. Study records that a PE segment was
 * done; it never records how the body performed. Every "no invasive
 * tracking" rule is encoded as a literal `false` type below, the same
 * pattern src/study/types.ts uses for `rawAnswerIncluded` / `transcriptIncluded`,
 * so a caller cannot construct evidence that violates it and have the type
 * system stay quiet.
 */

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/

export interface PhysicalEducationCompletionEvidence {
  readonly lessonRef: string
  readonly segmentRef: string
  readonly evidenceKind: 'self-reported-completion'
  readonly completedAt: string
  readonly recordedBy: 'learner' | 'guardian'
  /** No text, audio, or written reflection is ever attached to completion. */
  readonly rawReflectionIncluded: false
  /** No photo, video, or camera capture is ever attached to completion. */
  readonly mediaIncluded: false
  /** No weight, body-fat, or other body measurement is ever recorded. */
  readonly bodyMetricsIncluded: false
}

export function buildCompletionEvidence(input: {
  readonly lessonRef: string
  readonly segmentRef: string
  readonly completedAt: string
  readonly recordedBy: 'learner' | 'guardian'
}): PhysicalEducationCompletionEvidence {
  if (!SAFE_REF.test(input.lessonRef)) throw new Error('lessonRef must be a stable opaque reference.')
  if (!SAFE_REF.test(input.segmentRef)) throw new Error('segmentRef must be a stable opaque reference.')
  if (!input.completedAt.trim()) throw new Error('completedAt is required.')
  return Object.freeze({
    lessonRef: input.lessonRef,
    segmentRef: input.segmentRef,
    evidenceKind: 'self-reported-completion',
    completedAt: input.completedAt,
    recordedBy: input.recordedBy,
    rawReflectionIncluded: false,
    mediaIncluded: false,
    bodyMetricsIncluded: false,
  })
}
