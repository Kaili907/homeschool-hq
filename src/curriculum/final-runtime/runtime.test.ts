import { describe, expect, it, vi } from 'vitest'
import { admitCandidate, buildCanonicalCandidateFixture } from '../release-admission/index.ts'
import type { AdmittedRelease } from '../release-admission/types.ts'
import { buildFixtureCourseLoaders } from './fixtures.ts'
import {
  FINAL_CURRICULUM_GRADES,
  buildFinalRuntimeManifest,
  createFinalCurriculumRuntime,
  parseFinalCurriculumGrade,
  parseGradeFromCurriculumRef,
  type LessonSourceReadiness,
  type ProductionMaterialResolver,
} from './index.ts'

function admittedRelease(): AdmittedRelease {
  const decision = admitCandidate(buildCanonicalCandidateFixture())
  if (decision.status !== 'ADMITTED') throw new Error(decision.rejection_codes.join(', '))
  return decision.release
}

interface Material {
  readonly id: string
}

function makeRuntime(options: {
  readonly readiness?: (lessonRef: string) => LessonSourceReadiness
  readonly resolver?: ProductionMaterialResolver<Material>
} = {}) {
  const release = admittedRelease()
  const calls: string[] = []
  const resolver = options.resolver ?? {
    resolve: vi.fn(async (request) => ({
      status: 'ready' as const,
      material: { id: `${request.lessonRef}:${request.kind}` },
      sourceReadiness: request.sourceReadiness,
    })),
  }
  const runtime = createFinalCurriculumRuntime({
    manifest: buildFinalRuntimeManifest(release),
    lessonLoaders: buildFixtureCourseLoaders(
      release,
      (lesson) => options.readiness?.(lesson.lesson_id) ?? {
        state: 'ready', dynamicSource: false, sourceRefs: lesson.resource_refs,
      },
      (courseRef) => calls.push(courseRef),
    ),
    productionMaterialResolver: resolver,
  })
  return { calls, release, resolver, runtime }
}

describe('final curriculum grade authority', () => {
  it('orders every supported grade and excludes Grade 6', () => {
    expect(FINAL_CURRICULUM_GRADES).toEqual([3, 4, 5, 7, 8, 9, 10, 11, 12])
    expect(FINAL_CURRICULUM_GRADES).not.toContain(6)
    expect(makeRuntime().runtime.listGrades()).toEqual(FINAL_CURRICULUM_GRADES)
  })

  it('parses Grades 10, 11, and 12 without truncating them to Grade 1', () => {
    expect([10, 11, 12].map(parseFinalCurriculumGrade)).toEqual([10, 11, 12])
    expect(['10', '11', '12'].map(parseFinalCurriculumGrade)).toEqual([10, 11, 12])
    expect(parseGradeFromCurriculumRef('ma-g10-mathematics-u01-l01')).toBe(10)
    expect(parseGradeFromCurriculumRef('ma-g11-science-u01-l01')).toBe(11)
    expect(parseGradeFromCurriculumRef('ma-g12-technology-u01-l01')).toBe(12)
    expect(parseGradeFromCurriculumRef('ma-g6-mathematics-u01-l01')).toBeNull()
  })
})

describe('admitted release browser runtime', () => {
  it('projects no lesson body into the eager manifest', () => {
    const { release } = makeRuntime()
    const serialized = JSON.stringify(buildFinalRuntimeManifest(release))
    expect(serialized).not.toContain('lesson_flow')
    expect(serialized).not.toContain('Independent application')
    expect(serialized).not.toContain('scoring_guidance')
  })

  it('keeps course/unit/schedule reads eager and lessons lazy', async () => {
    const { calls, runtime } = makeRuntime()
    runtime.listGrades()
    runtime.listSubjects(10)
    runtime.listCourses(11)
    runtime.getCourse('ma-g12-mathematics')
    runtime.listUnits('ma-g10-mathematics')
    runtime.listSchedules(9)
    expect(calls).toEqual([])

    await runtime.getLesson('ma-g11-mathematics-u01-l01')
    expect(calls).toEqual(['ma-g11-mathematics'])
    await Promise.all([
      runtime.getLesson('ma-g11-mathematics-u01-l02'),
      runtime.listLessons('ma-g11-mathematics'),
    ])
    expect(calls).toEqual(['ma-g11-mathematics'])
  })

  it('resolves a stable lesson id through only its owning course', async () => {
    const { calls, runtime } = makeRuntime()
    const lesson = await runtime.getLesson('ma-g10-mathematics-u01-l02')
    expect(lesson).toMatchObject({
      lessonRef: 'ma-g10-mathematics-u01-l02',
      courseRef: 'ma-g10-mathematics',
      unitRef: 'ma-g10-mathematics-u01',
      grade: 10,
      unitNumber: 1,
      courseDay: 2,
    })
    expect(calls).toEqual(['ma-g10-mathematics'])
    expect(await runtime.getLesson('not-a-lesson')).toBeUndefined()
  })

  it('preserves the admitted schedule exactly and resolves its requested slot', async () => {
    const { release, runtime } = makeRuntime()
    const authored = release.candidate.authoring_set.schedules.find((item) => item.grade === 12)!
    const projected = runtime.listSchedules(12)[0]!
    expect(projected).toEqual({
      scheduleRef: authored.schedule_id,
      grade: authored.grade,
      weeks: authored.weeks,
      instructionalDays: authored.instructional_days,
      entries: authored.entries.map((entry) => ({
        week: entry.week,
        day: entry.day,
        lessonRefs: entry.lesson_refs,
      })),
    })
    const slot = await runtime.resolveScheduleEntry(projected.scheduleRef, 1, 1)
    expect(slot).toHaveLength(1)
    expect(slot[0].lessons.map((lesson) => lesson.lessonRef)).toEqual(slot[0].lessonRefs)
  })

  it('delegates production material lookup with exact release and lesson identity', async () => {
    const resolver: ProductionMaterialResolver<Material> = {
      resolve: vi.fn(async (request) => ({
        status: 'ready' as const,
        material: { id: request.materialRef ?? request.lessonRef },
        sourceReadiness: request.sourceReadiness,
      })),
    }
    const { runtime } = makeRuntime({ resolver })
    const result = await runtime.lookupProductionMaterial({
      lessonRef: 'ma-g12-mathematics-u01-l01',
      kind: 'student-work',
      materialRef: 'worksheet-one',
    })
    expect(result).toMatchObject({ status: 'ready', material: { id: 'worksheet-one' } })
    expect(resolver.resolve).toHaveBeenCalledWith(expect.objectContaining({
      releaseVersion: '2.0.0',
      lessonRef: 'ma-g12-mathematics-u01-l01',
      courseRef: 'ma-g12-mathematics',
      unitRef: 'ma-g12-mathematics-u01',
      grade: 12,
      subject: 'mathematics',
    }))
  })

  it('represents dynamic-source readiness and carries it to the resolver', async () => {
    const dynamic: LessonSourceReadiness = {
      state: 'dynamic',
      dynamicSource: true,
      sourceRefs: ['current-event-source'],
      resolverKey: 'social-current-events-v1',
    }
    const resolver: ProductionMaterialResolver<Material> = {
      resolve: vi.fn(async (request) => ({
        status: 'dynamic-source' as const,
        sourceReadiness: request.sourceReadiness as Extract<
          LessonSourceReadiness,
          { readonly state: 'dynamic' }
        >,
      })),
    }
    const { runtime } = makeRuntime({
      readiness: (lessonRef) => lessonRef === 'ma-g9-mathematics-u01-l01'
        ? dynamic
        : { state: 'ready', dynamicSource: false, sourceRefs: [] },
      resolver,
    })
    const lesson = await runtime.getLesson('ma-g9-mathematics-u01-l01')
    expect(lesson?.sourceReadiness).toEqual(dynamic)
    expect(lesson?.sourceReadiness.dynamicSource).toBe(true)
    expect(await runtime.lookupProductionMaterial({
      lessonRef: lesson!.lessonRef,
      kind: 'source',
    })).toEqual({ status: 'dynamic-source', sourceReadiness: dynamic })
  })

  it('bridges a lazy catalog lesson into a caller-owned Study content plan', async () => {
    const { runtime } = makeRuntime()
    const result = await runtime.buildStudyContentPlan(
      'ma-g3-mathematics-u01-l01',
      {
        build: ({ lesson }) => ({
          lessonRef: lesson.lessonRef,
          title: lesson.title,
          skillRefs: [lesson.lessonRef],
          source: 'manuel-academy' as const,
        }),
      },
    )
    expect(result).toMatchObject({
      status: 'ready',
      plan: {
        lessonRef: 'ma-g3-mathematics-u01-l01',
        skillRefs: ['ma-g3-mathematics-u01-l01'],
        source: 'manuel-academy',
      },
    })
  })
})
