import { describe, expect, it, vi } from 'vitest'
import {
  FINAL_CURRICULUM_GRADES,
  type FinalCourseLessonRow,
  type FinalRuntimeManifest,
} from '../final-runtime'
import { SUPPORTED_SUBJECTS } from '../release-admission'
import { loadFinalFamilyPilotCatalog } from './runtime'
import type {
  FinalBrowserCoursePayload,
  FinalBrowserManifestDocument,
} from './types'

function releaseFixture(): {
  readonly manifest: FinalBrowserManifestDocument
  readonly firstCoursePayload: FinalBrowserCoursePayload
} {
  const courses: FinalRuntimeManifest['courses'][number][] = []
  const units: FinalRuntimeManifest['units'][number][] = []
  const assessmentIndex: FinalBrowserManifestDocument['assessments'][number][] = []
  const lessonRefsByCourse = new Map<string, string[]>()

  let courseIndex = 0
  for (const grade of FINAL_CURRICULUM_GRADES) {
    for (const subject of SUPPORTED_SUBJECTS) {
      const courseRef = `ma-g${grade}-${subject}`
      const lessonCount = courseIndex < 12 ? 93 : 92
      const unitCount = courseIndex < 68 ? 8 : 7
      const lessonRefs: string[] = []
      let courseDay = 1

      courses.push({
        courseRef,
        grade,
        subject,
        title: `Grade ${grade} ${subject}`,
        days: lessonCount,
        unitCount,
        lessonCount,
      })

      for (let unitNumber = 1; unitNumber <= unitCount; unitNumber += 1) {
        const remainingLessons = lessonCount - lessonRefs.length
        const remainingUnits = unitCount - unitNumber + 1
        const lessonsInUnit = Math.ceil(remainingLessons / remainingUnits)
        const unitRef = `${courseRef}-u${String(unitNumber).padStart(2, '0')}`
        const unitLessonRefs = Array.from({ length: lessonsInUnit }, (_, offset) =>
          `${unitRef}-l${String(offset + 1).padStart(2, '0')}`,
        )
        lessonRefs.push(...unitLessonRefs)
        units.push({
          unitRef,
          courseRef,
          grade,
          subject,
          unitNumber,
          title: `Unit ${unitNumber}`,
          days: lessonsInUnit,
          essentialQuestion: `Question ${unitNumber}`,
          assessmentRef: `${unitRef}-assessment`,
          lessonRefs: unitLessonRefs,
        })
        courseDay += lessonsInUnit
      }
      expect(courseDay - 1).toBe(lessonCount)
      lessonRefsByCourse.set(courseRef, lessonRefs)

      const assessmentCount = courseIndex < 69 ? 8 : 7
      for (let assessment = 1; assessment <= assessmentCount; assessment += 1) {
        assessmentIndex.push({
          assessmentRef: `${courseRef}-assessment-${String(assessment).padStart(2, '0')}`,
          courseRef,
          unitRef: units[units.length - unitCount + ((assessment - 1) % unitCount)]!.unitRef,
          grade,
          subject,
          authorityClass: 'AUTO_SCOREABLE',
          responseMode: 'written',
        })
      }
      courseIndex += 1
    }
  }

  const manifest = {
    releaseId: 'family-pilot-r1',
    classification: 'ADMITTED_PRODUCTION_BOUND_FAMILY_PILOT_R1',
    admissionStatus: 'ADMITTED',
    counts: { grades: 9, courses: 90, units: 698, lessons: 8292, assessments: 699 },
    productionBindings: 8292,
    assessmentBindings: 699,
    assessments: assessmentIndex,
    dynamicSocialSources: {
      admitted: 12,
      runtimeState: 'PENDING_SOURCE_ATTACHMENT',
      readyTransition: 'ATTACHED_SATISFIED',
    },
    runtime: {
      releaseVersion: '2.0.0',
      courses,
      units,
      schedules: [],
    },
  } as FinalBrowserManifestDocument

  const firstCourse = courses[0]!
  const firstLessonRefs = lessonRefsByCourse.get(firstCourse.courseRef)!
  const unitByLesson = new Map(
    units
      .filter((unit) => unit.courseRef === firstCourse.courseRef)
      .flatMap((unit) => unit.lessonRefs.map((lessonRef) => [lessonRef, unit] as const)),
  )
  const lessons: FinalCourseLessonRow[] = firstLessonRefs.map((lessonRef, index) => {
    const unit = unitByLesson.get(lessonRef)!
    return {
      lessonRef,
      unitRef: unit.unitRef,
      dayInUnit: unit.lessonRefs.indexOf(lessonRef) + 1,
      courseDay: index + 1,
      title: `Lesson ${index + 1}`,
      estimatedMinutes: '45–60',
      resourceRefs: [],
      sourceReadiness: { state: 'ready', dynamicSource: false, sourceRefs: [] },
    }
  })
  const courseAssessments = assessmentIndex.filter(
    (assessment) => assessment.courseRef === firstCourse.courseRef,
  )

  const firstCoursePayload = {
    courseRef: firstCourse.courseRef,
    lessons,
    bindings: Object.fromEntries(firstLessonRefs.map((lessonRef) => [lessonRef, {
      lessonRef,
      courseRef: firstCourse.courseRef,
      grade: firstCourse.grade,
      subject: firstCourse.subject,
      completionAuthority: 'LEARNER_AUTHORITY',
      sourceReadinessKind: 'STATIC_READY',
      sourceRuntimeState: 'READY',
    }])),
    materials: Object.fromEntries(firstLessonRefs.map((lessonRef) => [lessonRef, {
      materialRef: `${lessonRef}-material`,
      lessonRef,
      title: lessonRef,
      subject: firstCourse.subject,
      format: 'structured',
      sections: [],
    }])),
    assessmentBindings: Object.fromEntries(courseAssessments.map((assessment) => [
      assessment.assessmentRef,
      { ...assessment, state: 'BOUND' },
    ])),
    assessments: Object.fromEntries(courseAssessments.map((assessment) => [
      assessment.assessmentRef,
      {
        schemaVersion: '1.0',
        kind: 'canonical-learner-assessment-package',
        assessmentRef: assessment.assessmentRef,
        courseRef: assessment.courseRef,
        grade: assessment.grade,
        subject: assessment.subject,
        location: {
          unitRef: assessment.unitRef,
          unitNumber: 1,
          unitTitle: 'Unit',
          courseTitle: firstCourse.title,
          assessmentLessonRef: null,
        },
        standards: [],
        instructions: [],
        learnerTasks: [],
        responseMode: assessment.responseMode,
        completionScoringAuthorityClass: assessment.authorityClass,
        learnerSuccessCriteria: [],
        accommodations: '',
        productionReadiness: {
          status: 'READY',
          structuralOnly: false,
          answerMaterialIncluded: false,
        },
      },
    ])),
  } as FinalBrowserCoursePayload

  return { manifest, firstCoursePayload }
}

describe('final browser app data runtime', () => {
  it('exposes the admitted census and loads lesson rows one course at a time', async () => {
    const fixture = releaseFixture()
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/manifest.json')) {
        return new Response(JSON.stringify(fixture.manifest), { status: 200 })
      }
      if (url.endsWith(`/${encodeURIComponent(fixture.firstCoursePayload.courseRef)}.json`)) {
        return new Response(JSON.stringify(fixture.firstCoursePayload), { status: 200 })
      }
      return new Response(null, { status: 404 })
    })

    const catalog = await loadFinalFamilyPilotCatalog({
      fetch: fetcher as unknown as typeof fetch,
      baseUrl: '/app/',
    })

    expect(catalog.runtime.listGrades()).toEqual(FINAL_CURRICULUM_GRADES)
    expect(catalog.runtime.listCourses()).toHaveLength(90)
    expect(catalog.runtime.listCourses().reduce((sum, course) => sum + course.lessonCount, 0)).toBe(8292)
    expect(catalog.listAssessments()).toHaveLength(699)
    expect(fetcher).toHaveBeenCalledTimes(1)

    await expect(catalog.runtime.listLessons(fixture.firstCoursePayload.courseRef)).resolves.toHaveLength(93)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[1]![0]).toBe(
      `/app/family-pilot-final/2.0.0/courses/${encodeURIComponent(fixture.firstCoursePayload.courseRef)}.json`,
    )
  })
})
