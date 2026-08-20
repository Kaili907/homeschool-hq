import type { RichLessonSubjectAdapter } from './types'

const adapter = (subject: string, label: string, shortLabel = label): RichLessonSubjectAdapter =>
  Object.freeze({ subject, label, shortLabel })

const GENERIC = adapter('subject-neutral', 'Manuel Academy', 'Lesson')

/** Presentation metadata only; execution remains subject-neutral. */
export const RICH_STUDY_SUBJECT_ADAPTERS: Readonly<Record<string, RichLessonSubjectAdapter>> = Object.freeze({
  mathematics: adapter('mathematics', 'Mathematics', 'Math'),
  'english-language-arts': adapter('english-language-arts', 'English Language Arts', 'ELA'),
  science: adapter('science', 'Science'),
  'social-studies': adapter('social-studies', 'Social Studies'),
  health: adapter('health', 'Health'),
  'physical-education': adapter('physical-education', 'Physical Education', 'PE'),
  'ready-for-life': adapter('ready-for-life', 'Ready for Life'),
  technology: adapter('technology', 'Technology'),
  'arts-and-music': adapter('arts-and-music', 'Arts & Music'),
  'financial-literacy': adapter('financial-literacy', 'Financial Literacy'),
})

export function richLessonSubjectAdapter(subject?: string): RichLessonSubjectAdapter {
  const key = subject?.trim().toLowerCase().replaceAll(/\s+/g, '-')
  return key ? RICH_STUDY_SUBJECT_ADAPTERS[key] ?? adapter(key, subject!.trim()) : GENERIC
}
