/**
 * ELA Production R3 — derived contract constants.
 *
 * Every value in this module is DERIVED from two frozen artifacts and from
 * nothing else:
 *
 *   1. `docs/curriculum-quality/APPROVED-LESSON-CONTRACTS-R2.md` (FROZEN prose
 *      contract: "Common Lesson Contract" and "ELA model").
 *   2. The nine frozen ELA Director samples in
 *      `src/study/family-pilot/ela-director-samples-r2/`, listed as
 *      `DIRECTOR_APPROVED_FOR_PRODUCTION` in
 *      `curriculum/approvals/director-samples-r2-approved.json`.
 *
 * This module does not reinterpret, extend, or soften those artifacts.
 * `elaProductionR3.test.ts` re-derives every constant here directly from the
 * frozen samples and fails if the two ever disagree.
 *
 * Where production needs a decision the frozen contract does not make, the
 * decision is NOT made here. It is recorded, undecided, in OPEN-QUESTIONS.md.
 */
import type { LearnerResponseType } from '../final-app/learner-response'

/** Freeze identity this harness is bound to. */
export const ELA_R3_CONTRACT_SOURCE = Object.freeze({
  manifestId: 'DIRECTOR_SAMPLES_R2_APPROVED',
  approvalManifest: 'curriculum/approvals/director-samples-r2-approved.json',
  proseContract: 'docs/curriculum-quality/APPROVED-LESSON-CONTRACTS-R2.md',
  frozenSampleNamespace: 'src/study/family-pilot/ela-director-samples-r2',
  gallerySha: '416664e1656c6eb21517249d3a8cfbc616d35eee',
  freezeDate: '2026-08-18',
})

/**
 * Supported grades. Derived from the approval manifest `grades` array and its
 * `grade6Excluded: true` flag. Grade 6 does not exist.
 */
export const ELA_R3_GRADES = Object.freeze([3, 4, 5, 7, 8, 9, 10, 11, 12] as const)

export type ElaProductionGrade = typeof ELA_R3_GRADES[number]

export interface ElaR3SectionSlot {
  /** Stable slot name used by the builder and the validator. */
  readonly slot: string
  /** Exact learner-visible section title in the frozen samples. */
  readonly title: string
  /** Exact `sectionKind` string in the frozen samples. */
  readonly sectionKind: string
  /** True when the title carries lesson-specific text after a fixed prefix. */
  readonly titlePrefixOnly?: true
}

/**
 * The controlling learner flow, in order. Derived by reading the section list
 * that `buildElaDirectorSample` emits for all nine approved samples; every
 * approved sample has exactly these eighteen sections in exactly this order.
 *
 * Frozen prose support: "TEACH is written to the learner"; "A WORKED EXAMPLE is
 * clearly labelled"; "YOUR TURN always has a real supported response control";
 * "FEEDBACK is instructional"; "Where judgment is required, the lesson provides
 * Parent Review"; "LESSON REVIEW is meaningful".
 */
export const ELA_R3_SECTION_PLAN: readonly ElaR3SectionSlot[] = Object.freeze([
  Object.freeze({ slot: 'welcome', title: 'WELCOME / PURPOSE', sectionKind: 'teaching' }),
  Object.freeze({ slot: 'instruction', title: 'SHORT INSTRUCTION', sectionKind: 'teaching' }),
  Object.freeze({ slot: 'vocabulary', title: 'WORDS TO KNOW', sectionKind: 'vocabulary' }),
  Object.freeze({ slot: 'model', title: "EXAMPLE / LET'S LOOK AT ONE", sectionKind: 'worked-example' }),
  Object.freeze({ slot: 'passage', title: 'READ: ', sectionKind: 'source', titlePrefixOnly: true }),
  Object.freeze({ slot: 'guided', title: 'YOUR TURN — GUIDED PRACTICE', sectionKind: 'guided-practice' }),
  Object.freeze({ slot: 'guidedFeedback', title: 'FEEDBACK — CHECK THE REASONING', sectionKind: 'remediation feedback-after-response' }),
  Object.freeze({ slot: 'independent', title: 'YOUR TURN — INDEPENDENT RESPONSE', sectionKind: 'independent-practice' }),
  Object.freeze({ slot: 'processFeedback', title: 'FEEDBACK — PREPARE TO REVISE', sectionKind: 'remediation feedback-after-response' }),
  Object.freeze({ slot: 'revision', title: 'YOUR TURN — REVISE', sectionKind: 'independent-practice additional-practice revision' }),
  Object.freeze({ slot: 'parentReview', title: 'PARENT REVIEW', sectionKind: 'rubric-review-pending' }),
  Object.freeze({ slot: 'review:learned', title: 'WHAT YOU LEARNED', sectionKind: 'reflection' }),
  Object.freeze({ slot: 'review:how', title: 'HOW YOU DID', sectionKind: 'reflection' }),
  Object.freeze({ slot: 'review:well', title: 'WHAT YOU DID WELL', sectionKind: 'reflection' }),
  Object.freeze({ slot: 'review:practice', title: 'WHAT TO PRACTICE', sectionKind: 'reflection' }),
  Object.freeze({ slot: 'review:lesson', title: 'REVIEW THIS LESSON', sectionKind: 'reflection' }),
  Object.freeze({ slot: 'review:progress', title: 'COURSE PROGRESS', sectionKind: 'reflection' }),
  Object.freeze({ slot: 'review:next', title: 'NEXT ACTION', sectionKind: 'reflection' }),
])

/**
 * The seven review pages, in order. Frozen prose: "LESSON REVIEW is meaningful
 * and includes: What you learned; How you did; What you did well; What to
 * practice/review; Review this lesson; Course progress; and Next action."
 */
export const ELA_R3_REVIEW_TITLES: readonly string[] = Object.freeze(
  ELA_R3_SECTION_PLAN.filter((slot) => slot.sectionKind === 'reflection').map((slot) => slot.title),
)

/**
 * The required learner-response sequence. Every approved ELA sample produces
 * exactly these three required responses, in this order: one guided fixed
 * choice, one independent constructed response, one revision constructed
 * response. Frozen prose: "YOUR TURN always has a real supported response
 * control"; ELA model: "real constructed-response surfaces, opportunities for
 * revision, and useful multiple-choice feedback".
 */
export const ELA_R3_REQUIRED_RESPONSE_SEQUENCE: readonly LearnerResponseType[] = Object.freeze([
  'CHOICE',
  'CONSTRUCTED_RESPONSE',
  'CONSTRUCTED_RESPONSE',
])

/**
 * Exactly one Parent Review hand-off per lesson. ELA model: "The system must not
 * pretend to deterministically score an essay. Where judgment is required, the
 * lesson provides Parent Review."
 */
export const ELA_R3_RUBRIC_REVIEW_ITEM_COUNT = 1

/** Minimum Rich Study Player pages. Eighteen sections, one item each. */
export const ELA_R3_MIN_PAGES = ELA_R3_SECTION_PLAN.length

/**
 * Copy the learner must see on the Parent Review page, so no lesson can quietly
 * drop the no-invented-score guarantee. Both strings are emitted verbatim by the
 * approved builder and are asserted by the frozen R2 gate.
 */
export const ELA_R3_REQUIRED_MATERIAL_PHRASES: readonly string[] = Object.freeze([
  'No automatic essay score is produced',
  'pending human judgment',
])

/**
 * Scoring, answer, and solution authority must not appear anywhere in a learner
 * record. Taken verbatim from the frozen R2 gate's forbidden-key probe.
 */
export const ELA_R3_FORBIDDEN_AUTHORITY_KEY = /answer.?key|correct(?:Choice|Answer)?|solution|score|scoring/i

/** No AI Tutor runtime dependency in learner content. Frozen R2 gate probe. */
export const ELA_R3_FORBIDDEN_RUNTIME = /Tutor V2|tutorRuntime|providerCall/i

/**
 * The reading must be a Manuel Academy original delivered in full. Derived from
 * the `reference` block every approved sample's source section carries, and
 * asserted by the frozen R2 gate.
 */
export const ELA_R3_REQUIRED_SOURCE_REFERENCE = Object.freeze({
  creator: 'Manuel Academy',
  rightsCategory: 'original',
})

export interface ElaR3ObservedGradeEnvelope {
  readonly grade: ElaProductionGrade
  readonly passageWordCount: number
  readonly vocabularyTermCount: number
  readonly guidedChoiceCount: number
}

/**
 * OBSERVED, NOT RULED.
 *
 * These are the measured values of the nine approved samples. The frozen
 * contract states no minimum, maximum, or per-grade bound for any of them, so
 * the validator reports departures as observations, never as errors. Turning any
 * of these into a production rule is an open question, not a decision this
 * harness may make. See OPEN-QUESTIONS.md items Q3, Q5, and Q6.
 */
export const ELA_R3_OBSERVED_ENVELOPE: readonly ElaR3ObservedGradeEnvelope[] = Object.freeze([
  Object.freeze({ grade: 3, passageWordCount: 178, vocabularyTermCount: 2, guidedChoiceCount: 3 } as const),
  Object.freeze({ grade: 4, passageWordCount: 241, vocabularyTermCount: 3, guidedChoiceCount: 3 } as const),
  Object.freeze({ grade: 5, passageWordCount: 224, vocabularyTermCount: 3, guidedChoiceCount: 3 } as const),
  Object.freeze({ grade: 7, passageWordCount: 310, vocabularyTermCount: 3, guidedChoiceCount: 3 } as const),
  Object.freeze({ grade: 8, passageWordCount: 275, vocabularyTermCount: 3, guidedChoiceCount: 3 } as const),
  Object.freeze({ grade: 9, passageWordCount: 343, vocabularyTermCount: 3, guidedChoiceCount: 3 } as const),
  Object.freeze({ grade: 10, passageWordCount: 206, vocabularyTermCount: 3, guidedChoiceCount: 3 } as const),
  Object.freeze({ grade: 11, passageWordCount: 373, vocabularyTermCount: 3, guidedChoiceCount: 3 } as const),
  Object.freeze({ grade: 12, passageWordCount: 493, vocabularyTermCount: 3, guidedChoiceCount: 3 } as const),
])

export function elaR3ObservedEnvelope(grade: ElaProductionGrade): ElaR3ObservedGradeEnvelope {
  const envelope = ELA_R3_OBSERVED_ENVELOPE.find((entry) => entry.grade === grade)
  if (!envelope) throw new Error(`Grade ${grade} is not an approved ELA grade.`)
  return envelope
}

/** Canonical lesson-id shape of the existing ELA production corpus. */
export const ELA_R3_CANONICAL_LESSON_ID = /^ma-g(3|4|5|7|8|9|10|11|12)-english-language-arts-u\d{2}-l\d{2}$/
