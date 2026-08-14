import type { RichLessonSubjectAdapter } from './types'

const GENERIC_SUBJECT: RichLessonSubjectAdapter = Object.freeze({
  subject: 'subject-neutral',
  label: 'Manuel Academy',
  shortLabel: 'Lesson',
})

function adapter(subject: string, label: string, shortLabel = label): RichLessonSubjectAdapter {
  return Object.freeze({ subject, label, shortLabel })
}

/** Presentation metadata only. Every subject uses the same Study and response runtimes. */
export const RICH_STUDY_SUBJECT_ADAPTERS: Readonly<Record<string, RichLessonSubjectAdapter>> = Object.freeze({
  math: adapter('math', 'Mathematics', 'Math'),
  mathematics: adapter('mathematics', 'Mathematics', 'Math'),
  ela: adapter('ela', 'English Language Arts', 'ELA'),
  'english-language-arts': adapter('english-language-arts', 'English Language Arts', 'ELA'),
  science: adapter('science', 'Science'),
  'social-studies': adapter('social-studies', 'Social Studies'),
  health: adapter('health', 'Health'),
  pe: adapter('pe', 'Physical Education', 'PE'),
  'physical-education': adapter('physical-education', 'Physical Education', 'PE'),
  'financial-literacy': adapter('financial-literacy', 'Financial Literacy'),
  'ready-for-life': adapter('ready-for-life', 'Ready for Life'),
  technology: adapter('technology', 'Technology'),
  'technology-computer-science': adapter('technology-computer-science', 'Technology / Computer Science', 'Technology'),
  arts: adapter('arts', 'Arts / Music'),
  'arts-and-music': adapter('arts-and-music', 'Arts / Music'),
})

export function richLessonSubjectAdapter(subject?: string): RichLessonSubjectAdapter {
  const key = subject?.trim().toLowerCase().replaceAll(/\s+/g, '-')
  return key ? RICH_STUDY_SUBJECT_ADAPTERS[key] ?? adapter(key, subject!.trim()) : GENERIC_SUBJECT
}
