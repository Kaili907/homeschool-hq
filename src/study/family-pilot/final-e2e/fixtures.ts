import type {
  FinalE2ECurriculumProvider,
  FinalE2EFixtureModel,
  FinalE2ELessonFixture,
  FinalE2EProductionMaterialProvider,
} from './contracts'

export const FINAL_E2E_STUDENT_A = 'synthetic:student-a'
export const FINAL_E2E_STUDENT_B = 'synthetic:student-b'
export const FINAL_E2E_STUDENT_C = 'synthetic:student-c'

export const FINAL_E2E_LESSONS = Object.freeze({
  sharedMath: 'synthetic:lesson:math:fractions',
  normalScience: 'synthetic:lesson:science:systems',
  rflGuardian: 'synthetic:lesson:rfl:planning',
  socialDynamic: 'synthetic:lesson:social:source-inquiry',
  safetyMath: 'synthetic:lesson:math:patterns',
})

export const FINAL_E2E_FIXTURES: FinalE2EFixtureModel = Object.freeze({
  students: Object.freeze([
    Object.freeze({ studentRef: FINAL_E2E_STUDENT_A, displayName: 'Synthetic Learner A', grade: '5' as const }),
    Object.freeze({ studentRef: FINAL_E2E_STUDENT_B, displayName: 'Synthetic Learner B', grade: '7' as const }),
    Object.freeze({ studentRef: FINAL_E2E_STUDENT_C, displayName: 'Synthetic Learner C', grade: '8' as const }),
  ]),
  sources: Object.freeze([
    Object.freeze({
      sourceRef: 'synthetic:source:state-history-001',
      kind: 'primary-source' as const,
      title: 'Synthetic State History Source',
      publisher: 'Example Public Archive',
      publishedAt: '2025-09-01T00:00:00.000Z',
    }),
  ]),
})

const SHARED_LESSONS: readonly FinalE2ELessonFixture[] = Object.freeze([
  Object.freeze({
    lessonRef: FINAL_E2E_LESSONS.sharedMath,
    grade: '5',
    subject: 'mathematics',
    title: 'Synthetic Fraction Reasoning',
    completionAuthority: 'learner',
    materialRef: 'synthetic:material:math:fractions',
    requiresDynamicSource: false,
  }),
  Object.freeze({
    lessonRef: FINAL_E2E_LESSONS.normalScience,
    grade: '5',
    subject: 'science',
    title: 'Synthetic Systems Investigation',
    completionAuthority: 'learner',
    materialRef: 'synthetic:material:science:systems',
    requiresDynamicSource: false,
  }),
  Object.freeze({
    lessonRef: FINAL_E2E_LESSONS.rflGuardian,
    grade: '5',
    subject: 'ready-for-life',
    title: 'Synthetic Ready-for-Life Plan',
    completionAuthority: 'guardian',
    materialRef: 'synthetic:material:rfl:planning',
    requiresDynamicSource: false,
  }),
  Object.freeze({
    lessonRef: FINAL_E2E_LESSONS.socialDynamic,
    grade: '5',
    subject: 'social-studies',
    title: 'Synthetic Source-Based Inquiry',
    completionAuthority: 'learner',
    materialRef: 'synthetic:material:social:inquiry',
    requiresDynamicSource: true,
  }),
  Object.freeze({
    lessonRef: FINAL_E2E_LESSONS.safetyMath,
    grade: '5',
    subject: 'mathematics',
    title: 'Synthetic Pattern Reasoning',
    completionAuthority: 'learner',
    materialRef: 'synthetic:material:math:patterns',
    requiresDynamicSource: false,
  }),
])

const gradeLesson = (lesson: FinalE2ELessonFixture, grade: '5' | '7' | '8'): FinalE2ELessonFixture => ({
  ...lesson,
  grade,
})

export const syntheticCurriculumProvider = Object.freeze<FinalE2ECurriculumProvider>({
  listLessons: (grade) => SHARED_LESSONS.map((lesson) => gradeLesson(lesson, grade)),
})

const segmentsByMaterial = new Map<string, readonly string[]>(SHARED_LESSONS.map((lesson) => [
  lesson.materialRef,
  Object.freeze([1, 2, 3, 4, 5].map((ordinal) => `${lesson.lessonRef}:segment:${ordinal}`)),
]))

export const syntheticProductionMaterialProvider = Object.freeze<FinalE2EProductionMaterialProvider>({
  resolve: ({ lesson, sourceRef }) => {
    if (lesson.requiresDynamicSource && sourceRef === null) {
      return { status: 'blocked-source', reasonCode: 'qualifying-source-required' }
    }
    return {
      status: 'ready',
      materialRef: lesson.materialRef,
      segmentRefs: segmentsByMaterial.get(lesson.materialRef) ?? [],
    }
  },
  qualifySource: ({ lesson, source }) => ({
    qualified: lesson.requiresDynamicSource && source.kind === 'primary-source',
    ...(!lesson.requiresDynamicSource || source.kind !== 'primary-source'
      ? { reasonCode: 'source-does-not-qualify' }
      : {}),
  }),
})
