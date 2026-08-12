import { evaluateAssessmentItem, type AssessmentItem, type LearnerInput } from '../../../../../adaptive-tutor/core/index'
import type { CurriculumQuestion } from '../../../../curriculum/generatorCore'

/**
 * FAMILY-PILOT-FINLIT-1 — answer checking through the existing authority.
 *
 * This lane never grades its own answers. A generator-sourced practice
 * question (see practiceBridge.ts) is converted into the reviewed Tutor Core
 * assessment contract (adaptive-tutor/core/contracts/assessment.ts) and
 * checked by its own evaluator (adaptive-tutor/core/engine/assessment-evaluator.ts)
 * — the same evaluator Tutor Core uses for math/english. `subject: "general"`
 * is the existing catch-all member of SubjectSchema for content outside
 * Tutor Core's graded subjects; it is metadata only and does not change how
 * evaluateAssessmentItem checks the answer.
 */

function toStableId(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const padded = normalized.length >= 3 ? normalized : `${normalized}-id`.padEnd(3, '0')
  return padded.slice(0, 120)
}

export interface FinLitAnswerCheckResult {
  readonly isCorrect: boolean
  readonly score: number
  readonly selectedChoice: string | null
}

/** Builds the reviewed multiple-choice assessment item for one generated
 * question. `id`/`skillId` are derived from the lesson and item type so the
 * same question always produces the same stable, opaque item id. */
export function financialLiteracyAssessmentItem(
  question: CurriculumQuestion<string, unknown>,
  lessonRef: string,
  grade: number,
): AssessmentItem {
  const id = toStableId(`finlit-${lessonRef}-${question.itemType}`)
  return {
    id,
    skillId: toStableId(`finlit-${question.itemType}`),
    purpose: 'independent-mastery',
    subject: 'general',
    gradeBand: { min: grade, max: grade, label: `Grade ${grade}` },
    locale: 'en-US',
    prompt: question.prompt,
    maxAttempts: 1,
    estimatedSeconds: 60,
    tags: [],
    noCameraRequired: true,
    identifyingInformationRequested: false,
    kind: 'multiple-choice',
    options: question.choices.map((text, index) => ({ id: `choice-${index}`, text })),
    correctOptionIds: [`choice-${question.answerIndex}`],
    allowMultiple: false,
    shuffle: false,
  }
}

/** Checks a student's selected choice against a generated question, via the
 * existing Tutor Core assessment evaluator. Never recomputes correctness
 * itself. */
export function checkFinancialLiteracyAnswer(
  question: CurriculumQuestion<string, unknown>,
  lessonRef: string,
  grade: number,
  selectedChoiceIndex: number,
): FinLitAnswerCheckResult {
  const item = financialLiteracyAssessmentItem(question, lessonRef, grade)
  const selectedOptionId = question.choices[selectedChoiceIndex] !== undefined ? `choice-${selectedChoiceIndex}` : undefined
  const input: LearnerInput = {
    raw: selectedOptionId ? question.choices[selectedChoiceIndex] : '',
    selectedOptionIds: selectedOptionId ? [selectedOptionId] : [],
  }
  const result = evaluateAssessmentItem(item, input)
  return {
    isCorrect: result.isCorrect,
    score: result.score,
    selectedChoice: selectedOptionId ? question.choices[selectedChoiceIndex] : null,
  }
}
