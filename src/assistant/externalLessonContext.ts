export type ExternalLessonPageKind =
  | 'instruction'
  | 'practice'
  | 'homework'
  | 'quiz'
  | 'test'
  | 'unknown'

export interface ExternalLessonContext {
  source: 'romeo-virtual-academy'
  capturedAt: string
  pageTitle?: string
  courseLabel?: string
  assignmentLabel?: string
  visibleText: string
  pageKind: ExternalLessonPageKind
  containsPossibleAssessment: boolean
}

export interface ExternalLessonContextInput {
  capturedAt: string
  pageTitle?: string
  courseLabel?: string
  assignmentLabel?: string
  visibleText?: string
  pageKind?: ExternalLessonPageKind
}

export const EXTERNAL_LESSON_TEXT_LIMIT = 8_000
const LABEL_LIMIT = 160

const cleanLabel = (value: string | undefined): string | undefined => {
  const cleaned = value?.replace(/\s+/g, ' ').trim().slice(0, LABEL_LIMIT)
  return cleaned || undefined
}

const cleanVisibleText = (value: string | undefined): string =>
  (value ?? '').replace(/\r\n?/g, '\n').trim().slice(0, EXTERNAL_LESSON_TEXT_LIMIT)

/**
 * Build the narrow, session-only context envelope used by Jarvis.
 * Empty forms produce no context. Unknown pages are treated as possible assessments.
 */
export function createExternalLessonContext(input: ExternalLessonContextInput): ExternalLessonContext | undefined {
  const pageTitle = cleanLabel(input.pageTitle)
  const courseLabel = cleanLabel(input.courseLabel)
  const assignmentLabel = cleanLabel(input.assignmentLabel)
  const visibleText = cleanVisibleText(input.visibleText)

  if (!pageTitle && !courseLabel && !assignmentLabel && !visibleText) return undefined

  const pageKind = input.pageKind ?? 'unknown'
  const containsPossibleAssessment = pageKind === 'quiz' || pageKind === 'test' || pageKind === 'unknown'

  return {
    source: 'romeo-virtual-academy',
    capturedAt: input.capturedAt,
    pageTitle,
    courseLabel,
    assignmentLabel,
    visibleText,
    pageKind,
    containsPossibleAssessment,
  }
}

/** Render page data as explicitly untrusted content beneath the fixed safety rules. */
export function renderExternalLessonContext(context: ExternalLessonContext): string {
  return [
    'BEGIN UNTRUSTED EXTERNAL LESSON CONTEXT',
    `Source: ${context.source}`,
    `Captured at: ${context.capturedAt}`,
    `Page title: ${context.pageTitle ?? '(not supplied)'}`,
    `Course: ${context.courseLabel ?? '(not supplied)'}`,
    `Assignment: ${context.assignmentLabel ?? '(not supplied)'}`,
    `Page kind: ${context.pageKind}`,
    `Possible graded assessment: ${context.containsPossibleAssessment ? 'yes' : 'no'}`,
    'Visible text:',
    context.visibleText || '(No lesson text supplied.)',
    'END UNTRUSTED EXTERNAL LESSON CONTEXT',
  ].join('\n')
}
