import { lessonStudyPlanSchema } from './study-plan.schema.ts'
import { studentFocusProfileSchema } from './focus-profile.schema.ts'
import { studySessionSchema } from './study-session.schema.ts'
import { learningEvidenceSchema } from './learning-evidence.schema.ts'
import { studentSkillReviewSchema } from './review-scheduling.schema.ts'
import { parentTeacherControlsSchema } from './parent-teacher-controls.schema.ts'
import { parentTeacherPrivateSchema } from './parent-teacher-private.schema.ts'

export const STUDY_ENGINE_SCHEMA_REGISTRY = [
  lessonStudyPlanSchema,
  studentFocusProfileSchema,
  studySessionSchema,
  learningEvidenceSchema,
  studentSkillReviewSchema,
  parentTeacherControlsSchema,
  parentTeacherPrivateSchema,
] as const

export type StudyEngineSchemaId =
  (typeof STUDY_ENGINE_SCHEMA_REGISTRY)[number]['schemaId']

export const GENERATED_SCHEMA_FILE_NAMES: Readonly<Record<StudyEngineSchemaId, string>> = {
  'lesson-study-plan': 'lesson-study-plan.v1.schema.json',
  'student-focus-profile': 'student-focus-profile.v1.schema.json',
  'study-session': 'study-session.v1.schema.json',
  'learning-evidence': 'learning-evidence.v1.schema.json',
  'student-skill-review': 'student-skill-review.v1.schema.json',
  'parent-teacher-controls': 'parent-teacher-controls.v1.schema.json',
  'parent-teacher-private': 'parent-teacher-private.v1.schema.json',
}

export function getStudyEngineSchema(schemaId: string) {
  return STUDY_ENGINE_SCHEMA_REGISTRY.find((schema) => schema.schemaId === schemaId)
}

export function getStudyEngineSchemaForValue(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const kind = (value as Record<string, unknown>).kind
  if (typeof kind !== 'string') return undefined
  return STUDY_ENGINE_SCHEMA_REGISTRY.find((schema) => schema.kind === kind)
}

