/**
 * FF-M11 — the row shape the generated per-course lesson payloads use.
 *
 * Deliberately narrower than CatalogLesson: a row omits courseRef, grade,
 * subject, and unitRef because all four are already known from the eager index
 * once you know which course's payload you loaded. Repeating them across 2,736
 * rows would inflate every lazy chunk to say nothing new. The provider
 * rehydrates them on read.
 */
export interface GeneratedLessonRow {
  readonly lessonRef: string
  readonly unitNumber: number
  readonly dayInUnit: number
  readonly courseDay: number
  readonly title: string
  readonly estimatedMinutes: string
}
