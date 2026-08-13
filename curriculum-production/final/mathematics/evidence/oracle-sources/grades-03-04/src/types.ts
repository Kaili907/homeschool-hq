/**
 * Machine-readable student-work material format for Manuel Academy Grade 3/4
 * mathematics.
 *
 * Two artefacts are emitted per lesson and are deliberately stored in separate
 * files so a learner-facing renderer can load the package without ever holding
 * the answers in memory:
 *
 *   packages/grade-XX/<lessonId>.package.json   — student projection, no answers
 *   answer-keys/grade-XX/<lessonId>.key.json    — parent/teacher answers + reasoning
 *
 * This type module mirrors curriculum-production/student-work/mathematics's
 * own types.ts exactly (grades 5-12's sibling pipeline); the format is
 * subject/grade-agnostic by design, so it is forked here rather than shared,
 * per this pipeline's mathematics-g34/-only ownership.
 */

export type MaterialDifficulty = 1 | 2 | 3

/** Sections are ordered; a lesson's blueprint decides which ones appear. */
export type SectionKind =
  | 'instructional-example'
  | 'guided-practice'
  | 'independent-practice'
  | 'mastery-check'
  | 'extension'

/**
 * `worked-example` items are instructional: their solution is student-facing by
 * design and carries no answer-key entry. Every other kind is graded and its
 * answer lives only in the answer-key file.
 */
export type ItemKind = 'worked-example' | 'multiple-choice' | 'constructed-response'

export interface LessonRef {
  lessonId: string
  courseId: string
  grade: number
  subject: 'mathematics'
  unitNumber: number
  unitTitle: string
  dayInUnit: number
  courseDay: number
  phase: string
  focus: string
  title: string
}

export interface WorkedSolution {
  /** Ordered reasoning a parent can follow to check multi-step work. */
  steps: readonly string[]
  answer: string
}

/** Instructional item. Solution is intentionally part of the student projection. */
export interface WorkedExampleItem {
  ref: string
  kind: 'worked-example'
  itemType: string
  standard: string
  difficulty: MaterialDifficulty
  prompt: string
  workedSolution: WorkedSolution
}

/** Graded item. Carries no answer-bearing field of any kind. */
export interface MultipleChoiceItem {
  ref: string
  kind: 'multiple-choice'
  itemType: string
  standard: string
  difficulty: MaterialDifficulty
  prompt: string
  choices: readonly string[]
}

export interface ConstructedResponseItem {
  ref: string
  kind: 'constructed-response'
  itemType: string
  standard: string
  difficulty: MaterialDifficulty
  prompt: string
  /** What the learner must produce; never the answer itself. */
  responseExpectation: string
}

export type GradedItem = MultipleChoiceItem | ConstructedResponseItem
export type MaterialItem = WorkedExampleItem | GradedItem

export interface MaterialSection {
  sectionId: string
  kind: SectionKind
  title: string
  /** Learner-facing directions for the section. */
  directions: string
  items: readonly MaterialItem[]
}

export interface StudentWorkPackage {
  schemaVersion: '1.0'
  packageId: string
  lessonRef: LessonRef
  standards: readonly string[]
  blueprint: {
    phase: string
    /** Named composition profile chosen from the lesson phase. */
    profile: string
    sectionKinds: readonly SectionKind[]
  }
  sections: readonly MaterialSection[]
  answerKeyRef: string
  integrity: {
    corpusVersion: string
    itemSource: string
    seed: string
  }
}

export interface CommonError {
  observed: string
  likelyCause: string
  remediation: string
}

/**
 * How the authoritative answer was established.
 *
 * `recomputed` means an oracle in this directory recalculated the answer from
 * the item's own generation parameters, on a code path independent of the one
 * that produced the item. Every Grade 3/4 item type in this pipeline is
 * authored fresh (there were no pre-existing generators for these grades), so
 * `recomputed` is the standard here — the same standard the grades 9-12
 * sibling pipeline uses for the same reason.
 */
export interface AnswerVerification {
  method: 'recomputed' | 'generator-authority'
  /** Module or test file that establishes the answer independently. */
  oracle: string
  parameters: Record<string, unknown>
}

/**
 * The item type's authored teaching example.
 *
 * This is a *different problem* from the item it accompanies, kept because it
 * shows the method. It is named `referenceExample` so no renderer can present
 * it as this item's solution.
 */
export interface ReferenceExample {
  prompt: string
  steps: readonly string[]
  answer: string
}

export interface AnswerKeyEntry {
  ref: string
  itemType: string
  standard: string
  difficulty: MaterialDifficulty
  answerType: 'fixed'
  answer: string
  /** Present for multiple-choice items; indexes into the package's choices. */
  answerIndex?: number
  /** The item's own generated quantities, so a parent can check the setup. */
  given: Record<string, unknown>
  /** Reasoning about this item, using this item's numbers. */
  solutionReasoning: WorkedSolution
  referenceExample: ReferenceExample
  verification: AnswerVerification
  commonErrors: readonly CommonError[]
}

export interface AnswerKey {
  schemaVersion: '1.0'
  packageId: string
  lessonRef: Pick<LessonRef, 'lessonId' | 'courseId' | 'grade' | 'unitNumber' | 'phase'>
  answers: readonly AnswerKeyEntry[]
  scoringGuidance: string
  masteryRule: string
  remediationGuidance: readonly string[]
  extensionGuidance: readonly string[]
  integrity: {
    corpusVersion: string
    seed: string
  }
}
