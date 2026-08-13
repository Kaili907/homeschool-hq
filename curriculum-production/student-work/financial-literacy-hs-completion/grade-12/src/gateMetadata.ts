/**
 * Production Gate H3 scoring-mode metadata.
 *
 * The shared production-readiness gate this repository already owns
 * (`src/curriculum/production-quality`) recognises exactly three scoring
 * modes — `ANSWER_KEY`, `RUBRIC`, and `SCORING_JUDGMENT` — and it requires a
 * `MATH_STRUCTURED_FINLIT` lesson to present a fixed `ANSWER_KEY`. This lane
 * authors every grade 12 lesson as mixed work, so its own records are
 * `HYBRID`, a kind the gate's vocabulary does not contain.
 *
 * This module prepares the mapping between the two rather than papering over
 * it. A lesson may be declared `ANSWER_KEY` to the gate only when it actually
 * carries at least one fixed answer the oracle reproduced; the rubric half of
 * a hybrid lesson is reported alongside, not discarded. `projectGateMode`
 * throws rather than downgrading, so a lesson that lost its fixed items can
 * never be handed to the gate still claiming a key.
 *
 * Nothing here modifies the gate. The gate is not owned by this lane, and
 * `tests/gate.test.ts` runs the real gate code unmodified over this corpus.
 */
import { packageId, scoringKind } from './compose.ts'
import { verifyLesson } from './oracle.ts'
import { SOURCE_CORPUS_VERSION } from './sourceIndex.ts'
import type { DomainId, LessonSpec } from './types.ts'

export type GateScoringMode = 'ANSWER_KEY' | 'RUBRIC' | 'SCORING_JUDGMENT'
export type LaneScoringKind = 'ANSWER_KEY' | 'RUBRIC' | 'HYBRID'

export const SUBJECT_FAMILY = 'MATH_STRUCTURED_FINLIT'

export interface LessonGateMetadata {
  readonly packageId: string
  readonly lessonId: string
  readonly unit: number
  readonly day: number
  readonly laneScoringKind: LaneScoringKind
  readonly gateScoringMode: GateScoringMode
  readonly fixedItemCount: number
  readonly rubricItemCount: number
  readonly oracleVerifiedFixedAnswers: number
  readonly integratedDomains: readonly DomainId[]
  readonly isCapstone: boolean
}

export interface GateMetadata {
  readonly schemaVersion: '1.0'
  readonly lane: string
  readonly grade: 12
  readonly subjectFamily: typeof SUBJECT_FAMILY
  readonly sourceCorpusVersion: string
  readonly gateContract: string
  readonly modeMapping: readonly string[]
  readonly counts: {
    readonly lessons: number
    readonly byLaneKind: Readonly<Record<string, number>>
    readonly byGateMode: Readonly<Record<string, number>>
    readonly fixedItems: number
    readonly rubricItems: number
  }
  readonly lessons: readonly LessonGateMetadata[]
}

/**
 * Maps a lane scoring kind onto a gate scoring mode for a FinLit lesson.
 * Fails closed: a lesson with no fixed item cannot be declared ANSWER_KEY.
 */
export function projectGateMode(kind: LaneScoringKind, fixedItemCount: number): GateScoringMode {
  if (kind === 'RUBRIC' || fixedItemCount === 0) {
    if (fixedItemCount > 0) return 'RUBRIC'
    throw new Error(
      'refusing to project a gate scoring mode: a MATH_STRUCTURED_FINLIT lesson with no fixed item cannot be declared ANSWER_KEY to the gate, and declaring RUBRIC would fail it',
    )
  }
  return 'ANSWER_KEY'
}

export function lessonGateMetadata(spec: LessonSpec): LessonGateMetadata {
  const items = spec.tasks.flatMap((t) => t.items)
  const fixedItemCount = items.filter((i) => i.kind !== 'judgment').length
  const rubricItemCount = items.filter((i) => i.kind === 'judgment').length
  const kind = scoringKind(spec)
  const oracle = verifyLesson(spec)
  if (oracle.findings.length > 0) {
    throw new Error(`refusing to publish gate metadata for ${spec.lessonId}: the oracle reported ${oracle.findings.length} unverified answer(s)`)
  }
  return {
    packageId: packageId(spec),
    lessonId: spec.lessonId,
    unit: spec.unit,
    day: spec.day,
    laneScoringKind: kind,
    gateScoringMode: projectGateMode(kind, fixedItemCount),
    fixedItemCount,
    rubricItemCount,
    oracleVerifiedFixedAnswers: oracle.recomputedNumeric + oracle.derivedChoices,
    integratedDomains: spec.domains,
    isCapstone: Boolean(spec.isCapstone),
  }
}

export function buildGateMetadata(specs: readonly LessonSpec[]): GateMetadata {
  const lessons = specs.map(lessonGateMetadata)
  const tally = (values: readonly string[]): Record<string, number> => {
    const out: Record<string, number> = {}
    for (const v of values) out[v] = (out[v] ?? 0) + 1
    return out
  }
  return {
    schemaVersion: '1.0',
    lane: 'curriculum-production/student-work/financial-literacy-hs-completion/grade-12',
    grade: 12,
    subjectFamily: SUBJECT_FAMILY,
    sourceCorpusVersion: SOURCE_CORPUS_VERSION,
    gateContract:
      'src/curriculum/production-quality — ScoringAuthorityKind is ANSWER_KEY | RUBRIC | SCORING_JUDGMENT, and a MATH_STRUCTURED_FINLIT lesson requires a fixed ANSWER_KEY.',
    modeMapping: [
      'Every grade 12 lesson in this lane is authored as mixed work, so its lane scoring kind is HYBRID: at least one fixed item the oracle recomputed, and at least one judgment item scored by rubric.',
      'HYBRID projects to the gate as ANSWER_KEY, which the gate requires for MATH_STRUCTURED_FINLIT. The projection is only legitimate because the fixed half genuinely exists and was verified; fixedItemCount and oracleVerifiedFixedAnswers are published per lesson so the claim can be audited rather than trusted.',
      'The rubric half is not discarded by the projection. rubricItemCount records it, and the full acceptable-answer criteria, evidence requirements, and look-fors live in each lesson’s scoring record.',
      'projectGateMode throws rather than downgrading a lesson that has lost its fixed items, so a lesson can never reach the gate still claiming a key it no longer carries.',
    ],
    counts: {
      lessons: lessons.length,
      byLaneKind: tally(lessons.map((l) => l.laneScoringKind)),
      byGateMode: tally(lessons.map((l) => l.gateScoringMode)),
      fixedItems: lessons.reduce((n, l) => n + l.fixedItemCount, 0),
      rubricItems: lessons.reduce((n, l) => n + l.rubricItemCount, 0),
    },
    lessons,
  }
}
