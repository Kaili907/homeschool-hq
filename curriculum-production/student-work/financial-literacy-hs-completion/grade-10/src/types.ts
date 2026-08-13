/**
 * Authoring model for the High School Financial Literacy student-work lane.
 *
 * A LessonSpec is the single authored artefact per lesson. Everything shipped
 * (the learner-facing task sheet and the adult-only scoring record) is emitted
 * from it deterministically by `compose.ts`, and every fixed answer in it is
 * independently recomputed from the spec's own stated parameters by
 * `oracle.ts`. The authored `answer` string is never trusted: if the oracle
 * cannot reproduce it exactly, the corpus fails closed.
 */

export type Grade = 9 | 10 | 11 | 12

/** Money and rate formats the oracle knows how to render. */
export type NumericFormat =
  | 'usd'        // $1,234.56
  | 'usd0'       // $1,235
  | 'percent1'   // 12.3%
  | 'percent2'   // 12.34%
  | 'int'        // 1,234
  | 'dec1'       // 12.3
  | 'dec2'       // 12.34
  | 'years1'     // 12.3
  | 'months0'    // 42

/**
 * A fixed-answer numeric item.
 *
 * `given` holds every scenario figure the computation consumes. Each value
 * must be visible to the learner somewhere in the lesson text — enforced by
 * `tests/parameterVisibility.test.ts` — so a task sheet can never be scored
 * against a figure the learner was not shown.
 *
 * `expr` is evaluated in exact rational arithmetic over `given`, over prior
 * item results (`#taskId-promptId`), and over an allowlist of structural
 * constants. `answer` is the authored literal the oracle must reproduce.
 */
export interface NumericItem {
  readonly ref: string
  readonly kind: 'numeric'
  readonly text: string
  readonly unit?: string
  readonly given: Readonly<Record<string, number>>
  readonly expr: string
  readonly format: NumericFormat
  readonly answer: string
  /** Why this computation is the right one for the scenario. Adult-only. */
  readonly reasoning: string
}

/** A comparison that decides which choice is correct, evaluated by the oracle. */
export interface ChoiceDecision {
  readonly left: string
  readonly cmp: '>' | '<' | '>=' | '<=' | '=='
  readonly right: string
  readonly ifTrue: string
  readonly ifFalse: string
}

/**
 * A fixed-choice item. When `decision` is present the oracle derives the
 * correct choice from the parameters and checks it against `answer`; when it
 * is absent the answer is a stated fact of the scenario and must carry
 * reasoning that a reviewer can check against the scenario text.
 */
export interface ChoiceItem {
  readonly ref: string
  readonly kind: 'choice'
  readonly text: string
  readonly choices: readonly string[]
  readonly given?: Readonly<Record<string, number>>
  readonly decision?: ChoiceDecision
  readonly answer: string
  readonly reasoning: string
}

/** Rubric dimensions available to judgment items. See `rubric.ts`. */
export type DimensionId =
  | 'computation-accuracy'
  | 'reasoning-from-figures'
  | 'assumption-identification'
  | 'tradeoff-defense'
  | 'evidence-use'
  | 'error-diagnosis'
  | 'transfer'
  | 'criteria-application'
  | 'communication-of-uncertainty'
  | 'plan-coherence'

/**
 * A judgment item. It carries no exact key by design: what is scored is
 * whether the response meets lesson-specific acceptable-answer criteria and
 * cites the required evidence.
 */
export interface JudgmentItem {
  readonly ref: string
  readonly kind: 'judgment'
  readonly length: 'short' | 'extended'
  readonly text: string
  /** Lesson-specific. A response meeting all of these is acceptable. */
  readonly acceptableAnswerCriteria: readonly string[]
  /** What the response must point at from the scenario to count as supported. */
  readonly evidenceRequirements: readonly string[]
  readonly dimensions: readonly DimensionId[]
  /** Lesson-specific observable indicators for the adult scoring the work. */
  readonly lookFors: readonly string[]
  /** The specific wrong turn this item is built to surface, if any. */
  readonly commonMisconception?: string
}

export type Item = NumericItem | ChoiceItem | JudgmentItem

export interface SpecTask {
  readonly taskId: string
  readonly kind: 'warm-up' | 'guided' | 'independent' | 'performance-task' | 'reflection'
  readonly directions: string
  readonly items: readonly Item[]
}

export interface LessonSpec {
  /** Must match a lesson_id in the pinned source corpus exactly. */
  readonly lessonId: string
  readonly grade: Grade
  readonly unit: number
  readonly day: number
  /** Fictional person, household, or organisation the scenario is about. */
  readonly actor: string
  readonly objective: string
  readonly scenario: string
  readonly materials: readonly string[]
  readonly tasks: readonly SpecTask[]
  readonly remediation: string
  readonly extension: string
}
