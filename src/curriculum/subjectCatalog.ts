import type { Grade } from '../types'

/**
 * The parent-facing subjects the Plans hub tracks, independent of whether a scope has
 * been authored yet. Plan front matter supplies the scope; this catalog preserves the
 * visible "awaiting placement results" state until it does.
 */
export interface HubSubjectDefinition {
  id: string
  label: string
  grades: readonly Grade[] | 'all'
}

export const HUB_SUBJECTS: readonly HubSubjectDefinition[] = [
  { id: 'math', label: 'Math', grades: 'all' },
  { id: 'reading', label: 'Reading & Spelling', grades: ['3', '4', '5', '6', '7', '8'] },
  { id: 'writing', label: 'Writing', grades: ['3', '4', '5', '6', '7', '8'] },
  { id: 'japanese-year-1', label: 'Japanese — Year 1', grades: ['3', '4', '5', '6', '7', '8'] },
  { id: 'english', label: 'English', grades: ['10', '12'] },
  { id: 'personal-finance', label: 'Personal Finance', grades: ['10', '12'] },
  { id: 'mindset', label: "Competitor's Mind", grades: 'all' },
  { id: 'ai-literacy', label: 'AI Literacy', grades: 'all' },
]

export function subjectAppliesToGrade(subject: HubSubjectDefinition, grade: Grade): boolean {
  return subject.grades === 'all' || subject.grades.includes(grade)
}
