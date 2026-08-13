import type { AnswerKey, GradedItem, MaterialItem, StudentWorkPackage } from './types.ts'
import type { SourceLesson } from './lessonSources.ts'
import { blueprintFor } from './blueprint.ts'
import { hasEquivalentDistractor } from './numericForm.ts'
import { standardCoveredBy } from './standards.ts'

/**
 * Corpus validators.
 *
 * These run over the emitted artefacts rather than over the generators, so they
 * check what a renderer would actually receive. The leakage check is the one
 * that matters most for the product: the student projection must not carry any
 * field from which an answer could be recovered.
 */

export interface ValidationIssue {
  packageId: string
  check: string
  detail: string
}

/** Any of these appearing on a graded item would expose the answer. */
const ANSWER_BEARING_KEYS = [
  'answer',
  'answerIndex',
  'correctAnswer',
  'correct',
  'solution',
  'solutionSteps',
  'workedSolution',
  'explanation',
  'rationale',
  'key',
  'parameters',
  'given',
]

const isGraded = (item: MaterialItem): item is GradedItem => item.kind !== 'worked-example'

export function validateLesson(
  materialPackage: StudentWorkPackage,
  answerKey: AnswerKey,
  lesson: SourceLesson,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const add = (check: string, detail: string): void => {
    issues.push({ packageId: materialPackage.packageId, check, detail })
  }

  // lessonRef exists and matches the authored lesson record exactly.
  if (materialPackage.lessonRef.lessonId !== lesson.ref.lessonId) {
    add('lessonRef-exists', `package lessonId ${materialPackage.lessonRef.lessonId} != ${lesson.ref.lessonId}`)
  }
  if (materialPackage.lessonRef.courseId !== lesson.ref.courseId) {
    add('course-identity', `courseId ${materialPackage.lessonRef.courseId} != ${lesson.ref.courseId}`)
  }
  if (materialPackage.lessonRef.grade !== lesson.ref.grade) {
    add('course-identity', `grade ${materialPackage.lessonRef.grade} != ${lesson.ref.grade}`)
  }
  if (materialPackage.lessonRef.unitNumber !== lesson.ref.unitNumber) {
    add('course-identity', `unitNumber mismatch for ${lesson.ref.lessonId}`)
  }

  // Package standards must be exactly the authored lesson's standards.
  const packageStandards = [...materialPackage.standards].sort().join(',')
  const lessonStandards = [...lesson.standards].sort().join(',')
  if (packageStandards !== lessonStandards) {
    add('standards-match-source', `package [${packageStandards}] != lesson [${lessonStandards}]`)
  }

  // Every item's standard must be one the lesson actually claims.
  const allItems = materialPackage.sections.flatMap((section) => section.items)
  for (const item of allItems) {
    if (!standardCoveredBy(item.standard, lesson.standards)) {
      add('item-standard-in-lesson', `${item.ref} carries ${item.standard}, not in the lesson record`)
    }
  }

  // Question refs unique within the package.
  const refs = allItems.map((item) => item.ref)
  const duplicates = refs.filter((ref, index) => refs.indexOf(ref) !== index)
  if (duplicates.length > 0) {
    add('question-refs-unique', `duplicate refs: ${[...new Set(duplicates)].join(', ')}`)
  }

  // The blueprint the package claims must match the lesson's phase.
  const blueprint = blueprintFor(lesson.ref.phase)
  if (materialPackage.blueprint.profile !== blueprint.profile) {
    add('blueprint-matches-phase', `profile ${materialPackage.blueprint.profile} != ${blueprint.profile}`)
  }

  // Every graded item has exactly one answer-key entry, and every entry resolves.
  const gradedRefs = new Set(allItems.filter(isGraded).map((item) => item.ref))
  const keyRefs = new Set(answerKey.answers.map((entry) => entry.ref))
  for (const ref of gradedRefs) {
    if (!keyRefs.has(ref)) add('no-missing-key-for-fixed-answer-item', `no answer key entry for ${ref}`)
  }
  for (const ref of keyRefs) {
    if (!gradedRefs.has(ref)) add('answer-refs-resolve', `answer key entry ${ref} has no graded item`)
  }
  if (answerKey.answers.length !== keyRefs.size) {
    add('answer-refs-resolve', 'answer key contains duplicate refs')
  }

  // Answer-key entries must carry a usable answer and checkable reasoning.
  const itemByRef = new Map(allItems.map((item) => [item.ref, item]))
  for (const entry of answerKey.answers) {
    if (entry.answer.trim() === '') add('no-missing-key-for-fixed-answer-item', `${entry.ref} has an empty answer`)
    if (entry.solutionReasoning.steps.length === 0) {
      add('solution-reasoning-present', `${entry.ref} has no solution reasoning`)
    }
    const item = itemByRef.get(entry.ref)
    if (item && item.kind === 'multiple-choice') {
      if (entry.answerIndex === undefined) {
        add('answer-refs-resolve', `${entry.ref} is multiple-choice but has no answerIndex`)
      } else if (item.choices[entry.answerIndex] !== entry.answer) {
        add(
          'answer-refs-resolve',
          `${entry.ref} answerIndex ${entry.answerIndex} points at "${item.choices[entry.answerIndex]}" but the key says "${entry.answer}"`,
        )
      }
    }
  }

  // No answer leakage: graded items must not carry answer-bearing fields.
  for (const item of allItems) {
    if (!isGraded(item)) continue
    for (const key of Object.keys(item)) {
      if (ANSWER_BEARING_KEYS.includes(key)) {
        add('no-answer-leakage', `graded item ${item.ref} exposes field "${key}"`)
      }
    }
  }
  // The package as a whole must not embed the answer key.
  const serialized = JSON.stringify(materialPackage)
  for (const key of ['"answerIndex"', '"solutionReasoning"', '"commonErrors"', '"given"']) {
    if (serialized.includes(key)) {
      add('no-answer-leakage', `package serialization contains ${key}`)
    }
  }

  // Difficulty identity retained on every item.
  for (const item of allItems) {
    if (![1, 2, 3].includes(item.difficulty)) {
      add('difficulty-retained', `${item.ref} has difficulty ${item.difficulty}`)
    }
  }

  // Distinct prompts inside a package, so no worksheet repeats a question.
  const prompts = allItems.map((item) => item.prompt)
  const repeated = prompts.filter((prompt, index) => prompts.indexOf(prompt) !== index)
  if (repeated.length > 0) {
    add('distinct-prompts', `${repeated.length} repeated prompt(s) in one package`)
  }

  // Multiple-choice items need enough distinct options to be answerable.
  for (const item of allItems) {
    if (item.kind !== 'multiple-choice') continue
    if (new Set(item.choices).size !== item.choices.length) {
      add('distinct-choices', `${item.ref} has duplicate choices`)
    }
    if (item.choices.length < 2) {
      add('distinct-choices', `${item.ref} has fewer than two choices`)
    }
    const keyed = answerKey.answers.find((entry) => entry.ref === item.ref)
    if (keyed && hasEquivalentDistractor(item.choices, keyed.answer)) {
      add(
        'no-equivalent-distractors',
        `${item.ref} offers a distractor equal in value to the answer "${keyed.answer}"`,
      )
    }
  }

  return issues
}
