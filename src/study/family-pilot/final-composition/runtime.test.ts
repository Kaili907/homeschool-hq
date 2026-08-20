import { describe, expect, it, vi } from 'vitest'
import { ACADEMY_SUBJECTS, type AcademySubject, type Grade } from '../../../types'
import { SUPPORTED_ACADEMY_GRADES, type AcademySupportedGrade } from '../../../curriculum/grade-authority'
import type { HostStudyLaunchContext } from '../../types'
import type { FamilyPilotStudySnapshot } from '../study'
import {
  FINAL_FAMILY_PILOT_RELEASE_VERSION,
  createFinalFamilyPilotCurriculumBinding,
  resolveFinalStudyDashboardGrade,
  startFinalFamilyPilotLesson,
  type FinalFamilyPilotCatalogLesson,
  type FinalFamilyPilotCurriculumRuntime,
  type FinalFamilyPilotSourceReadiness,
} from '.'

interface Material { readonly materialRef: string; readonly lessonRef: string }

const rows = new Map<string, FinalFamilyPilotCatalogLesson>()
for (const grade of SUPPORTED_ACADEMY_GRADES) {
  for (const subject of ACADEMY_SUBJECTS) {
    const lessonRef = `ma-g${grade}-${subject}-u01-l01`
    rows.set(lessonRef, Object.freeze({
      lessonRef,
      courseRef: `ma-g${grade}-${subject}`,
      unitRef: `ma-g${grade}-${subject}-u01`,
      grade,
      subject,
      unitNumber: 1,
      dayInUnit: 1,
      courseDay: 1,
      title: `Grade ${grade} ${subject}`,
      estimatedMinutes: '45-60',
      resourceRefs: Object.freeze([`${lessonRef}:student-work`]),
      sourceReadiness: Object.freeze({ state: 'ready', dynamicSource: false, sourceRefs: Object.freeze([]) }),
    }))
  }
}

function runtime(options: {
  releaseVersion?: string
  grades?: readonly AcademySupportedGrade[]
  readiness?: FinalFamilyPilotSourceReadiness
  materialStatus?: 'ready' | 'dynamic-source' | 'unavailable'
} = {}): FinalFamilyPilotCurriculumRuntime<Material> {
  return {
    releaseVersion: options.releaseVersion ?? FINAL_FAMILY_PILOT_RELEASE_VERSION,
    listGrades: () => options.grades ?? SUPPORTED_ACADEMY_GRADES,
    listSubjects: () => ACADEMY_SUBJECTS,
    getLesson: async (lessonRef) => {
      const lesson = rows.get(lessonRef)
      return lesson && options.readiness ? { ...lesson, sourceReadiness: options.readiness } : lesson
    },
    lookupProductionMaterial: async ({ lessonRef }) => {
      if (options.materialStatus === 'dynamic-source') {
        return { status: 'dynamic-source', sourceReadiness: { state: 'dynamic', dynamicSource: true, sourceRefs: [], resolverKey: 'current-source-v1' } }
      }
      if (options.materialStatus === 'unavailable') return { status: 'unavailable', reason: 'missing-material' }
      return { status: 'ready', material: { materialRef: `${lessonRef}:student-work`, lessonRef }, sourceReadiness: { state: 'ready', dynamicSource: false, sourceRefs: [] } }
    },
  }
}

const profile = (grade: AcademySupportedGrade | 6) => ({ grade: String(grade) as Grade })

function context(grade: number): HostStudyLaunchContext {
  return {
    householdRef: 'household:one', learnerRef: 'learner:one', hostProfileRef: 'profile-one',
    grade, subject: 'other', lessonRef: 'placeholder:lesson', skillRefs: ['placeholder:skill'],
    householdTimeZone: 'America/New_York', learnerLocalDate: '2026-08-15',
    accessibility: { largeText: false, reducedMotion: false, noAudio: true, captions: true, transientTranscript: false, highContrast: false, oneTaskAtATime: true },
    timerPreference: { visibility: 'shown', milestonesOnly: true },
    parentLimits: { maximumWorkMinutes: 30, breakMinutes: 5 }, accommodationLimits: {},
  }
}

function snapshot(lessonRef: string): FamilyPilotStudySnapshot {
  return {
    session: { householdRef: 'household:one', learnerRef: 'learner:one', blockRef: 'block:one', sessionRef: 'block:one:session' },
    lessonRef, title: 'Bound lesson', assignmentState: 'active', sessionStatus: 'active',
    segmentRef: `${lessonRef}:segment:learn`, segmentOrdinal: 0, completedSegmentRefs: [],
    remainingSegmentRefs: [`${lessonRef}:segment:learn`], elapsedActiveSecondsInSegment: 0,
    checkpointRef: null, checkpointRevision: 0, lastAcceptedEventRef: null,
    masteryAuthority: 'completion-only', tutorBridgeAvailable: false, requiredWorkCompletionPercent: 0,
    rawAnswerIncluded: false, transcriptIncluded: false,
  }
}

describe('final 2.0.0 Study curriculum binding', () => {
  it('uses Dashboard grade authority and never resolves Grade 6', async () => {
    const getLesson = vi.fn(runtime().getLesson)
    const binding = createFinalFamilyPilotCurriculumBinding({ runtime: { ...runtime(), getLesson } })
    expect(resolveFinalStudyDashboardGrade(profile(3))).toBe(3)
    expect(resolveFinalStudyDashboardGrade(profile(6))).toBeNull()
    await expect(binding.resolve({ profile: profile(6), lessonRef: 'ma-g5-mathematics-u01-l01' }))
      .resolves.toEqual({ status: 'blocked', reason: 'unsupported-dashboard-grade' })
    expect(getLesson).not.toHaveBeenCalled()
  })

  it('resolves all ten subjects for every supported grade through one adapter', async () => {
    const binding = createFinalFamilyPilotCurriculumBinding({ runtime: runtime() })
    const subjects = new Set<AcademySubject>()
    for (const grade of SUPPORTED_ACADEMY_GRADES) {
      for (const subject of ACADEMY_SUBJECTS) {
        const result = await binding.resolve({ profile: profile(grade), lessonRef: `ma-g${grade}-${subject}-u01-l01` })
        expect(result.status).toBe('ready')
        if (result.status === 'ready') {
          subjects.add(result.execution.lesson.subject)
          expect(result.execution).toMatchObject({ releaseVersion: '2.0.0', dashboardGrade: grade })
          expect(result.execution.plan.masteryAuthority).toBe('completion-only')
          expect(result.execution.material.materialRef).toBe(`${result.execution.lesson.lessonRef}:student-work`)
        }
      }
    }
    expect([...subjects]).toEqual(expect.arrayContaining([...ACADEMY_SUBJECTS]))
    expect(subjects.size).toBe(10)
  })

  it('fails closed for incomplete matrices, wrong-grade lessons, and unresolved dynamic materials', async () => {
    const partial = createFinalFamilyPilotCurriculumBinding({ runtime: runtime({ grades: [3, 4, 5, 7, 8, 9, 10, 11] }) })
    await expect(partial.resolve({ profile: profile(3), lessonRef: 'ma-g3-mathematics-u01-l01' }))
      .resolves.toMatchObject({ status: 'blocked', reason: 'curriculum-matrix-incomplete' })
    const exact = createFinalFamilyPilotCurriculumBinding({ runtime: runtime() })
    await expect(exact.resolve({ profile: profile(4), lessonRef: 'ma-g3-mathematics-u01-l01' }))
      .resolves.toMatchObject({ status: 'blocked', reason: 'lesson-grade-mismatch' })
    const dynamic = createFinalFamilyPilotCurriculumBinding({ runtime: runtime({ materialStatus: 'dynamic-source' }) })
    await expect(dynamic.resolve({ profile: profile(3), lessonRef: 'ma-g3-social-studies-u01-l01' }))
      .resolves.toMatchObject({ status: 'blocked', reason: 'source-not-ready', detailCode: 'current-source-v1' })
    const wrongMaterialRuntime: FinalFamilyPilotCurriculumRuntime<Material> = {
      ...runtime(),
      lookupProductionMaterial: async ({ lessonRef }) => ({
        status: 'ready',
        material: { materialRef: `${lessonRef}:student-work`, lessonRef: 'ma-g3-science-u01-l01' },
        sourceReadiness: { state: 'ready', dynamicSource: false, sourceRefs: [] },
      }),
    }
    const exactMaterial = createFinalFamilyPilotCurriculumBinding({ runtime: wrongMaterialRuntime })
    await expect(exactMaterial.resolve({ profile: profile(3), lessonRef: 'ma-g3-mathematics-u01-l01' }))
      .resolves.toMatchObject({ status: 'blocked', reason: 'material-binding-invalid' })
  })

  it('starts the accepted Study runtime only after exact lesson and material resolution', async () => {
    const startAssignment = vi.fn(async (input: { context: HostStudyLaunchContext }) => ({
      status: 'ok' as const,
      snapshot: snapshot(input.context.lessonRef),
    }))
    const result = await startFinalFamilyPilotLesson({
      binding: createFinalFamilyPilotCurriculumBinding({ runtime: runtime() }),
      profile: profile(12),
      lessonRef: 'ma-g12-technology-u01-l01',
      context: context(12),
      startAssignment,
    })
    expect(result.status).toBe('ok')
    expect(startAssignment).toHaveBeenCalledWith(expect.objectContaining({
      context: expect.objectContaining({ grade: 12, subject: 'other', lessonRef: 'ma-g12-technology-u01-l01' }),
      assignment: expect.objectContaining({ lesson: expect.objectContaining({ kind: 'manuel-academy-activity' }) }),
    }))
  })
})
