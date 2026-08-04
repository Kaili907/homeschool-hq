import type { AcademyGrade } from '../types'

/**
 * CURR-1 — shapes of the generated curriculum chunks served from
 * public/curriculum/<version>/ (see scripts/build-curriculum.mjs). These mirror
 * the release's lesson contract (curriculum-content/…/schemas/lesson.schema.json)
 * MINUS the protected fields, which never appear in student chunks.
 */

export const ACADEMY_RELEASE_VERSION = '1.0.0'

/** One instructional segment of a lesson's flow. */
export interface AcademyLessonSegment {
  segment: string
  minutes: string
  teacher_or_tutor_action: string
}

/** Student-safe lesson record. NOTE: `answer_or_scoring_guidance` and
 * `adaptive_tutor_routes` are deliberately absent — they live in the protected
 * chunk (fetched only by PIN-gated adult surfaces and the tutor adapter). */
export interface AcademyLesson {
  schema_version: string
  lesson_id: string
  course_id: string
  grade: number
  subject: string
  course_day: number
  unit_number: number
  unit_title: string
  day_in_unit: number
  title: string
  phase: string
  focus: string
  estimated_minutes: string
  standards: string[]
  essential_question: string
  learning_objectives: string[]
  success_criteria: string[]
  materials: string[]
  lesson_flow: AcademyLessonSegment[]
  student_activity: string
  formative_check: string
  mastery_rule: string
  extension?: string
  accessibility_and_accommodations: string[]
  safety_and_privacy: string[]
  media?: { required: boolean; fallback?: string; description?: string } | string
  parent_or_guardian_visibility?: string
  home_connection?: string
}

/** Student-safe unit assessment (prompts only; scoring interpretation is protected). */
export interface AcademyAssessment {
  assessment_id: string
  unit_number: number
  unit_title: string
  standards: string[]
  total_points: number
  prompts: { type: string; prompt: string; points: number }[]
}

export interface AcademyUnitChunk {
  releaseVersion: string
  unit: {
    unit_id: string
    course_id: string
    grade: number
    subject: string
    unit_number: number
    title: string
    days: number
    standards: string[]
    essential_question: string
    topics: string[]
    performance_task: string
    lesson_ids: string[]
  }
  lessons: AcademyLesson[]
  assessment: AcademyAssessment | null
}

/** Adult/tutor-only projection of one unit (parent panel + tutor adapter). */
export interface AcademyProtectedUnitChunk {
  releaseVersion: string
  courseId: string
  unitNumber: number
  lessons: Record<
    string,
    {
      answer_or_scoring_guidance: string | null
      adaptive_tutor_routes: { signal: string; action: string }[] | null
    }
  >
  assessmentMasteryInterpretation: Record<string, string> | null
}

export interface AcademyCatalogUnit {
  unitId: string
  unitNumber: number
  title: string
  days: number
  essentialQuestion: string
  performanceTask: string
  lessonIds: string[]
  hasAssessment: boolean
}

export interface AcademyCatalogCourse {
  courseId: string
  subject: string
  lessonCount: number
  units: AcademyCatalogUnit[]
}

export interface AcademyCatalog {
  releaseVersion: string
  grade: AcademyGrade
  courses: AcademyCatalogCourse[]
}

export interface AcademyScheduleDay {
  week: number
  day: number
  lessons: { lessonId: string; title: string }[]
}

export interface AcademySchedule {
  releaseVersion: string
  grade: AcademyGrade
  days: AcademyScheduleDay[]
}

export interface AcademyRelease {
  releaseVersion: string
  packageId: string
  authoredOn: string
  grades: AcademyGrade[]
  counts: { courses: number; units: number; lessons: number }
  courses: {
    courseId: string
    grade: AcademyGrade
    subject: string
    lessonCount: number
    unitCount: number
  }[]
}

/** Human-readable subject labels for the ten release subjects. */
export const ACADEMY_SUBJECT_LABELS: Record<string, string> = {
  mathematics: 'Mathematics',
  'english-language-arts': 'English Language Arts',
  science: 'Science',
  'social-studies': 'Social Studies',
  health: 'Health',
  'physical-education': 'Physical Education',
  'ready-for-life': 'Ready for Life',
  technology: 'Technology & Computer Science',
  'arts-and-music': 'Arts & Music',
  'financial-literacy': 'Financial Literacy',
}
