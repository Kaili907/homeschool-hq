import { beforeAll, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  CurriculumSourceError,
  type CurriculumBrowserSource,
  type CurriculumCatalog,
  type CurriculumLessonDetail,
  type CurriculumLessonSummary,
  type CurriculumSourceIdentity,
} from './contracts'
import {
  buildCurriculumCatalog,
  buildStandardsCoverage,
  parseCurriculumLesson,
  searchCurriculum,
} from './readModel'
import { createFilesystemCurriculumSource } from './filesystemSource.node'
import { createAdminCurriculumHttpSource } from './httpSource'
import {
  CurriculumBrowser,
  CurriculumBrowserView,
  CurriculumBrowserStateMessage,
  hasCurriculumReadAccess,
  type CurriculumBrowserLocation,
} from './CurriculumBrowser'

const source = createFilesystemCurriculumSource()
let catalog: CurriculumCatalog
let knownLesson: CurriculumLessonDetail

beforeAll(async () => {
  catalog = await source.loadCatalog()
  knownLesson = await source.loadLesson('ma-g5-mathematics-u01-l01')
})

const noop = () => {}

function renderView(
  location: CurriculumBrowserLocation,
  lesson: CurriculumLessonDetail | null = null,
  filters = {},
): string {
  return renderToStaticMarkup(
    <CurriculumBrowserView
      catalog={catalog}
      location={location}
      lesson={lesson}
      lessonError={null}
      filters={filters}
      onLocationChange={noop}
      onFiltersChange={noop}
    />,
  )
}

describe('ADMIN-11 canonical read model', () => {
  it('loads the published manifest and exact release counts', () => {
    expect(catalog.source).toMatchObject({
      packageId: 'manuel-academy-grades-5-7-8-curriculum-v1',
      version: '1.0.0',
      lifecycle: 'published',
      validationStatus: 'passed',
    })
    expect(catalog.grades).toEqual([5, 7, 8])
    expect(catalog.courses).toHaveLength(30)
    expect(catalog.units).toHaveLength(232)
    expect(catalog.lessons).toHaveLength(2736)
  })

  it('supports grade to course to unit to lesson navigation from canonical indexes', () => {
    expect(renderView({ mode: 'hierarchy' })).toContain('Grade 5')
    expect(renderView({ mode: 'hierarchy', grade: 5 })).toContain('Grade 5 Mathematics')
    expect(renderView({ mode: 'hierarchy', grade: 5, courseId: 'ma-g5-mathematics' }))
      .toContain('Unit 1: Mathematical Habits and Whole-Number Reasoning')
    expect(renderView({ mode: 'hierarchy', grade: 5, courseId: 'ma-g5-mathematics', unitNumber: 1 }))
      .toContain('Launch and diagnostic: problem-solving routines')
    expect(renderView({ mode: 'hierarchy', grade: 5, courseId: 'ma-g5-mathematics', unitNumber: 1, lessonId: knownLesson.lessonId }, knownLesson))
      .toContain(knownLesson.formativeCheck)
  })

  it('renders canonical lesson fields, protected guidance, and exact standards', () => {
    expect(knownLesson.learningObjectives).toHaveLength(3)
    expect(knownLesson.lessonFlow).toHaveLength(5)
    expect(knownLesson.standards).toContain('5.OA.1')
    expect(knownLesson.scoringGuidance).toContain('Score the stated learning target')
    expect(knownLesson.adaptiveTutorRoutes).toHaveLength(5)
    expect(knownLesson.media).toMatchObject({ required: false })
    const markup = renderView({
      mode: 'hierarchy', grade: 5, courseId: knownLesson.courseId,
      unitNumber: knownLesson.unitNumber, lessonId: knownLesson.lessonId,
    }, knownLesson)
    expect(markup).toContain('Scoring and mastery guidance')
    expect(markup).toContain('Adaptive Tutor routes')
    expect(markup).toContain('Safety and privacy')
    expect(markup).toContain('Parent visibility')
  })

  it('finds lessons deterministically by lesson id, title, and standard', () => {
    const byId = searchCurriculum(catalog, { keyword: 'ma-g5-mathematics-u01-l01' })
    expect(byId.lessons.map((lesson) => lesson.lessonId)).toEqual(['ma-g5-mathematics-u01-l01'])
    const byTitle = searchCurriculum(catalog, { keyword: 'Launch and diagnostic: problem-solving routines' })
    expect(byTitle.lessons[0].lessonId).toBe('ma-g5-mathematics-u01-l01')
    const byStandard = searchCurriculum(catalog, { grade: 5, standard: '5.OA.1' })
    expect(byStandard.totalMatches).toBeGreaterThan(0)
    expect(byStandard.lessons.every((lesson) => lesson.grade === 5 && lesson.standards.includes('5.OA.1'))).toBe(true)
    const byUnit = searchCurriculum(catalog, { courseId: 'ma-g5-mathematics', unitNumber: 1 })
    expect(byUnit.lessons).toHaveLength(18)
    expect(byUnit.lessons.every((lesson) => lesson.unitNumber === 1)).toBe(true)
    expect(searchCurriculum(catalog, {}, 5)).toMatchObject({ limited: true, totalMatches: 2736 })
  })

  it('maps standards only to exact lessons and exact unit-assessment evidence', () => {
    const coverage = buildStandardsCoverage(catalog).find((item) => item.standard === '5.OA.1')
    expect(coverage?.lessons.some((lesson) => lesson.lessonId === knownLesson.lessonId)).toBe(true)
    expect(coverage?.assessmentEvidence.length).toBeGreaterThan(0)
    expect(coverage?.assessmentEvidence.every((assessment) => assessment.standards.includes('5.OA.1'))).toBe(true)
  })

  it('renders standards to covering lessons and relevant assessment evidence', () => {
    const markup = renderView({ mode: 'standards' }, null, { standard: '5.OA.1' })
    expect(markup).toContain('5.OA.1')
    expect(markup).toContain(knownLesson.lessonId)
    expect(markup).toContain('exact standard listed')
  })

  it('keeps absent optional fields unavailable instead of fabricating them', () => {
    const summary: CurriculumLessonSummary = {
      lessonId: 'ma-g5-mathematics-u01-l99', courseId: 'ma-g5-mathematics', grade: 5,
      subject: 'mathematics', courseDay: 99, unitNumber: 1, unitTitle: 'Unit', dayInUnit: 99,
      title: 'A valid optional-field fixture', standards: ['5.OA.1'],
    }
    const identity: CurriculumSourceIdentity = {
      packageId: 'fixture', version: '1.0.0', authoredOn: '2026-08-03', status: 'fixture',
      lifecycle: 'published', validationStatus: 'unavailable',
    }
    const detail = parseCurriculumLesson(JSON.stringify({
      schema_version: '1.0', lesson_id: summary.lessonId, course_id: summary.courseId,
      grade: 5, unit_number: 1, learning_objectives: ['one'], lesson_flow: [{
        segment: 'Start', teacher_or_tutor_action: 'Teach',
      }], formative_check: 'Check', accessibility_and_accommodations: ['Access'],
      safety_and_privacy: ['Safe'],
    }), summary, identity)
    expect(detail.scoringGuidance).toBeUndefined()
    expect(detail.adaptiveTutorRoutes).toEqual([])
    expect(detail.media).toBeUndefined()
    const markup = renderView({
      mode: 'hierarchy', grade: 5, courseId: summary.courseId,
      unitNumber: 1, lessonId: summary.lessonId,
    }, detail)
    expect(markup).toContain('Unavailable in this published curriculum source.')
  })

  it('fails malformed source visibly instead of inventing curriculum', () => {
    expect(() => buildCurriculumCatalog({
      manifestJson: '{', courseIndexJson: '[]', unitIndexJson: '[]',
      lessonIndexCsv: 'lesson_id', assessmentJsonByCourse: {}, validationPassed: false,
    })).toThrowError(CurriculumSourceError)
    expect(() => buildCurriculumCatalog({
      manifestJson: '{', courseIndexJson: '[]', unitIndexJson: '[]',
      lessonIndexCsv: 'lesson_id', assessmentJsonByCourse: {}, validationPassed: false,
    })).toThrow('curriculum-manifest.json is not valid JSON')
  })
})

describe('ADMIN-11 read-only Admin surface', () => {
  it('shows the immutable published source version and validation status', () => {
    const markup = renderView({ mode: 'hierarchy' })
    expect(markup).toContain('version <strong>1.0.0</strong>')
    expect(markup).toContain('validation passed')
    expect(markup).toContain('published')
  })

  it('contains navigation and search controls but no mutation controls', () => {
    const markup = renderView({ mode: 'hierarchy' }).toLocaleLowerCase('en-US')
    expect(markup).toContain('<nav')
    expect(markup).toContain('type="search"')
    expect(markup).toContain('type="button"')
    expect(markup).not.toContain('save curriculum')
    expect(markup).not.toContain('publish curriculum')
    expect(markup).not.toContain('edit curriculum')
    expect(markup).not.toContain('delete curriculum')
    expect(markup).toContain('href="/academy/admin/curriculum/validation"')
    expect(markup).toContain('validation evidence')
    expect(markup).not.toContain('<main')
  })

  it('offers retry for a transient curriculum source failure', () => {
    const markup = renderToStaticMarkup(
      <CurriculumBrowserStateMessage role="alert" title="Curriculum source unavailable" onRetry={noop}>
        The authorized source could not be loaded.
      </CurriculumBrowserStateMessage>,
    )
    expect(markup).toContain('Try again')
    expect(markup).toContain('type="button"')
  })

  it('requires the canonical curriculum read capability before loading', () => {
    expect(hasCurriculumReadAccess({ status: 'checking' })).toBe(false)
    expect(hasCurriculumReadAccess({ status: 'authorized', capabilities: ['overview:read'] })).toBe(false)
    expect(hasCurriculumReadAccess({ status: 'authorized', capabilities: ['curriculum:read'] })).toBe(true)
    const deniedSource: CurriculumBrowserSource = {
      loadCatalog: vi.fn(), loadLesson: vi.fn(),
    }
    const markup = renderToStaticMarkup(
      <CurriculumBrowser authorization={{ status: 'denied' }} source={deniedSource} />,
    )
    expect(markup).toContain('Curriculum access unavailable')
    expect(markup).not.toContain(catalog.source.packageId)
  })

  it('uses credentialed GET-only HTTP seams without client role assertions', async () => {
    const calls: { path: string; init: RequestInit }[] = []
    const fetcher = vi.fn(async (path: string, init: RequestInit) => {
      calls.push({ path, init })
      return { ok: true, status: 200, json: async () => path.endsWith('/catalog') ? catalog : knownLesson }
    })
    const httpSource = createAdminCurriculumHttpSource(fetcher, '/api/admin/curriculum', async () => 'test-access-token')
    await httpSource.loadCatalog()
    await httpSource.loadLesson('lesson id/with spaces')
    expect(calls.map((call) => call.path)).toEqual([
      '/api/admin/curriculum/catalog',
      '/api/admin/curriculum/lessons/lesson%20id%2Fwith%20spaces',
    ])
    expect(calls.every((call) => call.init.method === 'GET'
      && call.init.credentials === 'omit'
      && (call.init.headers as Record<string, string>).Authorization === 'Bearer test-access-token')).toBe(true)
    expect(JSON.stringify(calls)).not.toMatch(/role|capabilit|actor/i)
  })
})
