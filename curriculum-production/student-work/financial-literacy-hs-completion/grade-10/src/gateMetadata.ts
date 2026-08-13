/**
 * Production Gate H3 `responseScoring` projection.
 *
 * H3 (`src/curriculum/production-quality`) treats `MATH_STRUCTURED_FINLIT` as
 * two disciplines. A lesson that declares `structuredDiscipline:
 * 'FINANCIAL_LITERACY'` carries an explicit `ResponseScoringContract` — a mode
 * plus an inventory of items each tagged FIXED or OPEN — and is failed closed
 * without it. That contract is the right target for this lane: Financial
 * Literacy legitimately mixes settleable computation with genuine judgment, and
 * `MIXED` says so directly instead of forcing the lesson to claim a single
 * authority it does not have.
 *
 * The inventory is what stops the declared mode from being a bare assertion.
 * H3 checks the mode against the items, so a lesson calling itself judgment
 * while its items are fixed contradicts itself and the gate can see it without
 * judging any answer's truth. This module derives the mode *from* the items by
 * the same rule H3 applies, and `projectLesson` throws rather than emitting a
 * contract whose mode its own inventory does not support.
 *
 * Nothing here modifies the gate. The gate is not owned by this lane, and this
 * module is a projection of already-emitted task sheets, not a second source of
 * truth: it reads the composed sheet rather than the spec, so what it describes
 * is exactly what ships.
 */
import { packageId, scoringKind, composeTaskSheet } from './compose.ts'
import { verifyLesson } from './oracle.ts'
import { SOURCE_CORPUS_VERSION, type SourceLesson } from './sourceIndex.ts'
import type { LessonSpec } from './types.ts'

export const SUBJECT_FAMILY = 'MATH_STRUCTURED_FINLIT'
export const STRUCTURED_DISCIPLINE = 'FINANCIAL_LITERACY'

/** Prompt types the emitted task sheet uses for work with one settleable answer. */
const FIXED_PROMPT_TYPES = new Set(['fixed-numeric', 'fixed-choice'])

export type ResponseScoringMode = 'FIXED_OR_COMPUTATIONAL' | 'JUDGMENT_APPLICATION' | 'MIXED'
export type ItemResponseMode = 'FIXED' | 'OPEN'

export interface LessonResponseItem {
  readonly ref: string
  readonly responseMode: ItemResponseMode
  readonly promptText: string
}

export interface ResponseScoringContract {
  readonly mode: ResponseScoringMode
  readonly items: readonly LessonResponseItem[]
}

export interface LessonGateMetadata {
  readonly packageId: string
  readonly lessonId: string
  readonly unit: number
  readonly day: number
  readonly subjectFamily: typeof SUBJECT_FAMILY
  readonly structuredDiscipline: typeof STRUCTURED_DISCIPLINE
  readonly laneScoringKind: 'ANSWER_KEY' | 'RUBRIC' | 'HYBRID'
  readonly responseScoring: ResponseScoringContract
  readonly fixedItemCount: number
  readonly openItemCount: number
  readonly oracleVerifiedFixedAnswers: number
}

export interface GateMetadata {
  readonly schemaVersion: '1.0'
  readonly lane: string
  readonly grade: 10
  readonly units: readonly number[]
  readonly subjectFamily: typeof SUBJECT_FAMILY
  readonly structuredDiscipline: typeof STRUCTURED_DISCIPLINE
  readonly sourceCorpusVersion: string
  readonly gateContract: string
  readonly modeMapping: readonly string[]
  readonly counts: {
    readonly lessons: number
    readonly byLaneKind: Readonly<Record<string, number>>
    readonly byResponseMode: Readonly<Record<string, number>>
    readonly fixedItems: number
    readonly openItems: number
  }
  readonly lessons: readonly LessonGateMetadata[]
}

/**
 * Derives the mode from the inventory by the rule H3 applies to it. Fails
 * closed: a contract whose mode its own items contradict is never produced.
 */
export function deriveMode(items: readonly LessonResponseItem[]): ResponseScoringMode {
  const hasFixed = items.some((i) => i.responseMode === 'FIXED')
  const hasOpen = items.some((i) => i.responseMode === 'OPEN')
  if (!hasFixed && !hasOpen) throw new Error('refusing to project a response-scoring contract for a lesson with no items')
  return hasFixed && hasOpen ? 'MIXED' : hasFixed ? 'FIXED_OR_COMPUTATIONAL' : 'JUDGMENT_APPLICATION'
}

export function projectLesson(spec: LessonSpec, src: SourceLesson): LessonGateMetadata {
  const oracle = verifyLesson(spec)
  if (oracle.findings.length > 0) {
    throw new Error(
      `refusing to publish gate metadata for ${spec.lessonId}: the oracle reported ${oracle.findings.length} unverified answer(s)`,
    )
  }
  const sheet = composeTaskSheet(spec, src) as {
    tasks: { prompts: { ref: string; promptType: string; text: string }[] }[]
  }
  const items: LessonResponseItem[] = sheet.tasks.flatMap((task) =>
    task.prompts.map((prompt) => ({
      ref: prompt.ref,
      responseMode: FIXED_PROMPT_TYPES.has(prompt.promptType) ? ('FIXED' as const) : ('OPEN' as const),
      promptText: prompt.text,
    })),
  )
  const mode = deriveMode(items)
  const kind = scoringKind(spec)
  // The lane's own vocabulary and the gate's must agree about what the lesson is.
  const expected = kind === 'HYBRID' ? 'MIXED' : kind === 'ANSWER_KEY' ? 'FIXED_OR_COMPUTATIONAL' : 'JUDGMENT_APPLICATION'
  if (expected !== mode) {
    throw new Error(
      `refusing to publish gate metadata for ${spec.lessonId}: the scoring record is ${kind} but the emitted item inventory implies ${mode}`,
    )
  }
  return {
    packageId: packageId(spec),
    lessonId: spec.lessonId,
    unit: spec.unit,
    day: spec.day,
    subjectFamily: SUBJECT_FAMILY,
    structuredDiscipline: STRUCTURED_DISCIPLINE,
    laneScoringKind: kind,
    responseScoring: { mode, items },
    fixedItemCount: items.filter((i) => i.responseMode === 'FIXED').length,
    openItemCount: items.filter((i) => i.responseMode === 'OPEN').length,
    oracleVerifiedFixedAnswers: oracle.recomputedNumeric + oracle.derivedChoices,
  }
}

export function buildGateMetadata(
  specs: readonly LessonSpec[],
  source: ReadonlyMap<string, SourceLesson>,
): GateMetadata {
  const lessons = specs.map((s) => {
    const src = source.get(s.lessonId)
    if (!src) throw new Error(`spec ${s.lessonId} does not match any lesson in the pinned source corpus`)
    return projectLesson(s, src)
  })
  const tally = (values: readonly string[]): Record<string, number> => {
    const out: Record<string, number> = {}
    for (const v of values) out[v] = (out[v] ?? 0) + 1
    return out
  }
  return {
    schemaVersion: '1.0',
    lane: 'curriculum-production/student-work/financial-literacy-hs-completion/grade-10',
    grade: 10,
    units: [3, 4, 5, 6, 7],
    subjectFamily: SUBJECT_FAMILY,
    structuredDiscipline: STRUCTURED_DISCIPLINE,
    sourceCorpusVersion: SOURCE_CORPUS_VERSION,
    gateContract:
      "src/curriculum/production-quality — a MATH_STRUCTURED_FINLIT lesson declaring structuredDiscipline 'FINANCIAL_LITERACY' carries a ResponseScoringContract of { mode, items[] }, and is failed closed without it.",
    modeMapping: [
      'Every lesson in this lane is authored as mixed work, so its lane scoring kind is HYBRID: at least one fixed item the oracle recomputed, and at least one judgment item scored by rubric.',
      'HYBRID projects to the gate as responseScoring.mode = MIXED. This is a statement of what the lesson is, not a downgrade: H3 requires both authorities for MIXED, and both are present in every scoring record in this lane.',
      'The item inventory is derived from the emitted task sheet, not asserted. A prompt typed fixed-numeric or fixed-choice is FIXED; a short- or extended-response prompt is OPEN. H3 checks the declared mode against this inventory, and projectLesson throws rather than emitting a contract its own items contradict.',
      'The rubric half is not discarded. Every OPEN item keeps its acceptable-answer criteria, evidence requirements, and look-fors in the lesson scoring record, and carries exactCriteria of null there.',
      'Units 1 and 2 of grade 10 are held by the sibling financial-literacy-hs lane and are not projected here. Convergence is responsible for combining the two into one grade 10 submission of 72 lessons.',
    ],
    counts: {
      lessons: lessons.length,
      byLaneKind: tally(lessons.map((l) => l.laneScoringKind)),
      byResponseMode: tally(lessons.map((l) => l.responseScoring.mode)),
      fixedItems: lessons.reduce((n, l) => n + l.fixedItemCount, 0),
      openItems: lessons.reduce((n, l) => n + l.openItemCount, 0),
    },
    lessons,
  }
}
