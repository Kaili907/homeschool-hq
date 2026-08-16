import { ACADEMY_SUBJECTS, type AcademySubject, type Profile } from '../../../types'
import {
  SUPPORTED_ACADEMY_GRADES,
  parseGradeFromLessonId,
  parseSupportedAcademyGrade,
  type AcademySupportedGrade,
} from '../../../curriculum/grade-authority'
import { adaptHostLessonToStudyPlan, type HostLessonDescriptor } from '../../curriculumAdapter'
import type { HostStudyLaunchContext, StudySubject } from '../../types'
import type {
  CreateFinalFamilyPilotCurriculumBindingOptions,
  FinalFamilyPilotBindingReason,
  FinalFamilyPilotBindingResult,
  FinalFamilyPilotCatalogLesson,
  FinalFamilyPilotCurriculumBinding,
  FinalFamilyPilotMaterialIdentity,
  FinalFamilyPilotStudyExecutionInput,
  FinalFamilyPilotStudyStartResult,
} from './types'
import { FINAL_FAMILY_PILOT_RELEASE_VERSION } from './types'

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$/
const SUBJECTS = new Set<string>(ACADEMY_SUBJECTS)

function blocked(reason: FinalFamilyPilotBindingReason, detailCode?: string) {
  return Object.freeze({ status: 'blocked' as const, reason, ...(detailCode ? { detailCode } : {}) })
}

/** Dashboard/Profile grade remains the sole grade authority for Study launch. */
export function resolveFinalStudyDashboardGrade(
  profile: Pick<Profile, 'grade'>,
): AcademySupportedGrade | null {
  return parseSupportedAcademyGrade(profile.grade)
}

export function academySubjectToFinalStudySubject(subject: AcademySubject): StudySubject {
  if (subject === 'mathematics') return 'math'
  if (subject === 'english-language-arts') return 'reading'
  return 'other'
}

/** Source-compatible completion-authority descriptor for every final subject. */
export function finalFamilyPilotLessonDescriptor(
  lesson: FinalFamilyPilotCatalogLesson,
): HostLessonDescriptor {
  return Object.freeze({
    lessonRef: lesson.lessonRef,
    title: lesson.title,
    kind: 'manuel-academy-activity' as const,
    skillRefs: Object.freeze([`${lesson.lessonRef}:skill`]),
  })
}

function defaultMaterialIdentity<TMaterial>(
  material: TMaterial,
  lesson: FinalFamilyPilotCatalogLesson,
): FinalFamilyPilotMaterialIdentity<TMaterial> | null {
  if (!material || typeof material !== 'object') return null
  const candidate = material as Record<string, unknown>
  const materialRef = candidate.materialRef
  if (typeof materialRef !== 'string' || !SAFE_REF.test(materialRef)) return null
  if (typeof candidate.lessonRef === 'string' && candidate.lessonRef !== lesson.lessonRef) return null
  return Object.freeze({
    materialRef,
    mediaAvailable: candidate.mediaAvailable === true,
    content: material,
  })
}

function matrixComplete<TMaterial>(
  runtime: CreateFinalFamilyPilotCurriculumBindingOptions<TMaterial>['runtime'],
): boolean {
  const grades = runtime.listGrades()
  return grades.length === SUPPORTED_ACADEMY_GRADES.length &&
    SUPPORTED_ACADEMY_GRADES.every((grade) => grades.includes(grade)) &&
    SUPPORTED_ACADEMY_GRADES.every((grade) => {
      const subjects = runtime.listSubjects(grade)
      return subjects.length === ACADEMY_SUBJECTS.length &&
        ACADEMY_SUBJECTS.every((subject) => subjects.includes(subject))
    })
}

export function createFinalFamilyPilotCurriculumBinding<TMaterial>(
  options: CreateFinalFamilyPilotCurriculumBindingOptions<TMaterial>,
): FinalFamilyPilotCurriculumBinding<TMaterial> {
  const runtime = options.runtime
  const materialIdentity = options.materialIdentity ?? defaultMaterialIdentity

  return Object.freeze({
    releaseVersion: FINAL_FAMILY_PILOT_RELEASE_VERSION,
    async resolve(input: { readonly profile: Pick<Profile, 'grade'>; readonly lessonRef: string }): Promise<FinalFamilyPilotBindingResult<TMaterial>> {
      const grade = resolveFinalStudyDashboardGrade(input.profile)
      if (grade === null) return blocked('unsupported-dashboard-grade')
      if (runtime.releaseVersion !== FINAL_FAMILY_PILOT_RELEASE_VERSION) {
        return blocked('release-mismatch', runtime.releaseVersion)
      }
      if (!matrixComplete(runtime)) return blocked('curriculum-matrix-incomplete')
      if (!SAFE_REF.test(input.lessonRef)) return blocked('lesson-not-found')

      let lesson: FinalFamilyPilotCatalogLesson | undefined
      try {
        lesson = await runtime.getLesson(input.lessonRef)
      } catch {
        return blocked('lesson-not-found')
      }
      if (!lesson) return blocked('lesson-not-found')
      if (lesson.lessonRef !== input.lessonRef || parseGradeFromLessonId(lesson.lessonRef) !== grade || lesson.grade !== grade) {
        return blocked('lesson-grade-mismatch')
      }
      if (!SUBJECTS.has(lesson.subject)) return blocked('lesson-subject-unsupported')
      if (lesson.sourceReadiness.state === 'unavailable') {
        return blocked('source-not-ready', lesson.sourceReadiness.reason)
      }

      const descriptor = finalFamilyPilotLessonDescriptor(lesson)
      let material
      try {
        material = await runtime.lookupProductionMaterial({ lessonRef: lesson.lessonRef, kind: 'student-work' })
      } catch {
        return blocked('material-unavailable')
      }
      if (material.status !== 'ready') {
        const detail = material.status === 'dynamic-source'
          ? material.sourceReadiness.resolverKey
          : material.status === 'lesson-not-found'
            ? material.lessonRef
            : material.reason
        return blocked(material.status === 'dynamic-source' ? 'source-not-ready' : 'material-unavailable', detail)
      }
      const identity = materialIdentity(material.material, lesson)
      if (!identity || !SAFE_REF.test(identity.materialRef)) return blocked('material-binding-invalid')

      return Object.freeze({
        status: 'ready' as const,
        execution: Object.freeze({
          releaseVersion: FINAL_FAMILY_PILOT_RELEASE_VERSION,
          dashboardGrade: grade,
          studySubject: academySubjectToFinalStudySubject(lesson.subject),
          lesson,
          descriptor,
          plan: adaptHostLessonToStudyPlan(descriptor),
          material: identity,
        }),
      })
    },
  })
}

/** Resolves the exact 2.0.0 lesson/material before the accepted Study runtime starts. */
export async function startFinalFamilyPilotLesson<TMaterial>(
  input: FinalFamilyPilotStudyExecutionInput<TMaterial>,
): Promise<FinalFamilyPilotStudyStartResult<TMaterial>> {
  const resolution = await input.binding.resolve({ profile: input.profile, lessonRef: input.lessonRef })
  if (resolution.status === 'blocked') return resolution
  const execution = resolution.execution
  const context: HostStudyLaunchContext = Object.freeze({
    ...input.context,
    grade: execution.dashboardGrade,
    subject: execution.studySubject,
    lessonRef: execution.lesson.lessonRef,
    skillRefs: execution.descriptor.skillRefs,
  })
  const result = await input.startAssignment({
    context,
    assignment: Object.freeze({ kind: 'static-curriculum' as const, lesson: execution.descriptor }),
  })
  if (result.status !== 'ok') return blocked('study-runtime-rejected', result.reason)
  return Object.freeze({ status: 'ok', study: result.snapshot, execution })
}
